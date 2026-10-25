import { Prisma, type Evento, type InscripcionEvento } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hoyUTC } from '../lib/fechas.js';
import { ReglaNegocioError } from '../lib/errores.js';
import { esResponsableDe } from './vinculos.service.js';
import { ESTADO_AUTORIZACION, OrdenEnProcesoError, liberarOrdenesPendientes } from './ordenes.service.js';

// Circulares de eventos: el encargado autoriza (o no) que su hijo participe. Si el evento tiene
// costo, al autorizar se aparta el cupo y queda un cargo pendiente hasta la fecha limite; si no
// se paga a tiempo la participacion se cancela (no genera mora).

const DIA_MS = 24 * 60 * 60 * 1000;
const INTERVALO_VENCIMIENTO_MS = 30 * 60 * 1000;

// Lo que ocupa cupo: autorizadas pendientes de pago y confirmadas
const ESTADOS_CON_CUPO = [ESTADO_AUTORIZACION.AUTORIZADA, ESTADO_AUTORIZACION.CONFIRMADA];

type ClienteDb = typeof prisma | Prisma.TransactionClient;

// Ultimo dia para responder y pagar: el que puso la administracion o, si no puso, el dia anterior al evento
export const fechaLimiteDe = (evento: Pick<Evento, 'fecha' | 'fechaLimiteInscripcion'>) =>
    evento.fechaLimiteInscripcion ?? new Date(evento.fecha.getTime() - DIA_MS);

export const plazoAbierto = (evento: Pick<Evento, 'requiereAutorizacion' | 'fecha' | 'fechaLimiteInscripcion'>) => {
    const hoy = hoyUTC();
    return evento.requiereAutorizacion && evento.fecha > hoy && fechaLimiteDe(evento) >= hoy;
};

export const costoDe = (evento: Pick<Evento, 'requierePago' | 'costo'>) =>
    evento.requierePago ? Number(evento.costo ?? 0) : 0;

export const cuposOcupados = (eventoId: number, excluirAlumnoId?: number, db: ClienteDb = prisma) =>
    db.inscripcionEvento.count({
        where: {
            eventoId,
            estado: { in: ESTADOS_CON_CUPO },
            ...(excluirAlumnoId ? { alumnoId: { not: excluirAlumnoId } } : {}),
        },
    });

/**
 * Respuesta del encargado a la circular por uno de sus hijos. Se puede cambiar de opinion
 * mientras el plazo siga abierto y no se haya pagado; lo pagado solo se revierte con un reembolso.
 */
export const responderCircular = async (
    usuarioId: number,
    eventoId: number,
    alumnoId: number,
    autoriza: boolean,
): Promise<InscripcionEvento> => {
    const evento = await prisma.evento.findUnique({ where: { eventoId } });
    if (!evento || !evento.requiereAutorizacion) throw new ReglaNegocioError('La circular no existe.', 404);

    const alumno = await prisma.alumno.findUnique({ where: { alumnoId }, select: { seccion: { select: { sedeId: true } } } });
    if (!alumno || (evento.sedeId !== null && evento.sedeId !== alumno.seccion.sedeId)) {
        throw new ReglaNegocioError('Esta circular no es para este alumno.', 404);
    }
    if (!(await esResponsableDe(usuarioId, alumnoId))) {
        throw new ReglaNegocioError('Solo el encargado principal o el responsable financiero puede responder la circular.', 403);
    }
    if (!plazoAbierto(evento)) throw new ReglaNegocioError(`El plazo para responder "${evento.nombre}" ya cerró.`);

    const clave = { eventoId_alumnoId: { eventoId, alumnoId } };
    const previa = await prisma.inscripcionEvento.findUnique({ where: clave });

    if (previa?.estado === ESTADO_AUTORIZACION.CONFIRMADA && Number(previa.monto) > 0) {
        throw new ReglaNegocioError('La participación ya está pagada. Para cancelarla comuníquese con la administración.');
    }

    const respuesta = { respondidoPorId: usuarioId, fechaRespuesta: new Date(), ordenId: null, fechaPago: null };

    if (!autoriza) {
        // Si estaba pagando, ese cobro se cancela para que no se le cobre algo que ya no autorizo
        if (previa?.ordenId) await liberarOrdenesPendientes([previa.ordenId]);
        return prisma.inscripcionEvento.upsert({
            where: clave,
            update: { ...respuesta, estado: ESTADO_AUTORIZACION.NO_AUTORIZADA, monto: 0 },
            create: { ...respuesta, eventoId, alumnoId, estado: ESTADO_AUTORIZACION.NO_AUTORIZADA, monto: 0 },
        });
    }

    if (previa && ESTADOS_CON_CUPO.includes(previa.estado as (typeof ESTADOS_CON_CUPO)[number])) return previa;

    const monto = costoDe(evento);
    const estado = monto > 0 ? ESTADO_AUTORIZACION.AUTORIZADA : ESTADO_AUTORIZACION.CONFIRMADA;

    // Serializable: si dos encargados autorizan a la vez el ultimo cupo, solo uno se lo queda
    try {
        return await prisma.$transaction(async (tx) => {
            if (evento.cupoMaximo !== null && (await cuposOcupados(eventoId, alumnoId, tx)) >= evento.cupoMaximo) {
                throw new ReglaNegocioError(`"${evento.nombre}" ya no tiene cupos disponibles.`);
            }
            return tx.inscripcionEvento.upsert({
                where: clave,
                update: { ...respuesta, estado, monto },
                create: { ...respuesta, eventoId, alumnoId, estado, monto },
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
            throw new ReglaNegocioError('Otro encargado respondió al mismo tiempo. Intente de nuevo.');
        }
        throw error;
    }
};

// Autorizaciones con costo cuyo plazo vencio sin pago: se cancelan y liberan el cupo
export const cancelarVencidas = async () => {
    const hoy = hoyUTC();
    const vencidas = await prisma.inscripcionEvento.findMany({
        where: {
            estado: ESTADO_AUTORIZACION.AUTORIZADA,
            evento: {
                OR: [
                    { fechaLimiteInscripcion: { lt: hoy } },
                    // Sin fecha limite el plazo termina el dia anterior al evento
                    { fechaLimiteInscripcion: null, fecha: { lte: hoy } },
                ],
            },
        },
        select: { inscripcionId: true, ordenId: true },
    });

    let canceladas = 0;
    for (const inscripcion of vencidas) {
        try {
            if (inscripcion.ordenId) await liberarOrdenesPendientes([inscripcion.ordenId]);
            const { count } = await prisma.inscripcionEvento.updateMany({
                where: { inscripcionId: inscripcion.inscripcionId, estado: ESTADO_AUTORIZACION.AUTORIZADA },
                data: { estado: ESTADO_AUTORIZACION.CANCELADA, ordenId: null },
            });
            canceladas += count;
        } catch (error) {
            // Stripe lo esta cobrando justo ahora: se deja, el webhook la confirma
            if (!(error instanceof OrdenEnProcesoError)) throw error;
        }
    }
    if (canceladas > 0) console.log(`📋 Circulares: ${canceladas} autorización(es) vencida(s) sin pago se cancelaron.`);
};

export const iniciarVencimientoCirculares = () => {
    const revisar = () => {
        cancelarVencidas().catch((error) => console.error('❌ Error al cancelar autorizaciones vencidas:', error));
    };
    revisar();
    setInterval(revisar, INTERVALO_VENCIMIENTO_MS).unref();
};

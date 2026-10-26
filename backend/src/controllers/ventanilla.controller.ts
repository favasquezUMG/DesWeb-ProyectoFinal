import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { MESES } from '../config/stripe.config.js';
import { filtroAlumnosVisibles, puedeVerAlumno } from '../services/acceso.service.js';
import { CONCEPTO_COLEGIATURA, ESTADO_NO_APLICA, MESES_CICLO, montoColegiatura } from '../services/colegiaturas.service.js';
import { ESTADO_AUTORIZACION, cancelarIntent, liberarOrdenesPendientes } from '../services/ordenes.service.js';
import { fechaLimiteDe, plazoAbierto } from '../services/circulares.service.js';
import { registrarBitacora } from '../services/bitacora.service.js';

// Pagos en ventanilla: el personal con permiso de pagos (secretaría, administración) registra lo que
// un padre paga en persona (efectivo, POS, depósito o cheque). No pasa por Stripe; el método y la
// referencia del recibo quedan en la bitácora del alumno.

const METODOS = ['Efectivo', 'Tarjeta (POS)', 'Depósito bancario', 'Cheque'] as const;
const ESTADOS_AL_DIA = ['Pagado', 'Exonerado', ESTADO_NO_APLICA];
const MAX_CONCEPTOS = 20;

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) return res.status(error.status).json({ status: 'error', message: error.message });
    return res.status(500).json({ status: 'error', message: mensaje, error: error instanceof Error ? error.message : error });
};

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

/**
 * Busca alumnos de la sede por nombre o correo para cobrarles.
 * GET /api/pagos/ventanilla/alumnos?q=juan
 */
export const buscarAlumnos = async (req: AuthenticatedRequest, res: Response) => {
    const q = String(req.query.q ?? '').trim();
    if (q.length < 2) return res.json({ status: 'success', data: [] });

    try {
        const visibles = await filtroAlumnosVisibles(req, 'pagos');
        if (!visibles) return res.status(403).json({ status: 'error', message: 'No tiene permisos para ver pagos.' });

        const palabras = q.split(/\s+/).filter(Boolean);
        const alumnos = await prisma.alumno.findMany({
            where: {
                ...visibles,
                usuario: {
                    deletedAt: null,
                    // Cada palabra debe aparecer en el nombre, el apellido o el correo ("ana lopez")
                    AND: palabras.map((p) => ({
                        OR: [
                            { nombres: { contains: p, mode: 'insensitive' as const } },
                            { apellidos: { contains: p, mode: 'insensitive' as const } },
                            { email: { contains: p, mode: 'insensitive' as const } },
                        ],
                    })),
                },
            },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { select: { nombre: true, grado: { select: { nombre: true } }, sede: { select: { nombre: true } } } },
            },
            orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
            take: 15,
        });

        return res.json({
            status: 'success',
            data: alumnos.map((a) => ({
                alumnoId: a.alumnoId,
                nombre: nombreDe(a.usuario),
                grado: a.seccion.grado.nombre,
                seccion: a.seccion.nombre,
                sede: a.seccion.sede.nombre,
            })),
        });
    } catch (error) {
        return responderError(res, error, 'Error al buscar alumnos.');
    }
};

/**
 * Eventos que el encargado autorizó y todavía no paga (con plazo abierto), para cobrarlos en ventanilla.
 * GET /api/pagos/ventanilla/:alumnoId/eventos
 */
export const getEventosPendientes = async (req: AuthenticatedRequest, res: Response) => {
    const alumnoId = Number(req.params.alumnoId);
    try {
        if (!(await puedeVerAlumno(req, alumnoId, 'pagos', 'pagos'))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos para ver los pagos de este alumno.' });
        }
        const inscripciones = await prisma.inscripcionEvento.findMany({
            where: { alumnoId, estado: ESTADO_AUTORIZACION.AUTORIZADA },
            include: { evento: true },
            orderBy: { evento: { fecha: 'asc' } },
        });
        return res.json({
            status: 'success',
            data: inscripciones.filter((i) => plazoAbierto(i.evento)).map((i) => ({
                inscripcionId: i.inscripcionId,
                nombre: i.evento.nombre,
                fechaEvento: i.evento.fecha,
                fechaLimite: fechaLimiteDe(i.evento),
                monto: Number(i.monto),
            })),
        });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los eventos pendientes.');
    }
};

/**
 * Registra un pago recibido en ventanilla: colegiaturas y/o eventos autorizados del alumno.
 * El precio lo calcula el servidor (con beca). Si el padre tenía un pago en línea a medias de esos
 * conceptos, se cancela en Stripe para que no se cobren dos veces.
 * POST /api/pagos/ventanilla/:alumnoId
 *   { colegiaturas: [{ anioLectivo, mes }], eventos: [inscripcionId], metodo, referencia? }
 */
export const registrarPagoVentanilla = async (req: AuthenticatedRequest, res: Response) => {
    const alumnoId = Number(req.params.alumnoId);
    const { metodo } = req.body ?? {};
    const referencia = String(req.body?.referencia ?? '').trim().slice(0, 60);
    const colegiaturas: { anioLectivo: number; mes: number }[] = Array.isArray(req.body?.colegiaturas)
        ? req.body.colegiaturas.map((c: any) => ({ anioLectivo: Number(c?.anioLectivo) || new Date().getUTCFullYear(), mes: Number(c?.mes) }))
        : [];
    const eventos: number[] = Array.isArray(req.body?.eventos) ? req.body.eventos.map(Number) : [];

    try {
        if (!METODOS.includes(metodo)) throw new ReglaNegocioError('Seleccione el método de pago.', 400);
        if (metodo !== 'Efectivo' && !referencia) {
            throw new ReglaNegocioError('Indique el número de boleta, voucher o cheque.', 400);
        }
        if (colegiaturas.length + eventos.length === 0) throw new ReglaNegocioError('Seleccione al menos un concepto a cobrar.', 400);
        if (colegiaturas.length + eventos.length > MAX_CONCEPTOS) {
            throw new ReglaNegocioError(`Se pueden cobrar como máximo ${MAX_CONCEPTOS} conceptos a la vez.`, 400);
        }
        if (colegiaturas.some((c) => !Number.isInteger(c.mes) || c.mes < 1 || c.mes > MESES_CICLO)) {
            throw new ReglaNegocioError(`Los meses de colegiatura van del 1 al ${MESES_CICLO}.`, 400);
        }
        if (new Set(colegiaturas.map((c) => `${c.anioLectivo}-${c.mes}`)).size !== colegiaturas.length || new Set(eventos).size !== eventos.length) {
            throw new ReglaNegocioError('Hay conceptos repetidos.', 400);
        }
        if (!(await puedeVerAlumno(req, alumnoId, 'pagos', 'pagos'))) {
            throw new ReglaNegocioError('No tiene permisos para cobrar a este alumno.', 403);
        }

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) throw new ReglaNegocioError(`Alumno con ID: ${alumnoId} no encontrado.`, 404);

        // Validar cada concepto y calcular su precio
        const lineas: { descripcion: string; monto: number }[] = [];
        const ordenesPendientes: number[] = [];
        const intentsSueltos: string[] = [];
        const meses: { anioLectivo: number; mes: number; monto: number }[] = [];

        for (const { anioLectivo, mes } of colegiaturas) {
            const periodo = `${MESES[mes - 1]} ${anioLectivo}`;
            const pago = await prisma.pago.findUnique({
                where: { alumnoId_anioLectivo_mes_concepto: { alumnoId, anioLectivo, mes, concepto: CONCEPTO_COLEGIATURA } },
            });
            if (pago?.estado === ESTADO_NO_APLICA) throw new ReglaNegocioError(`A este alumno no se le cobra ${periodo}.`);
            if (pago && ESTADOS_AL_DIA.includes(pago.estado)) throw new ReglaNegocioError(`La colegiatura de ${periodo} ya está al día.`);
            const monto = await montoColegiatura(alumnoId, anioLectivo, mes);
            if (monto <= 0) throw new ReglaNegocioError(`La colegiatura de ${periodo} está cubierta por beca.`);
            if (pago?.ordenId) ordenesPendientes.push(pago.ordenId);
            if (pago?.stripePaymentId) intentsSueltos.push(pago.stripePaymentId);
            meses.push({ anioLectivo, mes, monto });
            lineas.push({ descripcion: `Colegiatura ${periodo}`, monto });
        }

        for (const inscripcionId of eventos) {
            const inscripcion = await prisma.inscripcionEvento.findUnique({ where: { inscripcionId }, include: { evento: true } });
            if (!inscripcion || inscripcion.alumnoId !== alumnoId) throw new ReglaNegocioError('Uno de los eventos no corresponde a este alumno.', 400);
            if (inscripcion.estado === ESTADO_AUTORIZACION.CONFIRMADA) throw new ReglaNegocioError(`"${inscripcion.evento.nombre}" ya está pagado.`);
            if (inscripcion.estado !== ESTADO_AUTORIZACION.AUTORIZADA) {
                throw new ReglaNegocioError(`La participación en "${inscripcion.evento.nombre}" no está autorizada por el encargado.`);
            }
            if (!plazoAbierto(inscripcion.evento)) throw new ReglaNegocioError(`Venció el plazo para pagar "${inscripcion.evento.nombre}".`);
            if (inscripcion.ordenId) ordenesPendientes.push(inscripcion.ordenId);
            lineas.push({ descripcion: inscripcion.evento.nombre, monto: Number(inscripcion.monto) });
        }

        // Si el padre dejó un pago en línea a medias, se cancela antes de marcar como pagado aquí.
        // Si Stripe ya lo está cobrando, lanza OrdenEnProcesoError (409) y no se registra nada.
        await liberarOrdenesPendientes(ordenesPendientes);
        for (const id of intentsSueltos) await cancelarIntent(id);

        const ahora = new Date();
        await prisma.$transaction(async (tx) => {
            for (const { anioLectivo, mes, monto } of meses) {
                const periodo = { alumnoId_anioLectivo_mes_concepto: { alumnoId, anioLectivo, mes, concepto: CONCEPTO_COLEGIATURA } };
                await tx.pago.upsert({
                    where: periodo,
                    update: { monto, estado: 'Pagado', fechaPago: ahora, ordenId: null, stripePaymentId: null, stripeSessionId: null },
                    create: { alumnoId, monto, concepto: CONCEPTO_COLEGIATURA, anioLectivo, mes, estado: 'Pagado', fechaPago: ahora },
                });
            }
            if (eventos.length) {
                // Condicional: si la autorización cambió mientras tanto, no se marca
                const { count } = await tx.inscripcionEvento.updateMany({
                    where: { inscripcionId: { in: eventos }, estado: ESTADO_AUTORIZACION.AUTORIZADA },
                    data: { estado: ESTADO_AUTORIZACION.CONFIRMADA, fechaPago: ahora, ordenId: null },
                });
                if (count !== eventos.length) throw new ReglaNegocioError('Una de las autorizaciones cambió mientras se registraba el pago. Revise y vuelva a intentarlo.');
            }
        });

        const total = Number(lineas.reduce((suma, l) => suma + l.monto, 0).toFixed(2));
        await registrarBitacora(
            Number(req.user?.id),
            'Pago en ventanilla',
            'Alumno',
            alumnoId,
            `${lineas.map((l) => `${l.descripcion} (Q${l.monto.toFixed(2)})`).join(', ')}. Total Q${total.toFixed(2)}. ` +
            `Método: ${metodo}${referencia ? `, referencia ${referencia}` : ''}.`,
        );

        return res.status(201).json({
            status: 'success',
            message: `Pago de Q${total.toFixed(2)} registrado para ${nombreDe(alumno.usuario)}.`,
            data: { alumno: nombreDe(alumno.usuario), lineas, total, metodo, referencia: referencia || null, fecha: ahora },
        });
    } catch (error) {
        return responderError(res, error, 'Error al registrar el pago.');
    }
};

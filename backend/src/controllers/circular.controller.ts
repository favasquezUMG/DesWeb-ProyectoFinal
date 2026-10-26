import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { hoyUTC } from '../lib/fechas.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { sedeDelAlcance } from '../middlewares/role.middleware.js';
import { esResponsableDe, hijosDe } from '../services/vinculos.service.js';
import { ESTADO_AUTORIZACION } from '../services/ordenes.service.js';
import { costoDe, cuposOcupados, fechaLimiteDe, plazoAbierto, responderCircular } from '../services/circulares.service.js';

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

const responderError = (res: Response, error: any, mensaje: string) => {
    if (error instanceof ReglaNegocioError) return res.status(error.status).json({ status: 'error', message: error.message });
    return res.status(500).json({ status: 'error', message: mensaje, error: error?.message ?? error });
};

/**
 * Circulares de los eventos próximos de la sede de cada hijo, con la respuesta que tiene cada uno.
 * estado null = todavía no responde.
 * GET /api/circulares
 */
export const getMisCirculares = async (req: AuthenticatedRequest, res: Response) => {
    const usuarioId = Number(req.user?.id);

    try {
        const hijos = await prisma.alumno.findMany({
            where: hijosDe(usuarioId),
            include: { usuario: { select: { nombres: true, apellidos: true } }, seccion: { select: { sedeId: true } } },
            orderBy: { alumnoId: 'asc' },
        });
        if (hijos.length === 0) return res.json({ status: 'success', data: [] });

        const ids = hijos.map((h) => h.alumnoId);
        // Responder lo decide el encargado principal o el responsable financiero; pagar, quien ve pagos
        const responsables = new Set<number>();
        for (const id of ids) if (await esResponsableDe(usuarioId, id)) responsables.add(id);
        const conPagos = new Set(
            (await prisma.alumno.findMany({ where: { AND: [{ alumnoId: { in: ids } }, hijosDe(usuarioId, 'pagos')] }, select: { alumnoId: true } }))
                .map((a) => a.alumnoId),
        );

        const sedes = [...new Set(hijos.map((h) => h.seccion.sedeId))];
        const eventos = await prisma.evento.findMany({
            where: {
                requiereAutorizacion: true,
                fecha: { gte: hoyUTC() },
                OR: [{ sedeId: null }, { sedeId: { in: sedes } }],
            },
            include: { inscripciones: { where: { alumnoId: { in: ids } } } },
            orderBy: { fecha: 'asc' },
        });

        const data = await Promise.all(
            eventos.map(async (evento) => {
                const ocupados = evento.cupoMaximo !== null ? await cuposOcupados(evento.eventoId) : 0;
                return {
                    eventoId: evento.eventoId,
                    nombre: evento.nombre,
                    descripcion: evento.descripcion,
                    tipoEvento: evento.tipoEvento,
                    fecha: evento.fecha,
                    fechaLimite: fechaLimiteDe(evento),
                    costo: costoDe(evento),
                    cupoMaximo: evento.cupoMaximo,
                    cuposDisponibles: evento.cupoMaximo !== null ? Math.max(evento.cupoMaximo - ocupados, 0) : null,
                    plazoAbierto: plazoAbierto(evento),
                    alumnos: hijos
                        .filter((h) => evento.sedeId === null || evento.sedeId === h.seccion.sedeId)
                        .map((h) => {
                            const respuesta = evento.inscripciones.find((i) => i.alumnoId === h.alumnoId);
                            return {
                                alumnoId: h.alumnoId,
                                nombre: nombreDe(h.usuario),
                                estado: respuesta?.estado ?? null,
                                inscripcionId: respuesta?.inscripcionId ?? null,
                                monto: respuesta ? Number(respuesta.monto) : null,
                                fechaRespuesta: respuesta?.fechaRespuesta ?? null,
                                puedeResponder: responsables.has(h.alumnoId),
                                puedePagar: conPagos.has(h.alumnoId),
                            };
                        }),
                };
            }),
        );

        return res.json({ status: 'success', data: data.filter((e) => e.alumnos.length > 0) });
    } catch (error) {
        return responderError(res, error, 'Error al obtener las circulares.');
    }
};

/**
 * El encargado autoriza o no la participación de un hijo.
 * POST /api/circulares/:eventoId/respuesta  { alumnoId, autoriza: true | false }
 */
export const responder = async (req: AuthenticatedRequest, res: Response) => {
    const eventoId = Number(req.params.eventoId);
    const alumnoId = Number(req.body?.alumnoId);
    const autoriza = req.body?.autoriza;

    if (!(eventoId > 0) || !(alumnoId > 0) || typeof autoriza !== 'boolean') {
        return res.status(400).json({ status: 'error', message: 'alumnoId y autoriza (true o false) son obligatorios.' });
    }

    try {
        const respuesta = await responderCircular(Number(req.user?.id), eventoId, alumnoId, autoriza);
        const pendientePago = respuesta.estado === ESTADO_AUTORIZACION.AUTORIZADA;
        return res.json({
            status: 'success',
            message: !autoriza
                ? 'Quedó registrado que no autorizó la participación.'
                : pendientePago
                    ? 'Participación autorizada. El cupo queda apartado hasta la fecha límite de pago.'
                    : 'Participación autorizada.',
            data: {
                inscripcionId: respuesta.inscripcionId,
                eventoId: respuesta.eventoId,
                alumnoId: respuesta.alumnoId,
                estado: respuesta.estado,
                monto: Number(respuesta.monto),
                fechaRespuesta: respuesta.fechaRespuesta,
            },
        });
    } catch (error) {
        return responderError(res, error, 'Error al registrar la respuesta.');
    }
};

/**
 * Control de la circular para la administración: cada alumno de la sede con su respuesta.
 * GET /api/circulares/:eventoId/respuestas
 */
export const getRespuestas = async (req: AuthenticatedRequest, res: Response) => {
    const eventoId = Number(req.params.eventoId);

    try {
        const evento = await prisma.evento.findUnique({ where: { eventoId } });
        if (!evento) return res.status(404).json({ status: 'error', message: `Evento con ID: ${eventoId} no encontrado` });
        if (!evento.requiereAutorizacion) {
            return res.status(400).json({ status: 'error', message: 'Este evento no pide autorización a los encargados.' });
        }

        // El personal de sede solo ve a sus alumnos, aunque el evento sea general
        const alcance = await sedeDelAlcance(req);
        if (alcance !== null && evento.sedeId !== null && evento.sedeId !== alcance) {
            return res.status(403).json({ status: 'error', message: 'El evento pertenece a otra sede.' });
        }
        const sedeId = evento.sedeId ?? alcance;

        const alumnos = await prisma.alumno.findMany({
            where: { usuario: { deletedAt: null }, ...(sedeId !== null ? { seccion: { sedeId } } : {}) },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
                eventos: {
                    where: { eventoId },
                    include: { respondidoPor: { select: { nombres: true, apellidos: true } } },
                },
            },
            orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
        });

        const detalle = alumnos.map((a) => {
            const r = a.eventos[0];
            return {
                alumnoId: a.alumnoId,
                alumno: nombreDe(a.usuario),
                grado: `${a.seccion.grado.nombre} ${a.seccion.nombre}`,
                estado: r?.estado ?? null,
                monto: r ? Number(r.monto) : null,
                respondidoPor: r?.respondidoPor ? nombreDe(r.respondidoPor) : null,
                fechaRespuesta: r?.fechaRespuesta ?? null,
                fechaPago: r?.fechaPago ?? null,
            };
        });

        const contar = (estado: string | null) => detalle.filter((d) => d.estado === estado).length;
        const confirmadas = detalle.filter((d) => d.estado === ESTADO_AUTORIZACION.CONFIRMADA);

        return res.json({
            status: 'success',
            data: {
                eventoId: evento.eventoId,
                nombre: evento.nombre,
                fecha: evento.fecha,
                fechaLimite: fechaLimiteDe(evento),
                costo: costoDe(evento),
                cupoMaximo: evento.cupoMaximo,
                resumen: {
                    total: detalle.length,
                    sinRespuesta: contar(null),
                    noAutorizadas: contar(ESTADO_AUTORIZACION.NO_AUTORIZADA),
                    pendientesPago: contar(ESTADO_AUTORIZACION.AUTORIZADA),
                    confirmadas: confirmadas.length,
                    canceladas: contar(ESTADO_AUTORIZACION.CANCELADA),
                    reembolsadas: contar(ESTADO_AUTORIZACION.REEMBOLSADA),
                    recaudado: Number(confirmadas.reduce((suma, d) => suma + (d.monto ?? 0), 0).toFixed(2)),
                },
                detalle,
            },
        });
    } catch (error) {
        return responderError(res, error, 'Error al obtener las respuestas de la circular.');
    }
};

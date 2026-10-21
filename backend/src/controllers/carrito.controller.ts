import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';
import { descuentoColegiatura } from '../services/becas.service.js';
import { puedeVerAlumno } from '../services/acceso.service.js';
import { hijosDe } from '../services/vinculos.service.js';
import { hoyUTC } from '../lib/fechas.js';
import {
    ESTADO_INSCRIPCION,
    OrdenEnProcesoError,
    confirmarOrden,
    cuposOcupados,
    fechaLimiteDe,
    inscripcionAbierta,
    liberarOrdenesPendientes,
} from '../services/carrito.service.js';

const CONCEPTO_COLEGIATURA = 'Colegiatura';
const ESTADOS_AL_DIA = ['Pagado', 'Exonerado'];
const MAX_ITEMS = 20;

type ItemCarrito =
    | { tipo: 'evento'; alumnoId: number; eventoId: number }
    | { tipo: 'colegiatura'; alumnoId: number; anioLectivo: number; mes: number };

// Lo que se va a cobrar, ya validado y con el precio calculado por el servidor
type LineaCobro = ItemCarrito & { monto: number; descripcion: string; alumno: string };

class ErrorCarrito extends Error {
    constructor(public status: number, message: string) {
        super(message);
    }
}

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

/**
 * Eventos con cobro a los que el encargado puede inscribir a sus hijos, con el estado de cada hijo.
 * GET /api/pagos/carrito/eventos
 */
export const getEventosDisponibles = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const hijos = await prisma.alumno.findMany({
            where: hijosDe(Number(req.user?.id), 'pagos'),
            include: { usuario: { select: { nombres: true, apellidos: true } }, seccion: { select: { sedeId: true } } },
            orderBy: { alumnoId: 'asc' },
        });
        if (hijos.length === 0) return res.json({ status: 'success', data: [] });

        const sedes = [...new Set(hijos.map((h) => h.seccion.sedeId))];
        const eventos = await prisma.evento.findMany({
            where: {
                requierePago: true,
                fecha: { gt: hoyUTC() },
                OR: [{ sedeId: null }, { sedeId: { in: sedes } }],
            },
            include: {
                inscripciones: {
                    where: { alumnoId: { in: hijos.map((h) => h.alumnoId) }, estado: { in: [ESTADO_INSCRIPCION.PENDIENTE, ESTADO_INSCRIPCION.CONFIRMADA] } },
                },
            },
            orderBy: { fecha: 'asc' },
        });

        const data = await Promise.all(
            eventos.map(async (evento) => {
                const abierta = inscripcionAbierta(evento);
                const ocupados = evento.cupoMaximo !== null ? await cuposOcupados(evento.eventoId) : 0;
                return {
                    eventoId: evento.eventoId,
                    nombre: evento.nombre,
                    descripcion: evento.descripcion,
                    tipoEvento: evento.tipoEvento,
                    fecha: evento.fecha,
                    fechaLimiteInscripcion: fechaLimiteDe(evento),
                    costo: Number(evento.costo ?? 0),
                    cupoMaximo: evento.cupoMaximo,
                    cuposDisponibles: evento.cupoMaximo !== null ? Math.max(evento.cupoMaximo - ocupados, 0) : null,
                    inscripcionAbierta: abierta,
                    alumnos: hijos
                        .filter((h) => evento.sedeId === null || evento.sedeId === h.seccion.sedeId)
                        .map((h) => {
                            const inscripcion = evento.inscripciones.find((i) => i.alumnoId === h.alumnoId);
                            return {
                                alumnoId: h.alumnoId,
                                nombre: nombreDe(h.usuario),
                                // Pendiente = esta en un carrito que no se ha pagado; se puede volver a pagar
                                inscrito: inscripcion?.estado === ESTADO_INSCRIPCION.CONFIRMADA,
                            };
                        }),
                };
            }),
        );

        // Sin hijos de esa sede no tiene sentido mostrar el evento
        return res.json({ status: 'success', data: data.filter((e) => e.alumnos.length > 0) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los eventos disponibles.', error });
    }
};

const leerItems = (body: unknown): ItemCarrito[] => {
    const items = (body as { items?: unknown })?.items;
    if (!Array.isArray(items) || items.length === 0) throw new ErrorCarrito(400, 'El carrito está vacío.');
    if (items.length > MAX_ITEMS) throw new ErrorCarrito(400, `El carrito admite como máximo ${MAX_ITEMS} conceptos.`);

    const vistos = new Set<string>();
    return items.map((raw: any): ItemCarrito => {
        const alumnoId = Number(raw?.alumnoId);
        let item: ItemCarrito;
        if (raw?.tipo === 'evento' && Number(raw.eventoId) > 0) {
            item = { tipo: 'evento', alumnoId, eventoId: Number(raw.eventoId) };
        } else if (raw?.tipo === 'colegiatura' && Number(raw.mes) >= 1 && Number(raw.mes) <= 12) {
            item = { tipo: 'colegiatura', alumnoId, anioLectivo: Number(raw.anioLectivo) || new Date().getUTCFullYear(), mes: Number(raw.mes) };
        } else {
            throw new ErrorCarrito(400, 'El carrito tiene un concepto inválido.');
        }
        if (!(alumnoId > 0)) throw new ErrorCarrito(400, 'El carrito tiene un concepto sin alumno.');

        const clave = item.tipo === 'evento' ? `e-${item.alumnoId}-${item.eventoId}` : `c-${item.alumnoId}-${item.anioLectivo}-${item.mes}`;
        if (vistos.has(clave)) throw new ErrorCarrito(400, 'El carrito tiene conceptos repetidos.');
        vistos.add(clave);
        return item;
    });
};

// Valida cada concepto y calcula su precio. Tambien junta las ordenes pendientes que hay que reemplazar.
const prepararLineas = async (req: AuthenticatedRequest, items: ItemCarrito[]) => {
    const lineas: LineaCobro[] = [];
    const ordenesAnteriores: number[] = [];
    const intentsSueltos: string[] = [];

    for (const item of items) {
        if (!(await puedeVerAlumno(req, item.alumnoId, 'pagos', 'pagos'))) {
            throw new ErrorCarrito(403, 'No tiene permisos para pagar por uno de los alumnos del carrito.');
        }
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: item.alumnoId },
            include: { usuario: { select: { nombres: true, apellidos: true } }, seccion: { select: { sedeId: true } } },
        });
        if (!alumno) throw new ErrorCarrito(404, `Alumno con ID: ${item.alumnoId} no encontrado.`);
        const nombreAlumno = nombreDe(alumno.usuario);

        if (item.tipo === 'evento') {
            const evento = await prisma.evento.findUnique({ where: { eventoId: item.eventoId } });
            if (!evento) throw new ErrorCarrito(404, 'Uno de los eventos del carrito ya no existe.');
            if (evento.sedeId !== null && evento.sedeId !== alumno.seccion.sedeId) {
                throw new ErrorCarrito(400, `"${evento.nombre}" no es de la sede de ${nombreAlumno}.`);
            }
            if (!inscripcionAbierta(evento)) {
                throw new ErrorCarrito(409, `La inscripción a "${evento.nombre}" ya está cerrada.`);
            }

            const previa = await prisma.inscripcionEvento.findUnique({
                where: { eventoId_alumnoId: { eventoId: evento.eventoId, alumnoId: item.alumnoId } },
            });
            if (previa?.estado === ESTADO_INSCRIPCION.CONFIRMADA) {
                throw new ErrorCarrito(409, `${nombreAlumno} ya está inscrito(a) en "${evento.nombre}".`);
            }
            if (previa?.ordenId) ordenesAnteriores.push(previa.ordenId);

            if (evento.cupoMaximo !== null && (await cuposOcupados(evento.eventoId, item.alumnoId)) >= evento.cupoMaximo) {
                throw new ErrorCarrito(409, `"${evento.nombre}" ya no tiene cupos disponibles.`);
            }

            lineas.push({ ...item, monto: Number(evento.costo), descripcion: evento.nombre, alumno: nombreAlumno });
        } else {
            const pago = await prisma.pago.findUnique({
                where: {
                    alumnoId_anioLectivo_mes_concepto: {
                        alumnoId: item.alumnoId, anioLectivo: item.anioLectivo, mes: item.mes, concepto: CONCEPTO_COLEGIATURA,
                    },
                },
            });
            const periodo = `${MESES[item.mes - 1]} ${item.anioLectivo}`;
            if (pago && ESTADOS_AL_DIA.includes(pago.estado)) {
                throw new ErrorCarrito(409, `La colegiatura de ${periodo} de ${nombreAlumno} ya está al día.`);
            }
            if (pago?.ordenId) ordenesAnteriores.push(pago.ordenId);
            if (pago?.stripePaymentId) intentsSueltos.push(pago.stripePaymentId);

            // La beca y el descuento por hermanos solo aplican a la colegiatura, nunca a los eventos
            const descuento = await descuentoColegiatura(item.alumnoId, new Date(Date.UTC(item.anioLectivo, item.mes - 1, 1)));
            const monto = Number((COLEGIATURA_MENSUAL * (1 - descuento.total / 100)).toFixed(2));
            if (monto <= 0) {
                throw new ErrorCarrito(400, `La colegiatura de ${periodo} de ${nombreAlumno} está cubierta por beca; no hay nada que pagar.`);
            }
            lineas.push({ ...item, monto, descripcion: `Colegiatura ${periodo}`, alumno: nombreAlumno });
        }
    }

    return { lineas, ordenesAnteriores, intentsSueltos };
};

// Un mes que el padre empezo a pagar suelto (sin carrito) tiene su propio PaymentIntent: se cancela
const cancelarIntentsSueltos = async (ids: string[]) => {
    for (const id of ids) {
        const intent = await stripe.paymentIntents.retrieve(id).catch((error: any) => {
            if (error?.code === 'resource_missing') return null;
            throw error;
        });
        if (intent?.status === 'succeeded' || intent?.status === 'processing') {
            throw new OrdenEnProcesoError('Ya hay un pago de una de estas colegiaturas en proceso. Espere a que se confirme.');
        }
        if (intent && intent.status !== 'canceled') await stripe.paymentIntents.cancel(intent.id);
    }
};

/**
 * Crea la orden y el PaymentIntent de todo el carrito. Igual que en el pago de un mes, aquí todo
 * queda Pendiente; lo confirma el webhook (payment_intent.succeeded) o /carrito/verificar.
 * POST /api/pagos/carrito/intent  { items: [{ tipo: 'evento', alumnoId, eventoId } | { tipo: 'colegiatura', alumnoId, anioLectivo, mes }] }
 */
export const crearIntentCarrito = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const items = leerItems(req.body);
        const { lineas, ordenesAnteriores, intentsSueltos } = await prepararLineas(req, items);

        // Lo que ya estaba en otro carrito sin pagar se mueve a este; el anterior se cancela
        await liberarOrdenesPendientes(ordenesAnteriores);
        await cancelarIntentsSueltos(intentsSueltos);

        const total = Number(lineas.reduce((suma, l) => suma + l.monto, 0).toFixed(2));
        const usuarioId = Number(req.user?.id);

        const orden = await prisma.$transaction(async (tx) => {
            const nueva = await tx.ordenPago.create({ data: { usuarioId, total } });

            for (const linea of lineas) {
                if (linea.tipo === 'evento') {
                    await tx.inscripcionEvento.upsert({
                        where: { eventoId_alumnoId: { eventoId: linea.eventoId, alumnoId: linea.alumnoId } },
                        update: { monto: linea.monto, estado: ESTADO_INSCRIPCION.PENDIENTE, ordenId: nueva.ordenId, createdAt: new Date(), fechaPago: null },
                        create: { eventoId: linea.eventoId, alumnoId: linea.alumnoId, monto: linea.monto, ordenId: nueva.ordenId },
                    });
                } else {
                    const periodo = {
                        alumnoId_anioLectivo_mes_concepto: {
                            alumnoId: linea.alumnoId, anioLectivo: linea.anioLectivo, mes: linea.mes, concepto: CONCEPTO_COLEGIATURA,
                        },
                    };
                    await tx.pago.upsert({
                        where: periodo,
                        update: { monto: linea.monto, estado: 'Pendiente', ordenId: nueva.ordenId, stripePaymentId: null },
                        create: {
                            alumnoId: linea.alumnoId, monto: linea.monto, concepto: CONCEPTO_COLEGIATURA,
                            anioLectivo: linea.anioLectivo, mes: linea.mes, ordenId: nueva.ordenId,
                        },
                    });
                }
            }
            return nueva;
        });

        const pagador = await prisma.usuario.findUnique({ where: { usuarioId }, select: { email: true } });
        // Si Stripe falla, la orden recien creada se cancela para que no deje conceptos ni cupos apartados
        const intent = await stripe.paymentIntents.create({
            amount: aCentavos(total),
            currency: MONEDA,
            payment_method_types: ['card'],
            description: `Orden #${orden.ordenId} — ${lineas.length} concepto(s)`,
            receipt_email: pagador?.email,
            // El webhook usa ordenId para saber que confirmar
            metadata: { ordenId: String(orden.ordenId) },
        }).catch(async (error) => {
            await liberarOrdenesPendientes([orden.ordenId]).catch(() => null);
            throw error;
        });

        await prisma.ordenPago.update({ where: { ordenId: orden.ordenId }, data: { stripePaymentId: intent.id } });

        return res.status(201).json({
            status: 'success',
            data: {
                ordenId: orden.ordenId,
                clientSecret: intent.client_secret,
                paymentIntentId: intent.id,
                total,
                lineas: lineas.map((l) => ({
                    tipo: l.tipo,
                    alumnoId: l.alumnoId,
                    alumno: l.alumno,
                    descripcion: l.descripcion,
                    monto: l.monto,
                })),
            },
        });
    } catch (error: any) {
        if (error instanceof ErrorCarrito) return res.status(error.status).json({ status: 'error', message: error.message });
        if (error instanceof OrdenEnProcesoError) return res.status(409).json({ status: 'error', message: error.message });
        return res.status(500).json({ status: 'error', message: 'Error al preparar el pago del carrito.', error: error?.message ?? error });
    }
};

/**
 * Estado real del cobro en Stripe; si ya se cobró y el webhook no ha llegado, confirma la orden aquí.
 * GET /api/pagos/carrito/verificar/:paymentIntentId
 */
export const verificarCarrito = async (req: AuthenticatedRequest, res: Response) => {
    const paymentIntentId = String(req.params.paymentIntentId);

    try {
        const orden = await prisma.ordenPago.findUnique({ where: { stripePaymentId: paymentIntentId } });
        if (!orden || orden.usuarioId !== Number(req.user?.id)) {
            return res.status(404).json({ status: 'error', message: 'No se encontró la orden de pago.' });
        }

        const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (intent.status === 'succeeded') await confirmarOrden(paymentIntentId);

        const actualizada = await prisma.ordenPago.findUnique({ where: { ordenId: orden.ordenId } });
        return res.json({
            status: 'success',
            data: {
                pagado: intent.status === 'succeeded',
                estadoStripe: intent.status,
                estadoLocal: actualizada?.estado ?? orden.estado,
                monto: intent.amount / 100,
                fechaPago: actualizada?.fechaPago ?? null,
            },
        });
    } catch (error: any) {
        return res.status(500).json({ status: 'error', message: 'Error al verificar el pago.', error: error?.message ?? error });
    }
};

/**
 * Inscripciones del encargado a eventos (pagadas), para mostrarlas en su panel.
 * GET /api/pagos/carrito/inscripciones
 */
export const getMisInscripciones = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const inscripciones = await prisma.inscripcionEvento.findMany({
            where: {
                estado: { in: [ESTADO_INSCRIPCION.CONFIRMADA, ESTADO_INSCRIPCION.REEMBOLSADA] },
                alumno: hijosDe(Number(req.user?.id), 'pagos'),
            },
            include: {
                evento: { select: { nombre: true, fecha: true } },
                alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
            },
            orderBy: { evento: { fecha: 'desc' } },
        });

        return res.json({
            status: 'success',
            data: inscripciones.map((i) => ({
                inscripcionId: i.inscripcionId,
                eventoId: i.eventoId,
                evento: i.evento.nombre,
                fecha: i.evento.fecha,
                alumnoId: i.alumnoId,
                alumno: nombreDe(i.alumno.usuario),
                monto: Number(i.monto),
                estado: i.estado,
                fechaPago: i.fechaPago,
            })),
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las inscripciones.', error });
    }
};

import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';
import { descuentoColegiatura } from '../services/becas.service.js';
import { puedeVerAlumno } from '../services/acceso.service.js';
import { hijosDe } from '../services/vinculos.service.js';
import { ESTADO_AUTORIZACION, cancelarIntent, confirmarOrden, liberarOrdenesPendientes } from '../services/ordenes.service.js';
import { fechaLimiteDe, plazoAbierto } from '../services/circulares.service.js';

// Cobros del encargado: lo que tiene pendiente (colegiaturas y eventos que autorizo) y el pago de
// varios de esos conceptos juntos en una sola orden (un solo PaymentIntent de Stripe).

const CONCEPTO_COLEGIATURA = 'Colegiatura';
const ESTADOS_AL_DIA = ['Pagado', 'Exonerado'];
const MESES_CICLO = 10; // enero a octubre
const MAX_ITEMS = 20;

type ItemOrden =
    | { tipo: 'colegiatura'; alumnoId: number; anioLectivo: number; mes: number }
    | { tipo: 'evento'; inscripcionId: number };

// Lo que se va a cobrar, ya validado y con el precio calculado por el servidor
type LineaCobro = { item: ItemOrden; alumnoId: number; monto: number; descripcion: string; alumno: string };

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

const montoColegiatura = async (alumnoId: number, anioLectivo: number, mes: number) => {
    const descuento = await descuentoColegiatura(alumnoId, new Date(Date.UTC(anioLectivo, mes - 1, 1)));
    return Number((COLEGIATURA_MENSUAL * (1 - descuento.total / 100)).toFixed(2));
};

/**
 * Todo lo que el encargado tiene por pagar de sus hijos: colegiaturas vencidas y del mes, y los
 * eventos que autorizo y todavia no paga (con su fecha limite). Las colegiaturas futuras se
 * adelantan desde el estado de cuenta.
 * GET /api/pagos/pendientes
 */
export const getPendientes = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const hijos = await prisma.alumno.findMany({
            where: hijosDe(Number(req.user?.id), 'pagos'),
            include: { usuario: { select: { nombres: true, apellidos: true } } },
            orderBy: { alumnoId: 'asc' },
        });
        if (hijos.length === 0) return res.json({ status: 'success', data: [] });

        const anio = new Date().getUTCFullYear();
        const mesActual = Math.min(new Date().getUTCMonth() + 1, MESES_CICLO);
        const ids = hijos.map((h) => h.alumnoId);

        const pagos = await prisma.pago.findMany({
            where: { alumnoId: { in: ids }, anioLectivo: anio, concepto: CONCEPTO_COLEGIATURA, estado: { in: ESTADOS_AL_DIA } },
            select: { alumnoId: true, mes: true },
        });
        const alDia = new Set(pagos.map((p) => `${p.alumnoId}-${p.mes}`));

        const colegiaturas = [];
        for (const hijo of hijos) {
            for (let mes = 1; mes <= mesActual; mes++) {
                if (alDia.has(`${hijo.alumnoId}-${mes}`)) continue;
                const monto = await montoColegiatura(hijo.alumnoId, anio, mes);
                if (monto <= 0) continue; // cubierto por beca
                colegiaturas.push({
                    tipo: 'colegiatura' as const,
                    alumnoId: hijo.alumnoId,
                    alumno: nombreDe(hijo.usuario),
                    anioLectivo: anio,
                    mes,
                    descripcion: `Colegiatura ${MESES[mes - 1]} ${anio}`,
                    monto,
                    vencido: mes < mesActual,
                });
            }
        }

        const autorizadas = await prisma.inscripcionEvento.findMany({
            where: { alumnoId: { in: ids }, estado: ESTADO_AUTORIZACION.AUTORIZADA },
            include: { evento: true },
            orderBy: { evento: { fecha: 'asc' } },
        });
        const nombres = new Map(hijos.map((h) => [h.alumnoId, nombreDe(h.usuario)]));
        const eventos = autorizadas
            .filter((i) => plazoAbierto(i.evento))
            .map((i) => ({
                tipo: 'evento' as const,
                inscripcionId: i.inscripcionId,
                eventoId: i.eventoId,
                alumnoId: i.alumnoId,
                alumno: nombres.get(i.alumnoId) ?? '',
                descripcion: i.evento.nombre,
                fechaEvento: i.evento.fecha,
                fechaLimite: fechaLimiteDe(i.evento),
                monto: Number(i.monto),
            }));

        return res.json({ status: 'success', data: [...eventos, ...colegiaturas] });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los pagos pendientes.', error });
    }
};

const leerItems = (body: unknown): ItemOrden[] => {
    const items = (body as { items?: unknown })?.items;
    if (!Array.isArray(items) || items.length === 0) throw new ReglaNegocioError('No eligió ningún concepto para pagar.', 400);
    if (items.length > MAX_ITEMS) throw new ReglaNegocioError(`Se pueden pagar como máximo ${MAX_ITEMS} conceptos a la vez.`, 400);

    const vistos = new Set<string>();
    return items.map((raw: any): ItemOrden => {
        let item: ItemOrden;
        let clave: string;
        if (raw?.tipo === 'evento' && Number(raw.inscripcionId) > 0) {
            item = { tipo: 'evento', inscripcionId: Number(raw.inscripcionId) };
            clave = `e-${item.inscripcionId}`;
        } else if (raw?.tipo === 'colegiatura' && Number(raw.alumnoId) > 0 && Number(raw.mes) >= 1 && Number(raw.mes) <= 12) {
            item = {
                tipo: 'colegiatura',
                alumnoId: Number(raw.alumnoId),
                anioLectivo: Number(raw.anioLectivo) || new Date().getUTCFullYear(),
                mes: Number(raw.mes),
            };
            clave = `c-${item.alumnoId}-${item.anioLectivo}-${item.mes}`;
        } else {
            throw new ReglaNegocioError('Uno de los conceptos a pagar es inválido.', 400);
        }
        if (vistos.has(clave)) throw new ReglaNegocioError('Hay conceptos repetidos.', 400);
        vistos.add(clave);
        return item;
    });
};

// Valida cada concepto y calcula su precio. Tambien junta las ordenes pendientes que hay que reemplazar.
const prepararLineas = async (req: AuthenticatedRequest, items: ItemOrden[]) => {
    const lineas: LineaCobro[] = [];
    const ordenesAnteriores: number[] = [];
    const intentsSueltos: string[] = [];

    for (const item of items) {
        if (item.tipo === 'evento') {
            const inscripcion = await prisma.inscripcionEvento.findUnique({
                where: { inscripcionId: item.inscripcionId },
                include: { evento: true, alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
            });
            if (!inscripcion) throw new ReglaNegocioError('Uno de los eventos ya no está disponible.', 404);
            if (!(await puedeVerAlumno(req, inscripcion.alumnoId, 'pagos', 'pagos'))) {
                throw new ReglaNegocioError('No tiene permisos para pagar por uno de los alumnos.', 403);
            }
            const nombreAlumno = nombreDe(inscripcion.alumno.usuario);
            const evento = inscripcion.evento;
            if (inscripcion.estado === ESTADO_AUTORIZACION.CONFIRMADA) {
                throw new ReglaNegocioError(`"${evento.nombre}" de ${nombreAlumno} ya está pagado.`);
            }
            if (inscripcion.estado !== ESTADO_AUTORIZACION.AUTORIZADA) {
                throw new ReglaNegocioError(`La participación de ${nombreAlumno} en "${evento.nombre}" no está autorizada.`);
            }
            if (!plazoAbierto(evento)) {
                throw new ReglaNegocioError(`Venció el plazo para pagar "${evento.nombre}".`);
            }
            if (inscripcion.ordenId) ordenesAnteriores.push(inscripcion.ordenId);

            // El precio es el que tenia el evento cuando se autorizo
            lineas.push({ item, alumnoId: inscripcion.alumnoId, monto: Number(inscripcion.monto), descripcion: evento.nombre, alumno: nombreAlumno });
        } else {
            if (!(await puedeVerAlumno(req, item.alumnoId, 'pagos', 'pagos'))) {
                throw new ReglaNegocioError('No tiene permisos para pagar por uno de los alumnos.', 403);
            }
            const alumno = await prisma.alumno.findUnique({
                where: { alumnoId: item.alumnoId },
                include: { usuario: { select: { nombres: true, apellidos: true } } },
            });
            if (!alumno) throw new ReglaNegocioError(`Alumno con ID: ${item.alumnoId} no encontrado.`, 404);
            const nombreAlumno = nombreDe(alumno.usuario);

            const pago = await prisma.pago.findUnique({
                where: {
                    alumnoId_anioLectivo_mes_concepto: {
                        alumnoId: item.alumnoId, anioLectivo: item.anioLectivo, mes: item.mes, concepto: CONCEPTO_COLEGIATURA,
                    },
                },
            });
            const periodo = `${MESES[item.mes - 1]} ${item.anioLectivo}`;
            if (pago && ESTADOS_AL_DIA.includes(pago.estado)) {
                throw new ReglaNegocioError(`La colegiatura de ${periodo} de ${nombreAlumno} ya está al día.`);
            }
            if (pago?.ordenId) ordenesAnteriores.push(pago.ordenId);
            if (pago?.stripePaymentId) intentsSueltos.push(pago.stripePaymentId);

            // La beca y el descuento por hermanos solo aplican a la colegiatura, nunca a los eventos
            const monto = await montoColegiatura(item.alumnoId, item.anioLectivo, item.mes);
            if (monto <= 0) {
                throw new ReglaNegocioError(`La colegiatura de ${periodo} de ${nombreAlumno} está cubierta por beca; no hay nada que pagar.`, 400);
            }
            lineas.push({ item, alumnoId: item.alumnoId, monto, descripcion: `Colegiatura ${periodo}`, alumno: nombreAlumno });
        }
    }

    return { lineas, ordenesAnteriores, intentsSueltos };
};

/**
 * Crea la orden y el PaymentIntent de los conceptos que el encargado eligio. Igual que en el pago
 * de un mes, aquí todo queda Pendiente; lo confirma el webhook (payment_intent.succeeded) o /orden/verificar.
 * POST /api/pagos/orden/intent  { items: [{ tipo: 'colegiatura', alumnoId, anioLectivo, mes } | { tipo: 'evento', inscripcionId }] }
 */
export const crearIntentOrden = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const items = leerItems(req.body);
        const { lineas, ordenesAnteriores, intentsSueltos } = await prepararLineas(req, items);

        // Lo que ya estaba en otro intento de pago sin terminar se mueve a esta orden; el anterior se cancela
        await liberarOrdenesPendientes(ordenesAnteriores);
        // Un mes que el padre empezo a pagar suelto tiene su propio PaymentIntent
        for (const id of intentsSueltos) await cancelarIntent(id);

        const total = Number(lineas.reduce((suma, l) => suma + l.monto, 0).toFixed(2));
        const usuarioId = Number(req.user?.id);

        const orden = await prisma.$transaction(async (tx) => {
            const nueva = await tx.ordenPago.create({ data: { usuarioId, total } });

            for (const { item, monto } of lineas) {
                if (item.tipo === 'evento') {
                    // Condicional: si la autorizacion cambio mientras tanto (vencio, la retiraron), no se cobra
                    const { count } = await tx.inscripcionEvento.updateMany({
                        where: { inscripcionId: item.inscripcionId, estado: ESTADO_AUTORIZACION.AUTORIZADA },
                        data: { ordenId: nueva.ordenId },
                    });
                    if (count === 0) throw new ReglaNegocioError('Una de las autorizaciones cambió mientras preparaba el pago. Revise y vuelva a intentarlo.');
                } else {
                    const periodo = {
                        alumnoId_anioLectivo_mes_concepto: {
                            alumnoId: item.alumnoId, anioLectivo: item.anioLectivo, mes: item.mes, concepto: CONCEPTO_COLEGIATURA,
                        },
                    };
                    await tx.pago.upsert({
                        where: periodo,
                        update: { monto, estado: 'Pendiente', ordenId: nueva.ordenId, stripePaymentId: null },
                        create: {
                            alumnoId: item.alumnoId, monto, concepto: CONCEPTO_COLEGIATURA,
                            anioLectivo: item.anioLectivo, mes: item.mes, ordenId: nueva.ordenId,
                        },
                    });
                }
            }
            return nueva;
        });

        const pagador = await prisma.usuario.findUnique({ where: { usuarioId }, select: { email: true } });
        // Si Stripe falla, la orden recien creada se cancela para que no deje conceptos apartados
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
                    tipo: l.item.tipo,
                    alumnoId: l.alumnoId,
                    alumno: l.alumno,
                    descripcion: l.descripcion,
                    monto: l.monto,
                })),
            },
        });
    } catch (error: any) {
        if (error instanceof ReglaNegocioError) return res.status(error.status).json({ status: 'error', message: error.message });
        return res.status(500).json({ status: 'error', message: 'Error al preparar el pago.', error: error?.message ?? error });
    }
};

/**
 * Estado real del cobro en Stripe; si ya se cobró y el webhook no ha llegado, confirma la orden aquí.
 * GET /api/pagos/orden/verificar/:paymentIntentId
 */
export const verificarOrden = async (req: AuthenticatedRequest, res: Response) => {
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

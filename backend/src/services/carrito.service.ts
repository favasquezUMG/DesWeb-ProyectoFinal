import type { Evento } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hoyUTC } from '../lib/fechas.js';
import { stripe } from '../config/stripe.config.js';
import { enviarComprobanteEnSegundoPlano, enviarComprobanteOrden } from './comprobante.service.js';

// Reglas del carrito de pagos: eventos con cobro + colegiaturas en un solo cobro de Stripe.
// Las usan carrito.controller, el webhook de Stripe y el pago de un solo mes.

const ESTADO_ORDEN = { PENDIENTE: 'Pendiente', PAGADA: 'Pagada', CANCELADA: 'Cancelada', REEMBOLSADA: 'Reembolsada' } as const;
export const ESTADO_INSCRIPCION = { PENDIENTE: 'Pendiente', CONFIRMADA: 'Confirmada', CANCELADA: 'Cancelada', REEMBOLSADA: 'Reembolsada' } as const;

// Una inscripcion pendiente aparta el cupo mientras el padre paga; pasado este tiempo se libera
export const RESERVA_MINUTOS = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

// Ultimo dia para inscribirse: el que puso la administracion o, si no puso, el dia anterior al evento
export const fechaLimiteDe = (evento: Pick<Evento, 'fecha' | 'fechaLimiteInscripcion'>) =>
    evento.fechaLimiteInscripcion ?? new Date(evento.fecha.getTime() - DIA_MS);

export const inscripcionAbierta = (evento: Pick<Evento, 'requierePago' | 'costo' | 'fecha' | 'fechaLimiteInscripcion'>) => {
    const hoy = hoyUTC();
    return evento.requierePago && Number(evento.costo ?? 0) > 0 && evento.fecha > hoy && fechaLimiteDe(evento) >= hoy;
};

// Cupos tomados: inscripciones pagadas + las pendientes que todavia estan dentro de su reserva
export const cuposOcupados = async (eventoId: number, excluirAlumnoId?: number) => {
    const limiteReserva = new Date(Date.now() - RESERVA_MINUTOS * 60 * 1000);
    return prisma.inscripcionEvento.count({
        where: {
            eventoId,
            ...(excluirAlumnoId ? { alumnoId: { not: excluirAlumnoId } } : {}),
            OR: [
                { estado: ESTADO_INSCRIPCION.CONFIRMADA },
                { estado: ESTADO_INSCRIPCION.PENDIENTE, createdAt: { gte: limiteReserva } },
            ],
        },
    });
};

export class OrdenEnProcesoError extends Error {}

/**
 * Deja sin efecto ordenes pendientes porque el padre armo un carrito nuevo (o paga un mes suelto)
 * con algo que ya estaba en ellas. Se cancela su PaymentIntent para que no se pueda cobrar dos
 * veces lo mismo, las inscripciones sueltan su cupo y las colegiaturas quedan sin orden.
 * Si Stripe ya esta cobrando alguna, no se toca nada y se lanza OrdenEnProcesoError.
 */
export const liberarOrdenesPendientes = async (ordenIds: number[]) => {
    const ordenes = await prisma.ordenPago.findMany({
        where: { ordenId: { in: [...new Set(ordenIds)] }, estado: ESTADO_ORDEN.PENDIENTE },
    });

    for (const orden of ordenes) {
        if (!orden.stripePaymentId) continue;
        const intent = await stripe.paymentIntents.retrieve(orden.stripePaymentId).catch((error: any) => {
            if (error?.code === 'resource_missing') return null;
            throw error;
        });
        if (intent?.status === 'succeeded' || intent?.status === 'processing') {
            throw new OrdenEnProcesoError('Ya hay un pago de estos conceptos en proceso. Espere a que se confirme.');
        }
        if (intent && intent.status !== 'canceled') await stripe.paymentIntents.cancel(intent.id);
    }

    const ids = ordenes.map((o) => o.ordenId);
    if (ids.length === 0) return;

    await prisma.$transaction([
        prisma.inscripcionEvento.updateMany({
            where: { ordenId: { in: ids }, estado: ESTADO_INSCRIPCION.PENDIENTE },
            data: { estado: ESTADO_INSCRIPCION.CANCELADA, ordenId: null },
        }),
        prisma.pago.updateMany({ where: { ordenId: { in: ids }, estado: 'Pendiente' }, data: { ordenId: null } }),
        prisma.ordenPago.updateMany({ where: { ordenId: { in: ids } }, data: { estado: ESTADO_ORDEN.CANCELADA } }),
    ]);
};

/**
 * Marca como pagado todo lo de la orden y envia el comprobante por correo. Idempotente: el webhook
 * de Stripe puede llegar varias veces y /carrito/verificar tambien puede haberlo hecho (incluso al
 * mismo tiempo; el updateMany condicional deja pasar solo a uno). Devuelve false si ya estaba pagada.
 */
export const confirmarOrden = async (stripePaymentId: string) => {
    const ahora = new Date();
    const ordenId = await prisma.$transaction(async (tx) => {
        const orden = await tx.ordenPago.findUnique({ where: { stripePaymentId } });
        if (!orden) return null;

        const { count } = await tx.ordenPago.updateMany({
            where: { ordenId: orden.ordenId, estado: { not: ESTADO_ORDEN.PAGADA } },
            data: { estado: ESTADO_ORDEN.PAGADA, fechaPago: ahora },
        });
        if (count === 0) return null;

        await tx.pago.updateMany({
            where: { ordenId: orden.ordenId, estado: { not: 'Pagado' } },
            data: { estado: 'Pagado', fechaPago: ahora },
        });
        await tx.inscripcionEvento.updateMany({
            where: { ordenId: orden.ordenId },
            data: { estado: ESTADO_INSCRIPCION.CONFIRMADA, fechaPago: ahora },
        });
        return orden.ordenId;
    });

    if (ordenId === null) return false;
    enviarComprobanteEnSegundoPlano(() => enviarComprobanteOrden(ordenId));
    return true;
};

// Reembolso hecho desde el panel de Stripe: se revierte todo lo que cubria la orden
export const reembolsarOrden = async (stripePaymentId: string) => {
    const orden = await prisma.ordenPago.findUnique({ where: { stripePaymentId } });
    if (!orden) return false;

    await prisma.$transaction([
        prisma.ordenPago.update({ where: { ordenId: orden.ordenId }, data: { estado: ESTADO_ORDEN.REEMBOLSADA } }),
        prisma.pago.updateMany({ where: { ordenId: orden.ordenId }, data: { estado: 'Reembolsado' } }),
        prisma.inscripcionEvento.updateMany({ where: { ordenId: orden.ordenId }, data: { estado: ESTADO_INSCRIPCION.REEMBOLSADA } }),
    ]);
    return true;
};

import { prisma } from '../lib/prisma.js';
import { stripe } from '../config/stripe.config.js';
import { ReglaNegocioError } from '../lib/errores.js';
import { enviarComprobanteEnSegundoPlano, enviarComprobanteOrden } from './comprobante.service.js';

// Ordenes de pago: varios conceptos (colegiaturas y eventos autorizados) en un solo cobro de Stripe.
// Las usan cobro.controller, el webhook de Stripe, el pago de un solo mes y las circulares.

export const ESTADO_ORDEN = { PENDIENTE: 'Pendiente', PAGADA: 'Pagada', CANCELADA: 'Cancelada', REEMBOLSADA: 'Reembolsada' } as const;

// Respuesta a la circular de un evento (InscripcionEvento). Sin registro = sin respuesta.
export const ESTADO_AUTORIZACION = {
    AUTORIZADA: 'Autorizada', // con costo, pendiente de pago
    CONFIRMADA: 'Confirmada', // pagada, o autorizada si es gratis
    NO_AUTORIZADA: 'NoAutorizada',
    CANCELADA: 'Cancelada', // vencio sin pagar
    REEMBOLSADA: 'Reembolsada',
} as const;

// 409: el controlador lo responde como cualquier ReglaNegocioError
export class OrdenEnProcesoError extends ReglaNegocioError {}

/**
 * Cancela un PaymentIntent para que no se pueda cobrar. Si ya no existe en Stripe no pasa nada;
 * si Stripe ya lo esta cobrando, lanza OrdenEnProcesoError.
 */
export const cancelarIntent = async (paymentIntentId: string) => {
    const intent = await stripe.paymentIntents.retrieve(paymentIntentId).catch((error: any) => {
        if (error?.code === 'resource_missing') return null;
        throw error;
    });
    if (intent?.status === 'succeeded' || intent?.status === 'processing') {
        throw new OrdenEnProcesoError('Ya hay un pago de estos conceptos en proceso. Espere a que se confirme.');
    }
    if (intent && intent.status !== 'canceled') await stripe.paymentIntents.cancel(intent.id);
};

/**
 * Deja sin efecto ordenes pendientes porque el padre va a pagar de nuevo (o deja de autorizar)
 * algo que ya estaba en ellas. Se cancela su PaymentIntent para que no se pueda cobrar dos veces
 * lo mismo; las colegiaturas y los eventos quedan sin orden, como estaban antes de intentar pagar
 * (el evento sigue autorizado y con su cupo). Si Stripe ya esta cobrando alguna, no se toca nada.
 */
export const liberarOrdenesPendientes = async (ordenIds: number[]) => {
    const ordenes = await prisma.ordenPago.findMany({
        where: { ordenId: { in: [...new Set(ordenIds)] }, estado: ESTADO_ORDEN.PENDIENTE },
    });

    for (const orden of ordenes) {
        if (orden.stripePaymentId) await cancelarIntent(orden.stripePaymentId);
    }

    const ids = ordenes.map((o) => o.ordenId);
    if (ids.length === 0) return;

    await prisma.$transaction([
        prisma.inscripcionEvento.updateMany({
            where: { ordenId: { in: ids }, estado: ESTADO_AUTORIZACION.AUTORIZADA },
            data: { ordenId: null },
        }),
        prisma.pago.updateMany({ where: { ordenId: { in: ids }, estado: 'Pendiente' }, data: { ordenId: null } }),
        prisma.ordenPago.updateMany({ where: { ordenId: { in: ids } }, data: { estado: ESTADO_ORDEN.CANCELADA } }),
    ]);
};

/**
 * Marca como pagado todo lo de la orden y envia el comprobante por correo. Idempotente: el webhook
 * de Stripe puede llegar varias veces y /orden/verificar tambien puede haberlo hecho (incluso al
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
        // Stripe ya cobro: aunque la autorizacion se haya cancelado mientras tanto, el alumno queda confirmado
        await tx.inscripcionEvento.updateMany({
            where: { ordenId: orden.ordenId },
            data: { estado: ESTADO_AUTORIZACION.CONFIRMADA, fechaPago: ahora },
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
        prisma.inscripcionEvento.updateMany({ where: { ordenId: orden.ordenId }, data: { estado: ESTADO_AUTORIZACION.REEMBOLSADA } }),
    ]);
    return true;
};

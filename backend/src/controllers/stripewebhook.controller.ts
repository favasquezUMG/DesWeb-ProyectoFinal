import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { stripe } from '../config/stripe.config.js';
import type Stripe from 'stripe';
import { confirmarOrden, reembolsarOrden } from '../services/ordenes.service.js';
import { enviarComprobanteEnSegundoPlano, enviarComprobantePago } from '../services/comprobante.service.js';

/**
 * Webhook de Stripe. ESTO es lo que marca una colegiatura como pagada,
 * no el redirect del navegador: el usuario puede cerrar la ventana antes
 * de ver la confirmación, y el pago igual se completó.
 *
 * REQUISITO: esta ruta necesita el body CRUDO (Buffer), no parseado.
 * express.json() rompe la verificación de firma. Por eso en server.ts se
 * monta con express.raw() ANTES del express.json() global.
 */
export const stripeWebhook = async (req: Request, res: Response) => {
    const firma = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET no está configurada.');
        return res.status(500).send('Webhook no configurado');
    }

    let evento: Stripe.Event;

    try {
        evento = stripe.webhooks.constructEvent(req.body, firma as string, webhookSecret);
    } catch (error: any) {
        console.error('Firma de webhook inválida:', error?.message);
        return res.status(400).send(`Webhook Error: ${error?.message}`);
    }

    try {
        switch (evento.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = evento.data.object as Stripe.PaymentIntent;

                // Pago de una orden: confirma todo lo que incluye (colegiaturas y eventos)
                if (paymentIntent.metadata?.ordenId) {
                    const confirmada = await confirmarOrden(paymentIntent.id);
                    console.log(confirmada
                        ? `✅ Orden #${paymentIntent.metadata.ordenId} pagada`
                        : `Evento repetido ignorado: ${paymentIntent.id}`);
                    break;
                }

                const { alumnoId, anioLectivo, mes, concepto } = paymentIntent.metadata ?? {};

                if (!alumnoId || !anioLectivo || !mes || !concepto) {
                    console.error('Webhook sin metadata completa:', paymentIntent.id);
                    break;
                }

                // Idempotencia: Stripe reintenta el mismo evento varias veces,
                // y /verificar también puede haberlo marcado ya. Solo se
                // actualiza si todavía no está pagado.
                const resultado = await prisma.pago.updateMany({
                    where: {
                        alumnoId: Number(alumnoId),
                        anioLectivo: Number(anioLectivo),
                        mes: Number(mes),
                        concepto,
                        estado: { not: 'Pagado' },
                    },
                    data: {
                        estado: 'Pagado',
                        fechaPago: new Date(),
                        stripePaymentId: paymentIntent.id,
                    },
                });

                if (resultado.count === 0) {
                    console.log(`Evento repetido ignorado: ${paymentIntent.id}`);
                    break;
                }

                console.log(`✅ Pago confirmado: alumno ${alumnoId}, mes ${mes}/${anioLectivo}`);
                enviarComprobanteEnSegundoPlano(() => enviarComprobantePago(paymentIntent.id));
                break;
            }

            case 'payment_intent.payment_failed': {
                const paymentIntent = evento.data.object as Stripe.PaymentIntent;

                // El pago se queda en Pendiente para que puedan reintentar
                // con otra tarjeta; solo se deja constancia del motivo.
                console.log(
                    `Pago rechazado: ${paymentIntent.id} — ${paymentIntent.last_payment_error?.message ?? 'sin detalle'}`,
                );
                break;
            }

            case 'charge.refunded': {
                const charge = evento.data.object as Stripe.Charge;
                const paymentIntentId =
                    typeof charge.payment_intent === 'string'
                        ? charge.payment_intent
                        : charge.payment_intent?.id;

                // Stripe manda este evento también en reembolsos parciales; solo se revierte
                // el pago cuando ya se devolvió todo el cargo.
                if (!charge.refunded) {
                    console.log(`Reembolso parcial de ${charge.amount_refunded / 100} en ${paymentIntentId}; no se cambia el estado.`);
                    break;
                }

                if (paymentIntentId) {
                    await reembolsarOrden(paymentIntentId);
                    await prisma.pago.updateMany({
                        where: { stripePaymentId: paymentIntentId },
                        data: { estado: 'Reembolsado' },
                    });
                    console.log(`Pago reembolsado: ${paymentIntentId}`);
                }
                break;
            }

            default:
                break;
        }

        return res.json({ received: true });
    } catch (error: any) {
        // Se responde 500 para que Stripe reintente el evento. Es seguro porque
        // todos los casos de arriba son idempotentes.
        console.error('Error procesando webhook:', error?.message ?? error);
        return res.status(500).json({ received: false, error: 'procesamiento fallido' });
    }
};
import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { stripe } from '../config/stripe.config.js';
import type Stripe from 'stripe';

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
        // La firma confirma que el evento viene de Stripe y no de
        // alguien que descubrió la URL del endpoint.
        evento = stripe.webhooks.constructEvent(req.body, firma as string, webhookSecret);
    } catch (error: any) {
        console.error('Firma de webhook inválida:', error?.message);
        return res.status(400).send(`Webhook Error: ${error?.message}`);
    }

    try {
        switch (evento.type) {
            case 'payment_intent.succeeded': {
                const paymentIntent = evento.data.object as Stripe.PaymentIntent;
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

                if (paymentIntentId) {
                    await prisma.pago.updateMany({
                        where: { stripePaymentId: paymentIntentId },
                        data: { estado: 'Reembolsado' },
                    });
                    console.log(`Pago reembolsado: ${paymentIntentId}`);
                }
                break;
            }

            default:
                // Stripe manda muchos tipos de evento; los que no interesan se ignoran.
                break;
        }

        // Siempre 200: si se responde con error, Stripe sigue reintentando.
        return res.json({ received: true });
    } catch (error: any) {
        console.error('Error procesando webhook:', error?.message ?? error);
        // Se responde 200 igual para que Stripe no reintente en bucle un
        // evento que nuestro código no puede procesar.
        return res.json({ received: true, error: 'procesamiento fallido' });
    }
};
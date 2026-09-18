import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { stripe } from '../config/stripe.config.js';
import type Stripe from 'stripe';

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
            case 'checkout.session.completed': {
                const session = evento.data.object as Stripe.Checkout.Session;

                if (session.payment_status !== 'paid') break;

                const { alumnoId, anioLectivo, mes, concepto } = session.metadata ?? {};

                if (!alumnoId || !anioLectivo || !mes || !concepto) {
                    console.error('Webhook sin metadata completa:', session.id);
                    break;
                }

                const paymentIntentId =
                    typeof session.payment_intent === 'string'
                        ? session.payment_intent
                        : session.payment_intent?.id;

                if (paymentIntentId) {
                    const yaRegistrado = await prisma.pago.findUnique({
                        where: { stripePaymentId: paymentIntentId },
                    });
                    if (yaRegistrado) {
                        console.log(`Evento repetido ignorado: ${paymentIntentId}`);
                        break;
                    }
                }

                await prisma.pago.update({
                    where: {
                        alumnoId_anioLectivo_mes_concepto: {
                            alumnoId: Number(alumnoId),
                            anioLectivo: Number(anioLectivo),
                            mes: Number(mes),
                            concepto,
                        },
                    },
                    data: {
                        estado: 'Pagado',
                        fechaPago: new Date(),
                        stripePaymentId: paymentIntentId ?? null,
                    },
                });

                console.log(`✅ Pago confirmado: alumno ${alumnoId}, mes ${mes}/${anioLectivo}`);
                break;
            }

            case 'checkout.session.expired': {
                const session = evento.data.object as Stripe.Checkout.Session;

                await prisma.pago.updateMany({
                    where: { stripeSessionId: session.id, estado: 'Pendiente' },
                    data: { estado: 'Pendiente' },
                });

                console.log(`Sesión expirada: ${session.id}`);
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
                break;
        }

        return res.json({ received: true });
    } catch (error: any) {
        console.error('Error procesando webhook:', error?.message ?? error);
        return res.json({ received: true, error: 'procesamiento fallido' });
    }
};
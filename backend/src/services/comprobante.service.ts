import type Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { stripe, MESES } from '../config/stripe.config.js';
import { sendMail } from './mail.service.js';
import { plantillaComprobantePago } from '../templates/mail.templates.js';

// Correo con el comprobante de un pago confirmado. Se llama solo cuando el pago pasa a Pagado
// (confirmarOrden o el updateMany condicional), asi que el webhook y /verificar no lo duplican.

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;
const seleccionNombre = { select: { usuario: { select: { nombres: true, apellidos: true } } } } as const;

// "Visa •••• 4242" a partir del cargo del PaymentIntent (recuperado con expand: latest_charge)
const tarjetaDe = (intent: Stripe.PaymentIntent) => {
    const card = (intent.latest_charge as Stripe.Charge | null)?.payment_method_details?.card;
    if (!card) return null;
    const marca = card.brand ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1) : 'Tarjeta';
    return `${marca} •••• ${card.last4}`;
};

const buscarIntent = (paymentIntentId: string) =>
    stripe.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] });

// El correo que el padre escribio en el formulario de pago llega como receipt_email al confirmar.
// Si no hay (o Stripe no responde), se usa el correo de la cuenta.
const correoDestino = (intent: Stripe.PaymentIntent | null, correoCuenta: string) =>
    intent?.receipt_email?.trim() || correoCuenta;

export const enviarComprobanteOrden = async (ordenId: number) => {
    const orden = await prisma.ordenPago.findUnique({
        where: { ordenId },
        include: {
            usuario: { select: { usuarioId: true, email: true, nombres: true, apellidos: true } },
            pagos: { include: { alumno: seleccionNombre }, orderBy: [{ anioLectivo: 'asc' }, { mes: 'asc' }] },
            inscripciones: { include: { evento: { select: { nombre: true } }, alumno: seleccionNombre } },
        },
    });
    if (!orden || !orden.stripePaymentId) return;

    const conceptos = [
        ...orden.pagos.map((p) => ({
            descripcion: `${p.concepto} ${MESES[p.mes - 1]} ${p.anioLectivo}`,
            alumno: nombreDe(p.alumno.usuario),
            monto: Number(p.monto),
        })),
        ...orden.inscripciones.map((i) => ({
            descripcion: `Evento: ${i.evento.nombre}`,
            alumno: nombreDe(i.alumno.usuario),
            monto: Number(i.monto),
        })),
    ];

    // Si Stripe no responde, el comprobante sale sin la tarjeta y va al correo de la cuenta
    const intent = await buscarIntent(orden.stripePaymentId).catch(() => null);

    const { subject, html } = plantillaComprobantePago({
        nombreDestinatario: nombreDe(orden.usuario),
        numero: `ORD-${String(orden.ordenId).padStart(6, '0')}`,
        fechaPago: orden.fechaPago ?? new Date(),
        conceptos,
        total: Number(orden.total),
        referencia: orden.stripePaymentId,
        tarjeta: intent ? tarjetaDe(intent) : null,
    });

    await sendMail({
        to: correoDestino(intent, orden.usuario.email),
        subject,
        html,
        usuarioId: orden.usuario.usuarioId,
        mensaje: `Pago recibido por Q${Number(orden.total).toFixed(2)} (${conceptos.length} concepto(s)).`,
        tipo: 'Pago',
    });
};

// Pago de un mes suelto (sin carrito). El que pago viene en la metadata del PaymentIntent.
export const enviarComprobantePago = async (stripePaymentId: string) => {
    const pago = await prisma.pago.findUnique({ where: { stripePaymentId }, include: { alumno: seleccionNombre } });
    if (!pago) return;

    const intent = await buscarIntent(stripePaymentId);
    const usuarioId = Number(intent.metadata?.usuarioId);
    // Intents creados antes de guardar usuarioId en la metadata: se busca por el correo del recibo
    // (en esos intents el receipt_email siempre era el de la cuenta)
    const pagador = await prisma.usuario.findFirst({
        where: usuarioId > 0 ? { usuarioId } : { email: intent.receipt_email ?? '' },
        select: { usuarioId: true, email: true, nombres: true, apellidos: true },
    });
    if (!pagador) return;

    const descripcion = `${pago.concepto} ${MESES[pago.mes - 1]} ${pago.anioLectivo}`;

    const { subject, html } = plantillaComprobantePago({
        nombreDestinatario: nombreDe(pagador),
        numero: `PAG-${String(pago.pagoId).padStart(6, '0')}`,
        fechaPago: pago.fechaPago ?? new Date(),
        conceptos: [{ descripcion, alumno: nombreDe(pago.alumno.usuario), monto: Number(pago.monto) }],
        total: Number(pago.monto),
        referencia: stripePaymentId,
        tarjeta: tarjetaDe(intent),
    });

    await sendMail({
        to: correoDestino(intent, pagador.email),
        subject,
        html,
        usuarioId: pagador.usuarioId,
        mensaje: `Pago recibido por Q${Number(pago.monto).toFixed(2)}: ${descripcion}.`,
        tipo: 'Pago',
    });
};

// El correo nunca debe tumbar la confirmacion del pago ni retrasar la respuesta
export const enviarComprobanteEnSegundoPlano = (envio: () => Promise<void>) => {
    envio().catch((error) => console.error('❌ Error al enviar el comprobante de pago:', error));
};

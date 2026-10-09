import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY no está configurada. El módulo de pagos no va a funcionar.');
}

export const stripe = secretKey ? new Stripe(secretKey, {}) : (null as unknown as Stripe);

export const aCentavos = (monto: number): number => Math.round(monto * 100);

export const aQuetzales = (centavos: number): number => centavos / 100;

export const MONEDA = 'gtq';

export const COLEGIATURA_MENSUAL = Number(process.env.COLEGIATURA_MENSUAL ?? 500);

export const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
import Stripe from 'stripe';

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
    console.warn('⚠️  STRIPE_SECRET_KEY no está configurada. El módulo de pagos no va a funcionar.');
}

export const stripe = new Stripe(secretKey ?? '', {
});

/**
 * Stripe trabaja con la unidad mínima de la moneda: para GTQ son centavos.
 * Q500.00 se manda como 50000. Nunca se manda un decimal.
 */
export const aCentavos = (monto: number): number => Math.round(monto * 100);

export const aQuetzales = (centavos: number): number => centavos / 100;

export const MONEDA = 'gtq';

/** Monto base de la colegiatura mensual, en quetzales. */
export const COLEGIATURA_MENSUAL = Number(process.env.COLEGIATURA_MENSUAL ?? 500);

export const MESES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
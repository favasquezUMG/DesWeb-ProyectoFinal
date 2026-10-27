import type { Prisma } from '@prisma/client';
import { COLEGIATURA_MENSUAL } from '../config/stripe.config.js';
import { descuentoColegiatura } from './becas.service.js';

// Meses del ciclo en los que no se cobra colegiatura a un alumno. Se guardan como un Pago con
// estado "No aplica" y monto 0: cuentan como al dia (no generan mora ni aparecen por pagar).
// Caso tipico: un alumno que llega de otro colegio a mitad de año solo paga desde que se inscribio.

export const CONCEPTO_COLEGIATURA = 'Colegiatura';
export const ESTADO_NO_APLICA = 'No aplica';
export const MESES_CICLO = 10; // enero a octubre

/**
 * Meses que ya pasaron cuando el alumno entra al ciclo `anioLectivo`. El mes en que se inscribe
 * si se cobra; si quedo inscrito tarde dentro del mes, la sede puede quitarlo a mano.
 * Inscribirse antes de que empiece el ciclo (noviembre/diciembre del año anterior) no deja ninguno.
 */
export const mesesAntesDeIngresar = (anioLectivo: number, fecha = new Date()): number[] => {
    const anio = fecha.getUTCFullYear();
    if (anioLectivo > anio) return [];
    const hasta = anioLectivo < anio ? MESES_CICLO : Math.min(fecha.getUTCMonth(), MESES_CICLO);
    return Array.from({ length: hasta }, (_, i) => i + 1);
};

/**
 * Deja sin cobro los meses anteriores al ingreso del alumno. No toca un mes que ya tenga
 * registro (pagado, exonerado o con un pago en curso).
 */
export const quitarCobroAntesDeIngresar = async (tx: Prisma.TransactionClient, alumnoId: number, anioLectivo: number) => {
    const meses = mesesAntesDeIngresar(anioLectivo);
    if (meses.length === 0) return 0;
    const { count } = await tx.pago.createMany({
        data: meses.map((mes) => ({
            alumnoId, anioLectivo, mes, monto: 0, concepto: CONCEPTO_COLEGIATURA, estado: ESTADO_NO_APLICA,
        })),
        skipDuplicates: true,
    });
    return count;
};

/** Lo que toca pagar de colegiatura ese mes, ya con beca y descuento por hermanos */
export const montoColegiatura = async (alumnoId: number, anioLectivo: number, mes: number) => {
    const descuento = await descuentoColegiatura(alumnoId, new Date(Date.UTC(anioLectivo, mes - 1, 1)));
    return Number((COLEGIATURA_MENSUAL * (1 - descuento.total / 100)).toFixed(2));
};

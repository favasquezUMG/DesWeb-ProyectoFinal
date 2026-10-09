import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { esAdministrador } from '../middlewares/role.middleware.js';
import type Stripe from 'stripe';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';

const CONCEPTO_COLEGIATURA = 'Colegiatura';

/**
 * Alumnos cuyos pagos puede ver el usuario que no es administrador: él
 * mismo (si es alumno) y los alumnos que tiene a su cargo (si es encargado).
 */
const getAlumnosPermitidos = async (req: AuthenticatedRequest): Promise<number[]> => {
    const usuarioId = Number(req.user?.usuarioId);
    const relaciones = await prisma.alumnoEncargado.findMany({
        where: { encargadoId: usuarioId },
        select: { alumnoId: true },
    });
    return [usuarioId, ...relaciones.map((r) => r.alumnoId)];
};

/**
 * La administración ve los pagos de cualquier alumno; el resto, solo los
 * de getAlumnosPermitidos. Sin esto, cualquier usuario logueado podría
 * cambiar el ID en la URL y ver el estado de cuenta de otra familia.
 */
const puedeAccederAlumno = async (req: AuthenticatedRequest, alumnoId: number): Promise<boolean> => {
    if (await esAdministrador(req)) return true;
    return (await getAlumnosPermitidos(req)).includes(alumnoId);
};

const SIN_PERMISO = { status: 'error', message: 'No tiene permisos para ver los pagos de este alumno.' };

/**
 * Busca la beca activa del alumno que cubra la fecha dada y devuelve el
 * porcentaje de descuento. El módulo de Becas es de otra persona; aquí solo
 * se lee para calcular el monto a cobrar.
 */
const getDescuento = async (alumnoId: number, fecha: Date): Promise<number> => {
    // TEMPORAL: SQL directo porque la base ya tiene el modelo de becas de
    // main (columna "estado" en vez de "activa") y el schema de esta rama
    // todavía no. Al integrar main, reemplazar por su becas.service.
    const [beca] = await prisma.$queryRaw<{ porcentaje: unknown }[]>`
        SELECT "porcentaje" FROM "Beca"
        WHERE "alumnoId" = ${alumnoId}
          AND "estado" = 'Activa'
          AND "fechaInicio" <= ${fecha}
          AND ("fechaFin" IS NULL OR "fechaFin" >= ${fecha})
        ORDER BY "porcentaje" DESC
        LIMIT 1`;

    return beca ? Number(beca.porcentaje) : 0;
};

/**
 * Calcula cuánto le toca pagar al alumno por un mes, ya con beca aplicada.
 * GET /api/pagos/cotizar/:alumnoId?anioLectivo=2026&mes=9
 */
export const cotizarColegiatura = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId } = req.params;
    const { anioLectivo, mes } = req.query;

    const anio = Number(anioLectivo) || new Date().getUTCFullYear();
    const mesNum = Number(mes) || new Date().getUTCMonth() + 1;

    if (mesNum < 1 || mesNum > 12) {
        return res.status(400).json({ status: 'error', message: 'El mes debe ser un número del 1 al 12' });
    }

    try {
        if (!(await puedeAccederAlumno(req, Number(alumnoId)))) {
            return res.status(403).json(SIN_PERMISO);
        }

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await getDescuento(Number(alumnoId), fechaReferencia);
        const montoBase = COLEGIATURA_MENSUAL;
        const montoFinal = Number((montoBase * (1 - descuento / 100)).toFixed(2));

        // Si ya existe un pago para ese periodo, se reporta su estado
        const pagoExistente = await prisma.pago.findUnique({
            where: {
                alumnoId_anioLectivo_mes_concepto: {
                    alumnoId: Number(alumnoId),
                    anioLectivo: anio,
                    mes: mesNum,
                    concepto: CONCEPTO_COLEGIATURA,
                },
            },
        });

        return res.json({
            status: 'success',
            data: {
                alumno: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                anioLectivo: anio,
                mes: mesNum,
                nombreMes: MESES[mesNum - 1],
                montoBase,
                descuentoPorcentaje: descuento,
                montoFinal,
                yaTienePago: pagoExistente !== null,
                estadoPago: pagoExistente?.estado ?? null,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al cotizar la colegiatura.', error });
    }
};

/**
 * Hijos del encargado logueado. Es lo primero que carga la vista de
 * pagos del padre para saber de quién mostrar el estado de cuenta.
 * GET /api/pagos/mis-hijos
 */
export const getMisHijos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const relaciones = await prisma.alumnoEncargado.findMany({
            where: { encargadoId: Number(req.user?.usuarioId) },
            include: {
                alumno: {
                    include: {
                        usuario: { select: { nombres: true, apellidos: true } },
                        seccion: { include: { grado: true } },
                    },
                },
            },
            orderBy: { esPrincipal: 'desc' },
        });

        return res.json({
            status: 'success',
            data: relaciones.map(({ alumno }) => ({
                alumnoId: alumno.alumnoId,
                nombre: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                grado: alumno.seccion.grado.nombre,
                seccion: alumno.seccion.nombre,
            })),
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los alumnos a su cargo.', error });
    }
};

/** Estados de un PaymentIntent en los que todavía se puede intentar pagar. */
const ESTADOS_REUTILIZABLES: Stripe.PaymentIntent.Status[] = [
    'requires_payment_method',
    'requires_confirmation',
    'requires_action',
];

/**
 * Crea (o reutiliza) el PaymentIntent de Stripe y devuelve su clientSecret.
 * Con ese secreto el frontend monta el formulario de tarjeta (Stripe
 * Elements) dentro de nuestra propia página, sin redirigir a Stripe.
 * POST /api/pagos/intent
 *
 * IMPORTANTE: aquí el pago queda en estado "Pendiente". Lo que lo marca
 * como pagado es el webhook (payment_intent.succeeded), no la respuesta
 * que recibe el navegador al confirmar.
 */
export const crearIntentPago = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, anioLectivo, mes } = req.body;

    if (!alumnoId || !mes) {
        return res.status(400).json({ status: 'error', message: 'alumnoId y mes son obligatorios' });
    }

    const anio = Number(anioLectivo) || new Date().getUTCFullYear();
    const mesNum = Number(mes);

    if (mesNum < 1 || mesNum > 12) {
        return res.status(400).json({ status: 'error', message: 'El mes debe ser un número del 1 al 12' });
    }

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
            },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        // Un encargado solo puede pagar la colegiatura de los alumnos a su cargo
        if (!(await puedeAccederAlumno(req, Number(alumnoId)))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para pagar la colegiatura de este alumno.',
            });
        }

        const periodo = {
            alumnoId_anioLectivo_mes_concepto: {
                alumnoId: Number(alumnoId),
                anioLectivo: anio,
                mes: mesNum,
                concepto: CONCEPTO_COLEGIATURA,
            },
        };

        // No se cobra dos veces el mismo periodo
        const pagoExistente = await prisma.pago.findUnique({ where: periodo });

        if (pagoExistente?.estado === 'Pagado') {
            return res.status(409).json({
                status: 'error',
                message: `La colegiatura de ${MESES[mesNum - 1]} ${anio} ya está pagada.`,
            });
        }

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await getDescuento(Number(alumnoId), fechaReferencia);
        const montoFinal = Number((COLEGIATURA_MENSUAL * (1 - descuento / 100)).toFixed(2));

        if (montoFinal <= 0) {
            return res.status(400).json({
                status: 'error',
                message: 'El monto a pagar es cero (beca del 100%). No se requiere pago.',
            });
        }

        const nombreAlumno = `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`;
        const concepto = `Colegiatura ${MESES[mesNum - 1]} ${anio}`;

        // Si el padre abre el formulario, lo cierra y lo vuelve a abrir, se
        // reutiliza el mismo PaymentIntent en vez de crear uno nuevo cada vez.
        let paymentIntent: Stripe.PaymentIntent | null = null;

        if (pagoExistente?.stripePaymentId) {
            // Solo se ignora el error si el PaymentIntent ya no existe en Stripe
            // (p. ej. se cambió de cuenta o de llaves). Cualquier otro error
            // (red, Stripe caído) corta aquí: crear uno nuevo dejaría vivo el
            // anterior, y si el padre lo tiene abierto en otra pestaña podría
            // pagar los dos.
            const previo = await stripe.paymentIntents
                .retrieve(pagoExistente.stripePaymentId)
                .catch((error: any) => {
                    if (error?.code === 'resource_missing') return null;
                    throw error;
                });

            if (previo?.status === 'succeeded' || previo?.status === 'processing') {
                // Stripe ya lo cobró pero el webhook todavía no llega
                return res.status(409).json({
                    status: 'error',
                    message: `El pago de ${MESES[mesNum - 1]} ${anio} ya se está procesando.`,
                });
            }

            if (previo && ESTADOS_REUTILIZABLES.includes(previo.status)) {
                paymentIntent = previo.amount === aCentavos(montoFinal)
                    ? previo
                    : await stripe.paymentIntents.update(previo.id, { amount: aCentavos(montoFinal) });
            }
        }

        if (!paymentIntent) {
            const pagador = await prisma.usuario.findUnique({
                where: { usuarioId: Number(req.user?.usuarioId) },
                select: { email: true },
            });

            paymentIntent = await stripe.paymentIntents.create({
                amount: aCentavos(montoFinal),
                currency: MONEDA,
                payment_method_types: ['card'],
                description: `${concepto} — ${nombreAlumno}`,
                receipt_email: pagador?.email,
                // Estos datos vuelven en el webhook y son los que permiten
                // saber a qué pago corresponde el evento de Stripe.
                metadata: {
                    alumnoId: String(alumnoId),
                    anioLectivo: String(anio),
                    mes: String(mesNum),
                    concepto: CONCEPTO_COLEGIATURA,
                },
            });
        }

        // Se registra el intento como Pendiente. El webhook lo confirma.
        const pago = await prisma.pago.upsert({
            where: periodo,
            update: {
                monto: montoFinal,
                stripePaymentId: paymentIntent.id,
                estado: 'Pendiente',
            },
            create: {
                alumnoId: Number(alumnoId),
                monto: montoFinal,
                concepto: CONCEPTO_COLEGIATURA,
                anioLectivo: anio,
                mes: mesNum,
                stripePaymentId: paymentIntent.id,
                estado: 'Pendiente',
            },
        });

        return res.status(201).json({
            status: 'success',
            data: {
                pagoId: pago.pagoId,
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
                alumno: nombreAlumno,
                concepto,
                montoBase: COLEGIATURA_MENSUAL,
                descuentoPorcentaje: descuento,
                montoFinal,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'error',
            message: 'Error al iniciar el pago.',
            error: error?.message ?? error,
        });
    }
};

/**
 * Estado de cuenta del alumno: qué meses están pagados y cuáles no.
 * GET /api/pagos/estado-cuenta/:alumnoId?anioLectivo=2026
 */
export const getEstadoCuenta = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId } = req.params;
    const { anioLectivo } = req.query;

    const anio = Number(anioLectivo) || new Date().getUTCFullYear();

    try {
        if (!(await puedeAccederAlumno(req, Number(alumnoId)))) {
            return res.status(403).json(SIN_PERMISO);
        }

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { include: { grado: true } },
            },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const pagos = await prisma.pago.findMany({
            where: { alumnoId: Number(alumnoId), anioLectivo: anio },
        });

        const porMes = new Map(pagos.map((p) => [p.mes, p]));

        // El ciclo escolar en Guatemala va de enero a octubre
        // La beca puede tener vigencia parcial, por eso el descuento se
        // calcula mes por mes y no una sola vez para todo el ciclo.
        const meses = await Promise.all(Array.from({ length: 10 }, async (_, i) => {
            const mes = i + 1;
            const pago = porMes.get(mes);
            const descuento = await getDescuento(Number(alumnoId), new Date(Date.UTC(anio, i, 1)));
            return {
                mes,
                nombreMes: MESES[i],
                estado: pago?.estado ?? 'Sin registrar',
                monto: pago ? Number(pago.monto) : null,
                montoBase: COLEGIATURA_MENSUAL,
                descuentoPorcentaje: descuento,
                montoAPagar: Number((COLEGIATURA_MENSUAL * (1 - descuento / 100)).toFixed(2)),
                fechaPago: pago?.fechaPago ?? null,
            };
        }));

        const pagados = meses.filter((m) => m.estado === 'Pagado');
        const totalPagado = pagados.reduce((suma, m) => suma + (m.monto ?? 0), 0);

        return res.json({
            status: 'success',
            data: {
                alumno: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                grado: alumno.seccion.grado.nombre,
                seccion: alumno.seccion.nombre,
                anioLectivo: anio,
                mesesPagados: pagados.length,
                mesesPendientes: 10 - pagados.length,
                totalPagado: Number(totalPagado.toFixed(2)),
                detalle: meses,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el estado de cuenta.', error });
    }
};

//Get All (filtros: ?alumnoId ?anioLectivo ?mes ?estado)
export const getPagos = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, anioLectivo, mes, estado } = req.query;

    try {
        const where: any = {};
        if (alumnoId) where.alumnoId = Number(alumnoId);
        if (anioLectivo) where.anioLectivo = Number(anioLectivo);
        if (mes) where.mes = Number(mes);
        if (estado) where.estado = estado;

        // Quien no es administrador solo ve los pagos de sus propios alumnos
        if (!(await esAdministrador(req))) {
            const permitidos = await getAlumnosPermitidos(req);
            if (alumnoId && !permitidos.includes(Number(alumnoId))) {
                return res.status(403).json(SIN_PERMISO);
            }
            if (!alumnoId) where.alumnoId = { in: permitidos };
        }

        const pagos = await prisma.pago.findMany({
            where,
            include: {
                alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
            },
            orderBy: [{ anioLectivo: 'desc' }, { mes: 'desc' }],
        });

        return res.json({ status: 'success', data: pagos });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los pagos.', error });
    }
};

//Get by ID
export const getPagoById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const pago = await prisma.pago.findUnique({
            where: { pagoId: Number(id) },
            include: {
                alumno: { include: { usuario: { select: { nombres: true, apellidos: true, email: true } } } },
            },
        });

        if (!pago) {
            return res.status(404).json({ status: 'error', message: `Pago con ID: ${id} no encontrado` });
        }

        if (!(await puedeAccederAlumno(req, pago.alumnoId))) {
            return res.status(403).json(SIN_PERMISO);
        }

        return res.json({ status: 'success', data: pago });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el pago con ID: ${id}.`, error });
    }
};

/**
 * Consulta el estado real de un PaymentIntent en Stripe.
 * GET /api/pagos/verificar/:paymentIntentId
 *
 * El frontend lo llama justo después de confirmar el pago para mostrar
 * el resultado. Si Stripe dice que ya se cobró y el webhook todavía no
 * llegó (o no está corriendo, como pasa en local sin "stripe listen"),
 * se marca como pagado aquí mismo: el dato viene de Stripe, no del
 * navegador, así que es igual de confiable.
 */
export const verificarPago = async (req: AuthenticatedRequest, res: Response) => {
    const paymentIntentId = String(req.params.paymentIntentId);

    try {
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        let pago = await prisma.pago.findUnique({
            where: { stripePaymentId: paymentIntentId },
        });

        if (pago && !(await puedeAccederAlumno(req, pago.alumnoId))) {
            return res.status(403).json(SIN_PERMISO);
        }

        if (paymentIntent.status === 'succeeded' && pago && pago.estado !== 'Pagado') {
            pago = await prisma.pago.update({
                where: { pagoId: pago.pagoId },
                data: { estado: 'Pagado', fechaPago: new Date() },
            });
        }

        return res.json({
            status: 'success',
            data: {
                pagado: paymentIntent.status === 'succeeded',
                estadoStripe: paymentIntent.status,
                estadoLocal: pago?.estado ?? null,
                monto: paymentIntent.amount / 100,
                fechaPago: pago?.fechaPago ?? null,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'error',
            message: 'Error al verificar el pago.',
            error: error?.message ?? error,
        });
    }
};

import type { Response } from 'express';
import type Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';
import { descuentoColegiatura } from '../services/becas.service.js';
import { puedeVerAlumno } from '../services/acceso.service.js';
import { hijosDe } from '../services/vinculos.service.js';
import { sedeDelAlcance } from '../middlewares/role.middleware.js';
import { OrdenEnProcesoError, cancelarIntent, liberarOrdenesPendientes } from '../services/ordenes.service.js';
import { enviarComprobanteEnSegundoPlano, enviarComprobantePago } from '../services/comprobante.service.js';
import { CONCEPTO_COLEGIATURA, ESTADO_NO_APLICA, MESES_CICLO } from '../services/colegiaturas.service.js';
import { registrarBitacora } from '../services/bitacora.service.js';
import { ReglaNegocioError } from '../lib/errores.js';

const sinAcceso = (res: Response) =>
    res.status(403).json({ status: 'error', message: 'No tiene permisos para ver la información de pagos de este alumno.' });

// Mes cubierto al 100% por beca (y/o descuento por hermanos): no se cobra, pero queda registrado
const ESTADO_EXONERADO = 'Exonerado';
// "No aplica": mes en que el alumno no estaba en el colegio (o que la sede decidió no cobrar)
const ESTADOS_AL_DIA = ['Pagado', ESTADO_EXONERADO, ESTADO_NO_APLICA];

const calcularMonto = (descuento: number) => Number((COLEGIATURA_MENSUAL * (1 - descuento / 100)).toFixed(2));

const periodoColegiatura = (alumnoId: number, anioLectivo: number, mes: number) => ({
    alumnoId_anioLectivo_mes_concepto: { alumnoId, anioLectivo, mes, concepto: CONCEPTO_COLEGIATURA },
});

/**
 * Calcula cuánto le toca pagar al alumno por un mes, ya con beca y descuento por hermanos.
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
        if (!(await puedeVerAlumno(req, Number(alumnoId), 'pagos', 'pagos'))) return sinAcceso(res);

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await descuentoColegiatura(Number(alumnoId), fechaReferencia);
        const montoBase = COLEGIATURA_MENSUAL;
        const montoFinal = calcularMonto(descuento.total);

        const pagoExistente = await prisma.pago.findUnique({
            where: periodoColegiatura(Number(alumnoId), anio, mesNum),
        });

        return res.json({
            status: 'success',
            data: {
                alumno: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                anioLectivo: anio,
                mes: mesNum,
                nombreMes: MESES[mesNum - 1],
                montoBase,
                descuentoPorcentaje: descuento.total,
                descuentoBeca: descuento.beca,
                descuentoHermanos: descuento.hermanos,
                programaBeca: descuento.programa,
                topeAplicado: descuento.topeAplicado,
                montoFinal,
                exonerado: montoFinal <= 0,
                yaTienePago: pagoExistente !== null,
                estadoPago: pagoExistente?.estado ?? null,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al cotizar la colegiatura.', error });
    }
};

/**
 * Hijos del encargado logueado a los que tiene permiso de ver pagos. Es lo
 * primero que carga la vista de pagos del padre.
 * GET /api/pagos/mis-hijos
 */
export const getMisHijos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnos = await prisma.alumno.findMany({
            where: hijosDe(Number(req.user?.id), 'pagos'),
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { include: { grado: true } },
            },
            orderBy: { alumnoId: 'asc' },
        });

        return res.json({
            status: 'success',
            data: alumnos.map((alumno) => ({
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
            include: { usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        // El alumno, un encargado con permiso de pagos vigente, o el personal con permiso de
        // pagos en la sede del alumno. Un padre sin acceso a pagos (o con restriccion) no puede.
        if (!(await puedeVerAlumno(req, Number(alumnoId), 'pagos', 'pagos'))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para pagar la colegiatura de este alumno.',
            });
        }

        const periodo = periodoColegiatura(Number(alumnoId), anio, mesNum);

        // No se cobra dos veces el mismo periodo
        const pagoExistente = await prisma.pago.findUnique({ where: periodo });

        if (pagoExistente && ESTADOS_AL_DIA.includes(pagoExistente.estado)) {
            const motivo = pagoExistente.estado === 'Pagado' ? 'ya está pagada'
                : pagoExistente.estado === ESTADO_NO_APLICA ? 'no se le cobra a este alumno'
                : 'ya está exonerada';
            return res.status(409).json({
                status: 'error',
                message: `La colegiatura de ${MESES[mesNum - 1]} ${anio} ${motivo}.`,
            });
        }

        // Si el mes estaba en una orden sin pagar, esa orden se cancela para no cobrarlo dos veces
        if (pagoExistente?.ordenId) await liberarOrdenesPendientes([pagoExistente.ordenId]);

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await descuentoColegiatura(Number(alumnoId), fechaReferencia);
        const montoFinal = calcularMonto(descuento.total);

        // Beca completa: no se manda a Stripe, el mes queda registrado como exonerado
        if (montoFinal <= 0) {
            const exonerado = await prisma.pago.upsert({
                where: periodo,
                update: { monto: 0, estado: ESTADO_EXONERADO, fechaPago: new Date() },
                create: {
                    alumnoId: Number(alumnoId),
                    monto: 0,
                    concepto: CONCEPTO_COLEGIATURA,
                    anioLectivo: anio,
                    mes: mesNum,
                    estado: ESTADO_EXONERADO,
                    fechaPago: new Date(),
                },
            });
            return res.status(200).json({
                status: 'success',
                message: `La colegiatura de ${MESES[mesNum - 1]} ${anio} está cubierta al 100% y quedó registrada como exonerada.`,
                data: { pagoId: exonerado.pagoId, montoFinal: 0, descuentoPorcentaje: descuento.total, exonerado: true, clientSecret: null },
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
                where: { usuarioId: Number(req.user?.id) },
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
                    usuarioId: String(req.user?.id),
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
                descuentoPorcentaje: descuento.total,
                descuentoBeca: descuento.beca,
                descuentoHermanos: descuento.hermanos,
                montoFinal,
                exonerado: false,
            },
        });
    } catch (error: any) {
        if (error instanceof OrdenEnProcesoError) return res.status(409).json({ status: 'error', message: error.message });
        return res.status(500).json({
            status: 'error',
            message: 'Error al iniciar el pago.',
            error: error?.message ?? error,
        });
    }
};

/**
 * Estado de cuenta del alumno: qué meses están pagados, exonerados o pendientes.
 * GET /api/pagos/estado-cuenta/:alumnoId?anioLectivo=2026
 */
export const getEstadoCuenta = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId } = req.params;
    const { anioLectivo } = req.query;

    const anio = Number(anioLectivo) || new Date().getUTCFullYear();

    try {
        if (!(await puedeVerAlumno(req, Number(alumnoId), 'pagos', 'pagos'))) return sinAcceso(res);

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
            where: { alumnoId: Number(alumnoId), anioLectivo: anio, concepto: CONCEPTO_COLEGIATURA },
        });

        const porMes = new Map(pagos.map((p) => [p.mes, p]));

        // El ciclo escolar va de enero a octubre. La beca puede tener vigencia
        // parcial, por eso el descuento se calcula mes por mes.
        const meses = await Promise.all(
            Array.from({ length: MESES_CICLO }, async (_, i) => {
                const mes = i + 1;
                const pago = porMes.get(mes);
                const descuento = (await descuentoColegiatura(Number(alumnoId), new Date(Date.UTC(anio, i, 1)))).total;
                const montoAPagar = calcularMonto(descuento);
                // Un mes sin registro que la beca cubre al 100% no cuenta como pendiente
                const cubierto = !pago && montoAPagar <= 0;
                return {
                    mes,
                    nombreMes: MESES[i],
                    estado: pago?.estado ?? (cubierto ? ESTADO_EXONERADO : 'Sin registrar'),
                    monto: pago ? Number(pago.monto) : cubierto ? 0 : null,
                    montoBase: COLEGIATURA_MENSUAL,
                    descuentoPorcentaje: descuento,
                    montoAPagar,
                    fechaPago: pago?.fechaPago ?? null,
                };
            }),
        );

        const pagados = meses.filter((m) => m.estado === 'Pagado');
        const sinCobro = meses.filter((m) => m.estado === ESTADO_NO_APLICA);
        const alDia = meses.filter((m) => ESTADOS_AL_DIA.includes(m.estado));
        const totalPagado = pagados.reduce((suma, m) => suma + (m.monto ?? 0), 0);

        return res.json({
            status: 'success',
            data: {
                alumno: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                grado: alumno.seccion.grado.nombre,
                seccion: alumno.seccion.nombre,
                anioLectivo: anio,
                mesesPagados: pagados.length,
                mesesExonerados: alDia.length - pagados.length - sinCobro.length,
                mesesSinCobro: sinCobro.length,
                mesesACobrar: MESES_CICLO - sinCobro.length,
                mesesPendientes: MESES_CICLO - alDia.length,
                totalPagado: Number(totalPagado.toFixed(2)),
                detalle: meses,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el estado de cuenta.', error });
    }
};

/**
 * Habilita o deshabilita el cobro de colegiatura de un alumno, mes por mes. Para el alumno que
 * llega con el ciclo empezado, o casos especiales que decide la sede. Recibe la lista completa
 * de meses que NO se cobran: los demás quedan habilitados.
 * PUT /api/pagos/meses-cobro/:alumnoId  { anioLectivo, mesesSinCobro: [1, 2, 3] }
 */
export const setMesesCobro = async (req: AuthenticatedRequest, res: Response) => {
    const alumnoId = Number(req.params.alumnoId);
    const anio = Number(req.body?.anioLectivo) || new Date().getUTCFullYear();
    const lista = req.body?.mesesSinCobro;

    if (!Array.isArray(lista) || lista.some((m) => !Number.isInteger(m) || m < 1 || m > MESES_CICLO)) {
        return res.status(400).json({ status: 'error', message: `mesesSinCobro debe ser una lista de meses del 1 al ${MESES_CICLO}.` });
    }
    const sinCobro = new Set<number>(lista);

    try {
        if (!(await puedeVerAlumno(req, alumnoId, 'pagos', 'pagos'))) return sinAcceso(res);

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });

        const pagos = await prisma.pago.findMany({ where: { alumnoId, anioLectivo: anio, concepto: CONCEPTO_COLEGIATURA } });
        const porMes = new Map(pagos.map((p) => [p.mes, p]));

        const deshabilitar: number[] = [];
        const habilitar: number[] = [];
        for (let mes = 1; mes <= MESES_CICLO; mes++) {
            const estado = porMes.get(mes)?.estado;
            if (sinCobro.has(mes) && estado !== ESTADO_NO_APLICA) {
                // Lo que ya se cobró no se puede quitar: primero hay que reembolsarlo
                if (estado === 'Pagado') {
                    throw new ReglaNegocioError(`${MESES[mes - 1]} ya está pagado; para no cobrarlo hay que reembolsarlo.`);
                }
                deshabilitar.push(mes);
            } else if (!sinCobro.has(mes) && estado === ESTADO_NO_APLICA) {
                habilitar.push(mes);
            }
        }

        // Un mes que el padre empezó a pagar se cancela en Stripe para que ya no se pueda cobrar
        const enCurso = deshabilitar.flatMap((mes) => {
            const pago = porMes.get(mes);
            return pago?.estado === 'Pendiente' ? [pago] : [];
        });
        await liberarOrdenesPendientes(enCurso.flatMap((p) => (p.ordenId ? [p.ordenId] : [])));
        for (const p of enCurso) if (p.stripePaymentId) await cancelarIntent(p.stripePaymentId);

        await prisma.$transaction([
            ...deshabilitar.map((mes) => prisma.pago.upsert({
                where: periodoColegiatura(alumnoId, anio, mes),
                update: { monto: 0, estado: ESTADO_NO_APLICA, ordenId: null, stripePaymentId: null, stripeSessionId: null, fechaPago: null },
                create: { alumnoId, monto: 0, concepto: CONCEPTO_COLEGIATURA, anioLectivo: anio, mes, estado: ESTADO_NO_APLICA },
            })),
            prisma.pago.deleteMany({
                where: { alumnoId, anioLectivo: anio, concepto: CONCEPTO_COLEGIATURA, mes: { in: habilitar }, estado: ESTADO_NO_APLICA },
            }),
        ]);

        const nombres = (meses: number[]) => meses.map((m) => MESES[m - 1]).join(', ');
        const huboCambios = deshabilitar.length > 0 || habilitar.length > 0;
        if (huboCambios) {
            await registrarBitacora(
                Number(req.user?.id),
                'Cobro de colegiatura modificado',
                'Alumno',
                alumnoId,
                [
                    deshabilitar.length ? `Sin cobro: ${nombres(deshabilitar)}` : '',
                    habilitar.length ? `Cobro habilitado: ${nombres(habilitar)}` : '',
                ].filter(Boolean).join('. ') + ` (${anio}).`,
            );
        }

        return res.json({
            status: 'success',
            message: huboCambios
                ? `Se actualizaron los meses de cobro de ${alumno.usuario.nombres} ${alumno.usuario.apellidos}.`
                : 'No hubo cambios.',
            data: { anioLectivo: anio, mesesSinCobro: [...sinCobro].sort((a, b) => a - b) },
        });
    } catch (error: any) {
        if (error instanceof ReglaNegocioError) return res.status(error.status).json({ status: 'error', message: error.message });
        return res.status(500).json({ status: 'error', message: 'Error al actualizar los meses de cobro.', error: error?.message ?? error });
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
        const sedeId = await sedeDelAlcance(req);
        if (sedeId !== null) where.alumno = { seccion: { sedeId } };

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
        if (!(await puedeVerAlumno(req, pago.alumnoId, 'pagos', 'pagos'))) return sinAcceso(res);

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
        let pago = await prisma.pago.findUnique({
            where: { stripePaymentId: paymentIntentId },
        });

        if (!pago) {
            return res.status(404).json({ status: 'error', message: 'No hay un pago registrado con ese identificador.' });
        }
        if (!(await puedeVerAlumno(req, pago.alumnoId, 'pagos', 'pagos'))) return sinAcceso(res);

        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status === 'succeeded' && pago.estado !== 'Pagado') {
            // Condicional: si el webhook lo marco al mismo tiempo, solo uno de los dos envia el comprobante
            const { count } = await prisma.pago.updateMany({
                where: { pagoId: pago.pagoId, estado: { not: 'Pagado' } },
                data: { estado: 'Pagado', fechaPago: new Date() },
            });
            if (count > 0) enviarComprobanteEnSegundoPlano(() => enviarComprobantePago(paymentIntentId));
            pago = (await prisma.pago.findUnique({ where: { pagoId: pago.pagoId } })) ?? pago;
        }

        return res.json({
            status: 'success',
            data: {
                pagado: paymentIntent.status === 'succeeded',
                estadoStripe: paymentIntent.status,
                estadoLocal: pago.estado,
                monto: paymentIntent.amount / 100,
                fechaPago: pago.fechaPago,
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

export const getMoraPagosMetrica = async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const rolAlumno = await prisma.rol.findFirst({
            where: { nombre: "Alumno" },
        });

        if (!rolAlumno) {
            return res.status(400).json({
                status: "error",
                message: "No se encontró el rol 'Alumno'.",
            });
        }

        // 1. Obtener IDs de alumnos activos
        const alumnosActivos = await prisma.usuario.findMany({
            where: {
                rolId: rolAlumno.rolId,
                deletedAt: null,
            },
            select: { usuarioId: true },
        });

        const totalAlumnos = alumnosActivos.length;
        const alumnoIds = alumnosActivos.map((a) => a.usuarioId);

        if (totalAlumnos === 0) {
            return res.json({
                status: "success",
                data: {
                porcentajeMora: 0,
                cuentasPendientes: 0,
                subtexto: "0 cuentas pendientes",
                },
            });
        }

        // 2. Alumnos únicos que tienen al menos un pago pendiente
        const alumnosEnMora = await prisma.pago.groupBy({
            by: ["alumnoId"],
            where: {
                alumnoId: { in: alumnoIds },
                OR: [
                { estado: "Pendiente" },
                { estado: "PENDIENTE" },
                ],
            },
        });

        // 3. Conteo total de cuentas/pagos pendientes en el sistema
        const totalPagosPendientes = await prisma.pago.count({
            where: {
                alumnoId: { in: alumnoIds },
                OR: [
                { estado: "Pendiente" },
                { estado: "PENDIENTE" },
                ],
            },
        });

        const porcentajeMora = Math.round((alumnosEnMora.length / totalAlumnos) * 100);

        return res.json({
            status: "success",
            data: {
                porcentajeMora,
                cuentasPendientes: totalPagosPendientes,
                subtexto: `${totalPagosPendientes} cuentas pendientes`,
            },
        });
    } catch (error) {
        console.error("Error al calcular métrica de mora:", error);
        return res.status(500).json({
            status: "error",
            message: "Error al calcular métricas de mora de pagos.",
        });
    }
};

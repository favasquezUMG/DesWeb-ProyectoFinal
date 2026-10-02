import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';
import { descuentoColegiatura } from '../services/becas.service.js';
import { puedeVerAlumno } from '../services/acceso.service.js';
import { sedeDelAlcance } from '../middlewares/role.middleware.js';

const sinAcceso = (res: Response) =>
    res.status(403).json({ status: 'error', message: 'No tiene permisos para ver la información de pagos de este alumno.' });

const CONCEPTO_COLEGIATURA = 'Colegiatura';

// Mes cubierto al 100% por beca (y/o descuento por hermanos): no se cobra, pero queda registrado
const ESTADO_EXONERADO = 'Exonerado';
const ESTADOS_AL_DIA = ['Pagado', ESTADO_EXONERADO];

const calcularMonto = (descuento: number) => Number((COLEGIATURA_MENSUAL * (1 - descuento / 100)).toFixed(2));

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

export const crearCheckout = async (req: AuthenticatedRequest, res: Response) => {
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
                usuario: { select: { nombres: true, apellidos: true, email: true } },
                seccion: { include: { grado: true } },
            },
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

        if (pagoExistente && ESTADOS_AL_DIA.includes(pagoExistente.estado)) {
            return res.status(409).json({
                status: 'error',
                message: `La colegiatura de ${MESES[mesNum - 1]} ${anio} ya está ${pagoExistente.estado === 'Pagado' ? 'pagada' : 'exonerada'}.`,
            });
        }

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await descuentoColegiatura(Number(alumnoId), fechaReferencia);
        const montoFinal = calcularMonto(descuento.total);

        // Beca completa: no se manda a Stripe, el mes queda registrado como exonerado
        if (montoFinal <= 0) {
            const exonerado = await prisma.pago.upsert({
                where: {
                    alumnoId_anioLectivo_mes_concepto: {
                        alumnoId: Number(alumnoId),
                        anioLectivo: anio,
                        mes: mesNum,
                        concepto: CONCEPTO_COLEGIATURA,
                    },
                },
                update: { monto: 0, estado: ESTADO_EXONERADO, fechaPago: new Date(), stripeSessionId: null },
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
                data: { pagoId: exonerado.pagoId, monto: 0, descuentoAplicado: descuento.total, exonerado: true, checkoutUrl: null },
            });
        }

        const detalleDescuento = [
            descuento.beca > 0 ? `beca del ${descuento.beca}%` : '',
            descuento.hermanos > 0 ? `descuento por hermanos del ${descuento.hermanos}%` : '',
        ].filter(Boolean).join(' + ');
        const descripcion =
            `${alumno.seccion.grado.nombre} sección ${alumno.seccion.nombre}` +
            (detalleDescuento ? ` — ${detalleDescuento} aplicado` : '');

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            customer_email: alumno.usuario.email,
            line_items: [
                {
                    price_data: {
                        currency: MONEDA,
                        product_data: {
                            name: `Colegiatura ${MESES[mesNum - 1]} ${anio}`,
                            description: descripcion,
                        },
                        unit_amount: aCentavos(montoFinal),
                    },
                    quantity: 1,
                },
            ],
            metadata: {
                alumnoId: String(alumnoId),
                anioLectivo: String(anio),
                mes: String(mesNum),
                concepto: CONCEPTO_COLEGIATURA,
            },
            success_url: `${process.env.FRONTEND_URL}/pagos/exito?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.FRONTEND_URL}/pagos/cancelado`,
        });

        const pago = await prisma.pago.upsert({
            where: {
                alumnoId_anioLectivo_mes_concepto: {
                    alumnoId: Number(alumnoId),
                    anioLectivo: anio,
                    mes: mesNum,
                    concepto: CONCEPTO_COLEGIATURA,
                },
            },
            update: {
                monto: montoFinal,
                stripeSessionId: session.id,
                estado: 'Pendiente',
            },
            create: {
                alumnoId: Number(alumnoId),
                monto: montoFinal,
                concepto: CONCEPTO_COLEGIATURA,
                anioLectivo: anio,
                mes: mesNum,
                stripeSessionId: session.id,
                estado: 'Pendiente',
            },
        });

        return res.status(201).json({
            status: 'success',
            data: {
                pagoId: pago.pagoId,
                monto: montoFinal,
                descuentoAplicado: descuento.total,
                exonerado: false,
                checkoutUrl: session.url,
                sessionId: session.id,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'error',
            message: 'Error al crear la sesión de pago.',
            error: error?.message ?? error,
        });
    }
};

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
            where: { alumnoId: Number(alumnoId), anioLectivo: anio },
        });

        const porMes = new Map(pagos.map((p) => [p.mes, p]));

        const meses = await Promise.all(
            Array.from({ length: 10 }, async (_, i) => {
                const mes = i + 1;
                const pago = porMes.get(mes);
                // Un mes sin registro que la beca cubre al 100% no cuenta como pendiente
                const cubierto = !pago && (await descuentoColegiatura(Number(alumnoId), new Date(Date.UTC(anio, i, 1)))).total >= 100;
                return {
                    mes,
                    nombreMes: MESES[i],
                    estado: pago?.estado ?? (cubierto ? ESTADO_EXONERADO : 'Sin registrar'),
                    monto: pago ? Number(pago.monto) : cubierto ? 0 : null,
                    fechaPago: pago?.fechaPago ?? null,
                };
            }),
        );

        const pagados = meses.filter((m) => m.estado === 'Pagado');
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
                mesesExonerados: alDia.length - pagados.length,
                mesesPendientes: 10 - alDia.length,
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
        if (!(await puedeVerAlumno(req, pago.alumnoId, 'pagos', 'pagos'))) return sinAcceso(res);

        return res.json({ status: 'success', data: pago });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el pago con ID: ${id}.`, error });
    }
};

export const verificarSesion = async (req: AuthenticatedRequest, res: Response) => {
    const sessionId = String(req.params.sessionId);

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        const pago = await prisma.pago.findFirst({
            where: { stripeSessionId: sessionId },
        });

        return res.json({
            status: 'success',
            data: {
                pagado: session.payment_status === 'paid',
                estadoStripe: session.payment_status,
                estadoLocal: pago?.estado ?? null,
                monto: session.amount_total ? session.amount_total / 100 : null,
            },
        });
    } catch (error: any) {
        return res.status(500).json({
            status: 'error',
            message: 'Error al verificar la sesión de pago.',
            error: error?.message ?? error,
        });
    }
};
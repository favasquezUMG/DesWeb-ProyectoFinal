import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { stripe, aCentavos, MONEDA, COLEGIATURA_MENSUAL, MESES } from '../config/stripe.config.js';

const CONCEPTO_COLEGIATURA = 'Colegiatura';

const getDescuento = async (alumnoId: number, fecha: Date): Promise<number> => {
    const beca = await prisma.beca.findFirst({
        where: {
            alumnoId,
            activa: true,
            fechaInicio: { lte: fecha },
            OR: [{ fechaFin: null }, { fechaFin: { gte: fecha } }],
        },
        orderBy: { porcentaje: 'desc' },
    });

    return beca ? Number(beca.porcentaje) : 0;
};

export const cotizarColegiatura = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId } = req.params;
    const { anioLectivo, mes } = req.query;

    const anio = Number(anioLectivo) || new Date().getUTCFullYear();
    const mesNum = Number(mes) || new Date().getUTCMonth() + 1;

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

        const fechaReferencia = new Date(Date.UTC(anio, mesNum - 1, 1));
        const descuento = await getDescuento(Number(alumnoId), fechaReferencia);
        const montoBase = COLEGIATURA_MENSUAL;
        const montoFinal = Number((montoBase * (1 - descuento / 100)).toFixed(2));

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
                encargados: true,
            },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const esEncargadoDelAlumno = alumno.encargados.some(
            (e) => e.encargadoId === Number(req.user?.id),
        );
        const esElAlumno = Number(req.user?.id) === Number(alumnoId);

        if (!esEncargadoDelAlumno && !esElAlumno) {
            const rol = await prisma.rol.findUnique({ where: { rolId: Number(req.user?.rolId) } });
            const esAdmin = rol?.nombre?.toLowerCase().includes('admin') ?? false;
            if (!esAdmin) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tiene permisos para pagar la colegiatura de este alumno.',
                });
            }
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

        const descripcion =
            `${alumno.seccion.grado.nombre} sección ${alumno.seccion.nombre}` +
            (descuento > 0 ? ` — beca del ${descuento}% aplicada` : '');

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
                descuentoAplicado: descuento,
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

        const meses = Array.from({ length: 10 }, (_, i) => {
            const mes = i + 1;
            const pago = porMes.get(mes);
            return {
                mes,
                nombreMes: MESES[i],
                estado: pago?.estado ?? 'Sin registrar',
                monto: pago ? Number(pago.monto) : null,
                fechaPago: pago?.fechaPago ?? null,
            };
        });

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
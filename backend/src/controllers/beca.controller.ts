import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { ROL, esAlcanceGlobal, obtenerNombreRol, puedeOperarSede } from '../middlewares/role.middleware.js';
import { esResponsableDe, hijosDe } from '../services/vinculos.service.js';
import { COLEGIATURA_MENSUAL } from '../config/stripe.config.js';
import {
    ESTADO_BECA,
    ESTADOS_BECA,
    ESTADOS_VIGENTES,
    TIPOS_PROGRAMA,
    ReglaBecaError,
    cambiarEstado,
    cuposUsados,
    descuentoColegiatura,
    evaluarRequisitos,
    finDeCiclo,
    finalizarVencidas,
    hoyUTC,
    inicioDeCiclo,
    notificarEncargados,
    obtenerPolitica,
    presupuestoUsado,
    registrarHistorial,
    validarActivacion,
    validarPorcentaje,
    validarPresupuesto,
} from '../services/becas.service.js';

const parseId = (id: unknown): number | null => {
    if (typeof id !== 'string' || !/^\d+$/.test(id)) return null;
    return Number(id);
};

const errorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Error desconocido';
};

const responderError = (res: Response, error: unknown, serverMessage: string) => {
    if (error instanceof ReglaBecaError) {
        return res.status(error.status).json({ status: 'error', message: error.message });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return res.status(409).json({ status: 'error', message: 'Ya existe un programa con ese nombre en la sede para ese ciclo.' });
    }
    return res.status(500).json({ status: 'error', message: serverMessage, error: errorMessage(error) });
};

const anioActual = () => new Date().getUTCFullYear();
const anioDe = (valor: unknown) => Number(valor) || anioActual();

const parseFecha = (valor: unknown, campo: string): Date => {
    const fecha = new Date(String(valor));
    if (isNaN(fecha.getTime())) throw new ReglaBecaError(`La ${campo} no es válida.`, 400);
    return fecha;
};

const validarMotivo = (motivo: unknown): string => {
    const texto = typeof motivo === 'string' ? motivo.trim() : '';
    if (texto.length < 5) throw new ReglaBecaError('Indique el motivo del cambio (mínimo 5 caracteres).', 400);
    return texto;
};

const nombreCompleto = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

// Sede sobre la que trabaja el usuario. El personal de sede solo ve la suya;
// el administrador general puede indicar ?sedeId= (o sedeId en el body) o ver todas (null).
const sedeDeTrabajo = async (req: AuthenticatedRequest): Promise<number | null> => {
    const rol = await obtenerNombreRol(req);
    if (!esAlcanceGlobal(rol)) {
        if (!req.user?.sedeId) throw new ReglaBecaError('Su usuario no tiene una sede asignada.', 403);
        return Number(req.user.sedeId);
    }
    const sedeId = req.body?.sedeId ?? req.query.sedeId;
    return sedeId ? Number(sedeId) : null;
};

const sedeObligatoria = async (req: AuthenticatedRequest): Promise<number> => {
    const sedeId = await sedeDeTrabajo(req);
    if (!sedeId) throw new ReglaBecaError('Indique la sede (sedeId).', 400);
    return sedeId;
};

const verificarSedeDeBeca = async (req: AuthenticatedRequest, becaId: number) => {
    const beca = await prisma.beca.findUnique({
        where: { becaId },
        include: { alumno: { include: { seccion: true } }, programa: true },
    });
    if (!beca) throw new ReglaBecaError(`Beca con ID: ${becaId} no encontrada.`, 404);
    if (!(await puedeOperarSede(req, beca.alumno.seccion.sedeId))) {
        throw new ReglaBecaError('No puede administrar becas de alumnos de otra sede.', 403);
    }
    return beca;
};

const leerId = (req: AuthenticatedRequest): number => {
    const becaId = parseId(req.params.id);
    if (becaId === null) throw new ReglaBecaError(`El ID: ${req.params.id} no es un número válido`, 400);
    return becaId;
};

// Datos del alumno y del programa que necesita el frontend para mostrar la beca
const incluirDetalle = {
    alumno: {
        select: {
            alumnoId: true,
            usuario: { select: { nombres: true, apellidos: true } },
            seccion: { select: { nombre: true, sedeId: true, grado: { select: { nombre: true } } } },
        },
    },
    programa: { select: { programaId: true, nombre: true, tipo: true } },
    solicitadaPor: { select: { nombres: true, apellidos: true } },
} as const;

const incluirHistorial = {
    historial: {
        orderBy: { fecha: 'desc' },
        include: { usuario: { select: { nombres: true, apellidos: true } } },
    },
} as const;

// ===========================================================================
// Becas (administracion)
// ===========================================================================

// GET /all  ?estado ?anioLectivo ?programaId ?alumnoId ?sedeId
export const getBecas = async (req: AuthenticatedRequest, res: Response) => {
    const { estado, anioLectivo, programaId, alumnoId } = req.query;

    try {
        await finalizarVencidas();
        const sedeId = await sedeDeTrabajo(req);

        const where: Prisma.BecaWhereInput = {};
        if (typeof estado === 'string' && estado) where.estado = { in: estado.split(',') };
        if (anioLectivo) where.anioLectivo = Number(anioLectivo);
        if (programaId) where.programaId = Number(programaId);
        if (alumnoId) where.alumnoId = Number(alumnoId);
        if (sedeId) where.alumno = { seccion: { sedeId } };

        const becas = await prisma.beca.findMany({
            where,
            include: incluirDetalle,
            orderBy: [{ alumno: { usuario: { apellidos: 'asc' } } }, { alumno: { usuario: { nombres: 'asc' } } }],
        });

        return res.json({ status: 'success', data: becas });
    } catch (error) {
        return responderError(res, error, 'Error al obtener las becas.');
    }
};

// GET /resumen ?anioLectivo  — cifras para el encabezado de la pantalla de becas
export const getResumen = async (req: AuthenticatedRequest, res: Response) => {
    const anio = anioDe(req.query.anioLectivo);

    try {
        await finalizarVencidas();
        const sedeId = await sedeDeTrabajo(req);

        const conteo = await prisma.beca.groupBy({
            by: ['estado'],
            where: { anioLectivo: anio, ...(sedeId ? { alumno: { seccion: { sedeId } } } : {}) },
            _count: { _all: true },
        });
        const porEstado = Object.fromEntries(ESTADOS_BECA.map((e) => [e, 0]));
        for (const fila of conteo) porEstado[fila.estado] = fila._count._all;

        const politica = sedeId ? await obtenerPolitica(sedeId, anio) : null;
        const usado = await presupuestoUsado(sedeId, anio);

        return res.json({
            status: 'success',
            data: {
                anioLectivo: anio,
                sedeId,
                colegiaturaMensual: COLEGIATURA_MENSUAL,
                politica,
                presupuestoUsado: usado,
                presupuestoDisponible:
                    politica?.presupuestoMensual != null ? Math.max(politica.presupuestoMensual - usado, 0) : null,
                porEstado,
            },
        });
    } catch (error) {
        return responderError(res, error, 'Error al obtener el resumen de becas.');
    }
};

// GET /:id  (incluye el historial de cambios)
export const getBecaById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const becaId = leerId(req);
        await verificarSedeDeBeca(req, becaId);

        const beca = await prisma.beca.findUnique({
            where: { becaId },
            include: { ...incluirDetalle, ...incluirHistorial },
        });

        return res.json({ status: 'success', data: beca });
    } catch (error) {
        return responderError(res, error, `Error al obtener la beca con ID: ${req.params.id}.`);
    }
};

// POST /  — asignacion directa por la administracion (queda Activa)
export const createBeca = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, programaId, porcentaje, descripcion, fechaInicio, fechaFin } = req.body;

    if (!alumnoId || !programaId) {
        return res.status(400).json({ status: 'error', message: 'alumnoId y programaId son obligatorios.' });
    }

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { seccion: true, usuario: { select: { nombres: true, apellidos: true } } },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }
        if (!(await puedeOperarSede(req, alumno.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No puede asignar becas a alumnos de otra sede.' });
        }

        const programa = await prisma.programaBeca.findUnique({ where: { programaId: Number(programaId) } });
        if (!programa) {
            return res.status(404).json({ status: 'error', message: `Programa con ID: ${programaId} no encontrado` });
        }

        const anio = programa.anioLectivo;
        const porcentajeNum = porcentaje !== undefined && porcentaje !== null && porcentaje !== ''
            ? validarPorcentaje(porcentaje)
            : Number(programa.porcentaje);

        const inicio = fechaInicio
            ? parseFecha(fechaInicio, 'fecha de inicio')
            : new Date(Math.max(hoyUTC().getTime(), inicioDeCiclo(anio).getTime()));
        const fin = fechaFin ? parseFecha(fechaFin, 'fecha de fin') : finDeCiclo(anio);
        validarVigencia(inicio, fin, anio);

        await validarActivacion({ alumnoId: alumno.alumnoId, programa, porcentaje: porcentajeNum, anioLectivo: anio });

        const beca = await prisma.beca.create({
            data: {
                alumnoId: alumno.alumnoId,
                programaId: programa.programaId,
                anioLectivo: anio,
                porcentaje: porcentajeNum,
                descripcion: descripcion ? String(descripcion).slice(0, 255) : null,
                fechaInicio: inicio,
                fechaFin: fin,
                estado: ESTADO_BECA.ACTIVA,
            },
            include: incluirDetalle,
        });
        await registrarHistorial(beca.becaId, null, ESTADO_BECA.ACTIVA, 'Beca asignada por la administración.', Number(req.user?.id));

        notificarEncargados(
            alumno.alumnoId,
            'Beca asignada',
            `Se asignó la beca "${programa.nombre}" (${porcentajeNum}% de la colegiatura) a ${nombreCompleto(alumno.usuario)} para el ciclo ${anio}.`,
        );

        return res.status(201).json({ status: 'success', data: beca });
    } catch (error) {
        return responderError(res, error, 'Error al crear la beca.');
    }
};

const validarVigencia = (inicio: Date, fin: Date, anio: number) => {
    if (fin <= inicio) throw new ReglaBecaError('La fecha de fin debe ser posterior a la fecha de inicio.', 400);
    if (inicio < inicioDeCiclo(anio) || fin > finDeCiclo(anio)) {
        throw new ReglaBecaError(`Las fechas deben estar dentro del ciclo lectivo ${anio}. Para el siguiente ciclo use "Renovar".`, 400);
    }
};

// PUT /:id  — solo porcentaje, observaciones y fechas. El alumno y el programa no se cambian:
// si hay que cambiarlos se revoca la beca y se asigna otra.
export const updateBeca = async (req: AuthenticatedRequest, res: Response) => {
    const { porcentaje, descripcion, fechaInicio, fechaFin } = req.body;

    try {
        const becaId = leerId(req);
        const beca = await verificarSedeDeBeca(req, becaId);

        if (!([ESTADO_BECA.SOLICITADA, ...ESTADOS_VIGENTES] as string[]).includes(beca.estado)) {
            return res.status(409).json({ status: 'error', message: `La beca está ${beca.estado.toLowerCase()} y ya no se puede modificar.` });
        }

        const data: Prisma.BecaUpdateInput = {};
        const cambios: string[] = [];

        if (porcentaje !== undefined) {
            const nuevo = validarPorcentaje(porcentaje);
            const anterior = Number(beca.porcentaje);
            if (nuevo !== anterior) {
                if (beca.estado === ESTADO_BECA.ACTIVA && nuevo > anterior) {
                    await validarPresupuesto(beca.alumno.seccion.sedeId, beca.anioLectivo, nuevo, beca.becaId);
                }
                data.porcentaje = nuevo;
                cambios.push(`porcentaje de ${anterior}% a ${nuevo}%`);
            }
        }

        const inicio = fechaInicio !== undefined ? parseFecha(fechaInicio, 'fecha de inicio') : beca.fechaInicio;
        const fin = fechaFin !== undefined && fechaFin ? parseFecha(fechaFin, 'fecha de fin') : beca.fechaFin;
        if (fechaInicio !== undefined || fechaFin !== undefined) {
            validarVigencia(inicio, fin, beca.anioLectivo);
            data.fechaInicio = inicio;
            data.fechaFin = fin;
            cambios.push('vigencia');
        }

        if (descripcion !== undefined) data.descripcion = descripcion ? String(descripcion).slice(0, 255) : null;

        const actualizada = await prisma.beca.update({ where: { becaId }, data, include: incluirDetalle });

        if (cambios.length > 0) {
            await registrarHistorial(becaId, beca.estado, beca.estado, `Se modificó: ${cambios.join(', ')}.`, Number(req.user?.id));
        }

        return res.json({ status: 'success', data: actualizada });
    } catch (error) {
        return responderError(res, error, `Error al actualizar la beca con ID ${req.params.id}.`);
    }
};

const MENSAJE_ESTADO: Record<string, string> = {
    Activa: 'aprobada',
    Rechazada: 'rechazada',
    Suspendida: 'suspendida',
    Revocada: 'revocada',
    Finalizada: 'finalizada',
};

// PATCH /:id/estado  { estado, motivo }  — aprobar, rechazar, suspender, reactivar, revocar
export const cambiarEstadoBeca = async (req: AuthenticatedRequest, res: Response) => {
    const { estado } = req.body;

    try {
        const becaId = leerId(req);
        const beca = await verificarSedeDeBeca(req, becaId);
        const motivo = validarMotivo(req.body.motivo);

        const { anterior, beca: actualizada } = await cambiarEstado(becaId, String(estado), motivo, Number(req.user?.id));

        const accion = anterior === ESTADO_BECA.SUSPENDIDA && estado === ESTADO_BECA.ACTIVA ? 'reactivada' : MENSAJE_ESTADO[estado];
        const programa = beca.programa?.nombre ?? beca.descripcion ?? 'beca';
        notificarEncargados(
            beca.alumnoId,
            `Beca ${accion}`,
            `La beca "${programa}" del ciclo ${beca.anioLectivo} fue ${accion}.\nMotivo: ${motivo}`,
        );

        return res.json({ status: 'success', message: `Beca ${accion}.`, data: actualizada });
    } catch (error) {
        return responderError(res, error, 'Error al cambiar el estado de la beca.');
    }
};

// DELETE /:id  — no se borra: se revoca (se conserva para el historial)
export const deleteBecaById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const becaId = leerId(req);
        const beca = await verificarSedeDeBeca(req, becaId);
        const motivo = typeof req.body?.motivo === 'string' && req.body.motivo.trim()
            ? req.body.motivo.trim()
            : 'Revocada por la administración.';

        await cambiarEstado(becaId, ESTADO_BECA.REVOCADA, motivo, Number(req.user?.id));
        notificarEncargados(
            beca.alumnoId,
            'Beca revocada',
            `La beca "${beca.programa?.nombre ?? beca.descripcion ?? 'beca'}" del ciclo ${beca.anioLectivo} fue revocada.\nMotivo: ${motivo}`,
        );

        return res.json({ status: 'success', message: `Se revocó la beca con ID: ${becaId}.` });
    } catch (error) {
        return responderError(res, error, `Error al revocar la beca con ID: ${req.params.id}.`);
    }
};

// POST /:id/renovar  { anioLectivo?, programaId? }
// Crea la beca del siguiente ciclo en el programa equivalente, volviendo a validar requisitos y cupos.
export const renovarBeca = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const becaId = leerId(req);
        const beca = await verificarSedeDeBeca(req, becaId);

        if (!([ESTADO_BECA.ACTIVA, ESTADO_BECA.FINALIZADA] as string[]).includes(beca.estado)) {
            return res.status(409).json({ status: 'error', message: 'Solo se pueden renovar becas activas o finalizadas.' });
        }

        const anioDestino = Number(req.body.anioLectivo) || beca.anioLectivo + 1;
        if (anioDestino <= beca.anioLectivo) {
            return res.status(400).json({ status: 'error', message: 'El ciclo de renovación debe ser posterior al de la beca.' });
        }

        const programa = req.body.programaId
            ? await prisma.programaBeca.findUnique({ where: { programaId: Number(req.body.programaId) } })
            : beca.programa
              ? await prisma.programaBeca.findUnique({
                    where: {
                        sedeId_anioLectivo_nombre: {
                            sedeId: beca.programa.sedeId,
                            anioLectivo: anioDestino,
                            nombre: beca.programa.nombre,
                        },
                    },
                })
              : null;

        if (!programa) {
            return res.status(404).json({
                status: 'error',
                message: beca.programa
                    ? `No existe el programa "${beca.programa.nombre}" para el ciclo ${anioDestino}. Créelo primero.`
                    : 'Indique el programa (programaId) del nuevo ciclo.',
            });
        }

        const porcentaje = Number(programa.porcentaje);
        await validarActivacion({ alumnoId: beca.alumnoId, programa, porcentaje, anioLectivo: anioDestino });

        const nueva = await prisma.beca.create({
            data: {
                alumnoId: beca.alumnoId,
                programaId: programa.programaId,
                anioLectivo: anioDestino,
                porcentaje,
                descripcion: beca.descripcion,
                fechaInicio: inicioDeCiclo(anioDestino),
                fechaFin: finDeCiclo(anioDestino),
                estado: ESTADO_BECA.ACTIVA,
            },
            include: incluirDetalle,
        });
        await registrarHistorial(
            nueva.becaId,
            null,
            ESTADO_BECA.ACTIVA,
            `Renovación de la beca #${beca.becaId} del ciclo ${beca.anioLectivo}.`,
            Number(req.user?.id),
        );

        notificarEncargados(
            beca.alumnoId,
            'Beca renovada',
            `La beca "${programa.nombre}" (${porcentaje}%) fue renovada para el ciclo ${anioDestino}.`,
        );

        return res.status(201).json({ status: 'success', data: nueva });
    } catch (error) {
        return responderError(res, error, 'Error al renovar la beca.');
    }
};

// POST /evaluar  { anioLectivo? }  — suspende las becas cuyos alumnos ya no cumplen los requisitos
export const evaluarBecas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sedeId = await sedeDeTrabajo(req);
        const resultado = await evaluarRequisitos(sedeId, anioDe(req.body?.anioLectivo), Number(req.user?.id));

        return res.json({
            status: 'success',
            message: resultado.suspendidas.length === 0
                ? `Se revisaron ${resultado.revisadas} becas activas; todas cumplen los requisitos.`
                : `Se revisaron ${resultado.revisadas} becas activas y se suspendieron ${resultado.suspendidas.length}.`,
            data: resultado,
        });
    } catch (error) {
        return responderError(res, error, 'Error al evaluar los requisitos de las becas.');
    }
};

// ===========================================================================
// Programas de beca
// ===========================================================================

interface DatosPrograma {
    nombre?: string;
    tipo?: string;
    descripcion?: string | null;
    porcentaje?: number;
    cupos?: number | null;
    promedioMinimo?: number | null;
    pierdePorConductaGrave?: boolean;
    permiteSolicitud?: boolean;
    activo?: boolean;
}

const leerDatosPrograma = (body: any, parcial: boolean): DatosPrograma => {
    const datos: DatosPrograma = {};

    if (body.nombre !== undefined || !parcial) {
        const nombre = typeof body.nombre === 'string' ? body.nombre.trim() : '';
        if (!nombre) throw new ReglaBecaError('El nombre del programa es obligatorio.', 400);
        datos.nombre = nombre.slice(0, 100);
    }
    if (body.tipo !== undefined || !parcial) {
        if (!TIPOS_PROGRAMA.includes(body.tipo)) {
            throw new ReglaBecaError(`El tipo debe ser uno de: ${TIPOS_PROGRAMA.join(', ')}.`, 400);
        }
        datos.tipo = body.tipo;
    }
    if (body.porcentaje !== undefined || !parcial) datos.porcentaje = validarPorcentaje(body.porcentaje);
    if (body.cupos !== undefined) {
        if (body.cupos === null || body.cupos === '') datos.cupos = null;
        else {
            const cupos = Number(body.cupos);
            if (!Number.isInteger(cupos) || cupos < 1) throw new ReglaBecaError('Los cupos deben ser un número entero mayor que 0.', 400);
            datos.cupos = cupos;
        }
    }
    if (body.promedioMinimo !== undefined) {
        if (body.promedioMinimo === null || body.promedioMinimo === '') datos.promedioMinimo = null;
        else {
            const minimo = Number(body.promedioMinimo);
            if (isNaN(minimo) || minimo < 0 || minimo > 100) throw new ReglaBecaError('El promedio mínimo debe estar entre 0 y 100.', 400);
            datos.promedioMinimo = minimo;
        }
    }
    if (body.descripcion !== undefined) datos.descripcion = body.descripcion ? String(body.descripcion).slice(0, 255) : null;
    if (body.pierdePorConductaGrave !== undefined) datos.pierdePorConductaGrave = Boolean(body.pierdePorConductaGrave);
    if (body.permiteSolicitud !== undefined) datos.permiteSolicitud = Boolean(body.permiteSolicitud);
    if (body.activo !== undefined) datos.activo = Boolean(body.activo);

    return datos;
};

const conCupos = async <T extends { programaId: number; cupos: number | null }>(programa: T) => {
    const usados = await cuposUsados(programa.programaId);
    return { ...programa, cuposUsados: usados, cuposDisponibles: programa.cupos === null ? null : Math.max(programa.cupos - usados, 0) };
};

// GET /programas  ?anioLectivo ?sedeId ?incluirInactivos=true
export const getProgramas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sedeId = await sedeDeTrabajo(req);
        const programas = await prisma.programaBeca.findMany({
            where: {
                anioLectivo: anioDe(req.query.anioLectivo),
                ...(sedeId ? { sedeId } : {}),
                ...(req.query.incluirInactivos === 'true' ? {} : { activo: true }),
            },
            include: { sede: { select: { nombre: true } } },
            orderBy: [{ sedeId: 'asc' }, { nombre: 'asc' }],
        });

        return res.json({ status: 'success', data: await Promise.all(programas.map(conCupos)) });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los programas de beca.');
    }
};

// POST /programas
export const createPrograma = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sedeId = await sedeObligatoria(req);
        const datos = leerDatosPrograma(req.body, false);

        const programa = await prisma.programaBeca.create({
            data: {
                sedeId,
                anioLectivo: anioDe(req.body.anioLectivo),
                nombre: datos.nombre!,
                tipo: datos.tipo!,
                porcentaje: datos.porcentaje!,
                descripcion: datos.descripcion ?? null,
                cupos: datos.cupos ?? null,
                promedioMinimo: datos.promedioMinimo ?? null,
                pierdePorConductaGrave: datos.pierdePorConductaGrave ?? true,
                permiteSolicitud: datos.permiteSolicitud ?? true,
            },
            include: { sede: { select: { nombre: true } } },
        });

        return res.status(201).json({ status: 'success', data: await conCupos(programa) });
    } catch (error) {
        return responderError(res, error, 'Error al crear el programa de beca.');
    }
};

// PUT /programas/:id  — cambiar el porcentaje no altera las becas ya otorgadas
export const updatePrograma = async (req: AuthenticatedRequest, res: Response) => {
    const programaId = parseId(req.params.id);
    if (programaId === null) {
        return res.status(400).json({ status: 'error', message: `El ID: ${req.params.id} no es un número válido` });
    }

    try {
        const programa = await prisma.programaBeca.findUnique({ where: { programaId } });
        if (!programa) {
            return res.status(404).json({ status: 'error', message: `Programa con ID: ${programaId} no encontrado` });
        }
        if (!(await puedeOperarSede(req, programa.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No puede modificar programas de otra sede.' });
        }

        const datos = leerDatosPrograma(req.body, true);
        if (datos.cupos != null) {
            const usados = await cuposUsados(programaId);
            if (datos.cupos < usados) {
                return res.status(409).json({
                    status: 'error',
                    message: `El programa ya tiene ${usados} becas vigentes; los cupos no pueden ser menos que eso.`,
                });
            }
        }

        const actualizado = await prisma.programaBeca.update({
            where: { programaId },
            data: datos,
            include: { sede: { select: { nombre: true } } },
        });

        return res.json({ status: 'success', data: await conCupos(actualizado) });
    } catch (error) {
        return responderError(res, error, 'Error al actualizar el programa de beca.');
    }
};

// ===========================================================================
// Politica de becas de la sede
// ===========================================================================

// GET /politica ?anioLectivo ?sedeId
export const getPolitica = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const sedeId = await sedeObligatoria(req);
        const anio = anioDe(req.query.anioLectivo);
        return res.json({ status: 'success', data: { sedeId, anioLectivo: anio, ...(await obtenerPolitica(sedeId, anio)) } });
    } catch (error) {
        return responderError(res, error, 'Error al obtener la política de becas.');
    }
};

// PUT /politica { anioLectivo, presupuestoMensual, descuentoHermanos, descuentoMaximo, sedeId? }
export const upsertPolitica = async (req: AuthenticatedRequest, res: Response) => {
    const { presupuestoMensual, descuentoHermanos, descuentoMaximo } = req.body;

    try {
        const sedeId = await sedeObligatoria(req);
        const anio = anioDe(req.body.anioLectivo);

        let presupuesto: number | null = null;
        if (presupuestoMensual !== undefined && presupuestoMensual !== null && presupuestoMensual !== '') {
            presupuesto = Number(presupuestoMensual);
            if (isNaN(presupuesto) || presupuesto < 0) {
                return res.status(400).json({ status: 'error', message: 'El presupuesto mensual no puede ser negativo.' });
            }
            const usado = await presupuestoUsado(sedeId, anio);
            if (presupuesto < usado) {
                return res.status(409).json({
                    status: 'error',
                    message: `Las becas activas ya suman Q${usado.toFixed(2)} al mes; el presupuesto no puede ser menor.`,
                });
            }
        }

        const porcentaje = (valor: unknown, nombre: string, porDefecto: number) => {
            if (valor === undefined || valor === null || valor === '') return porDefecto;
            const n = Number(valor);
            if (isNaN(n) || n < 0 || n > 100) throw new ReglaBecaError(`El ${nombre} debe estar entre 0 y 100.`, 400);
            return n;
        };
        const hermanos = porcentaje(descuentoHermanos, 'descuento por hermanos', 0);
        const maximo = porcentaje(descuentoMaximo, 'descuento máximo', 100);

        const politica = await prisma.politicaBeca.upsert({
            where: { sedeId_anioLectivo: { sedeId, anioLectivo: anio } },
            update: { presupuestoMensual: presupuesto, descuentoHermanos: hermanos, descuentoMaximo: maximo },
            create: { sedeId, anioLectivo: anio, presupuestoMensual: presupuesto, descuentoHermanos: hermanos, descuentoMaximo: maximo },
        });

        return res.json({ status: 'success', data: politica });
    } catch (error) {
        return responderError(res, error, 'Error al guardar la política de becas.');
    }
};

// ===========================================================================
// Portal de encargados y alumnos
// ===========================================================================

// GET /mias  — el encargado ve las becas de sus hijos y los programas que puede solicitar;
// el alumno ve las suyas.
export const getMisBecas = async (req: AuthenticatedRequest, res: Response) => {
    const usuarioId = Number(req.user?.id);

    try {
        await finalizarVencidas();
        const rol = await obtenerNombreRol(req);
        const esEncargado = rol === ROL.ENCARGADO;
        const anio = anioActual();

        const hijos = await prisma.alumno.findMany({
            where: esEncargado
                ? { ...hijosDe(usuarioId, 'pagos'), usuario: { deletedAt: null } }
                : { alumnoId: usuarioId },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { select: { nombre: true, sedeId: true, grado: { select: { nombre: true } } } },
                becas: {
                    include: { programa: { select: { nombre: true, tipo: true } }, ...incluirHistorial },
                    orderBy: [{ anioLectivo: 'desc' }, { createdAt: 'desc' }],
                },
            },
            orderBy: { usuario: { nombres: 'asc' } },
        });

        const data = await Promise.all(
            hijos.map(async (hijo) => {
                const descuento = await descuentoColegiatura(hijo.alumnoId, hoyUTC());

                const programas = esEncargado
                    ? await prisma.programaBeca.findMany({
                          where: {
                              sedeId: hijo.seccion.sedeId,
                              anioLectivo: { gte: anio },
                              activo: true,
                              permiteSolicitud: true,
                          },
                          orderBy: [{ anioLectivo: 'asc' }, { nombre: 'asc' }],
                      })
                    : [];

                return {
                    alumnoId: hijo.alumnoId,
                    nombre: nombreCompleto(hijo.usuario),
                    grado: `${hijo.seccion.grado.nombre} "${hijo.seccion.nombre}"`,
                    becas: hijo.becas,
                    descuento,
                    programasDisponibles: await Promise.all(programas.map(conCupos)),
                };
            }),
        );

        return res.json({
            status: 'success',
            data: { colegiaturaMensual: COLEGIATURA_MENSUAL, puedeSolicitar: esEncargado, hijos: data },
        });
    } catch (error) {
        return responderError(res, error, 'Error al obtener las becas.');
    }
};

// POST /solicitar { alumnoId, programaId, justificacion }  — solo encargados del alumno
export const solicitarBeca = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, programaId, justificacion } = req.body;
    const usuarioId = Number(req.user?.id);

    if (!alumnoId || !programaId) {
        return res.status(400).json({ status: 'error', message: 'alumnoId y programaId son obligatorios.' });
    }
    const texto = typeof justificacion === 'string' ? justificacion.trim() : '';
    if (texto.length < 20) {
        return res.status(400).json({ status: 'error', message: 'Explique brevemente por qué solicita la beca (mínimo 20 caracteres).' });
    }

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { seccion: true, usuario: { select: { nombres: true, apellidos: true } } },
        });
        // Solo el contacto principal o el responsable de pagos puede pedir una beca
        if (!alumno || !(await esResponsableDe(usuarioId, alumno.alumnoId))) {
            return res.status(403).json({
                status: 'error',
                message: 'Solo el contacto principal o el responsable de pagos del alumno puede solicitar becas.',
            });
        }

        const programa = await prisma.programaBeca.findUnique({ where: { programaId: Number(programaId) } });
        if (!programa || !programa.activo || !programa.permiteSolicitud) {
            return res.status(404).json({ status: 'error', message: 'El programa no existe o no recibe solicitudes.' });
        }
        if (programa.sedeId !== alumno.seccion.sedeId) {
            return res.status(409).json({ status: 'error', message: 'El programa no pertenece a la sede del alumno.' });
        }
        if (programa.anioLectivo < anioActual()) {
            return res.status(409).json({ status: 'error', message: 'El programa corresponde a un ciclo que ya terminó.' });
        }

        const existente = await prisma.beca.findFirst({
            where: {
                alumnoId: alumno.alumnoId,
                anioLectivo: programa.anioLectivo,
                estado: { in: [ESTADO_BECA.SOLICITADA, ...ESTADOS_VIGENTES] },
            },
        });
        if (existente) {
            return res.status(409).json({
                status: 'error',
                message: existente.estado === ESTADO_BECA.SOLICITADA
                    ? `Ya hay una solicitud en revisión para ${nombreCompleto(alumno.usuario)} en el ciclo ${programa.anioLectivo}.`
                    : `${nombreCompleto(alumno.usuario)} ya tiene una beca en el ciclo ${programa.anioLectivo}.`,
            });
        }

        if (programa.cupos !== null && (await cuposUsados(programa.programaId)) >= programa.cupos) {
            return res.status(409).json({ status: 'error', message: `El programa "${programa.nombre}" ya no tiene cupos disponibles.` });
        }

        const anio = programa.anioLectivo;
        const beca = await prisma.beca.create({
            data: {
                alumnoId: alumno.alumnoId,
                programaId: programa.programaId,
                anioLectivo: anio,
                porcentaje: programa.porcentaje,
                descripcion: texto.slice(0, 255),
                fechaInicio: new Date(Math.max(hoyUTC().getTime(), inicioDeCiclo(anio).getTime())),
                fechaFin: finDeCiclo(anio),
                estado: ESTADO_BECA.SOLICITADA,
                solicitadaPorId: usuarioId,
            },
            include: { programa: { select: { nombre: true, tipo: true } } },
        });
        await registrarHistorial(beca.becaId, null, ESTADO_BECA.SOLICITADA, 'Solicitud enviada por el encargado.', usuarioId);

        return res.status(201).json({
            status: 'success',
            message: 'Solicitud enviada. La administración de la sede la revisará y se le notificará la resolución.',
            data: beca,
        });
    } catch (error) {
        return responderError(res, error, 'Error al enviar la solicitud de beca.');
    }
};

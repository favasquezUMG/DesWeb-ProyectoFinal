import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { puedeOperarSede } from '../middlewares/role.middleware.js';

const ESTADOS = ['Presente', 'Ausente'] as const;
type Estado = (typeof ESTADOS)[number];

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * El campo fecha es @db.Date. Se ancla a medianoche UTC para que la zona
 * horaria de Guatemala (-6) no corra el día al guardar o al leer.
 */
const parseFecha = (fecha: unknown): Date | null => {
    if (typeof fecha !== 'string' || !FORMATO_FECHA.test(fecha.trim())) return null;

    const [anio, mes, dia] = fecha.trim().split('-').map(Number);
    const resultado = new Date(Date.UTC(anio, mes - 1, dia));

    // Rechaza fechas que no existen, como 2026-02-31
    if (resultado.getUTCMonth() !== mes - 1 || resultado.getUTCDate() !== dia) return null;

    return resultado;
};

const formatFecha = (fecha: Date): string => fecha.toISOString().slice(0, 10);

const hoyUTC = (): Date => {
    const ahora = new Date();
    return new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()));
};

/**
 * Puede gestionar la asistencia de un curso: los administradores de esa sede,
 * o el catedrático que imparte ese curso (y solo ese).
 */
const puedeGestionarCurso = async (
    req: AuthenticatedRequest,
    cursoSeccion: { catedraticoId: number; seccion: { sedeId: number } },
): Promise<boolean> => {
    if (!req.user) return false;
    if (Number(req.user.id) === cursoSeccion.catedraticoId) return true;
    return puedeOperarSede(req, cursoSeccion.seccion.sedeId);
};

/**
 * GET de la lista para pasar asistencia.
 * Devuelve los alumnos de la sección con su estado ya registrado para esa
 * fecha (o null si todavía no se ha pasado lista). Es lo que el frontend
 * necesita para pintar el formulario.
 *
 * GET /api/asistencia/lista/:cursoSeccionId?fecha=2026-09-15
 */
export const getListaParaPasar = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId } = req.params;
    const { fecha } = req.query;

    const fechaDate = fecha ? parseFecha(fecha) : hoyUTC();
    if (!fechaDate) {
        return res.status(400).json({
            status: 'error',
            message: 'La fecha debe venir en formato YYYY-MM-DD. Ejemplo: 2026-09-15',
        });
    }

    try {
        const cursoSeccion = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(cursoSeccionId) },
            include: { curso: true, seccion: { include: { grado: true } } },
        });

        if (!cursoSeccion) {
            return res.status(404).json({
                status: 'error',
                message: `Asignación curso-sección con ID: ${cursoSeccionId} no encontrada`,
            });
        }

        if (!(await puedeGestionarCurso(req, cursoSeccion))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para ver la asistencia de este curso.',
            });
        }

        // Los alumnos de la sección son los que llevan el curso, porque la
        // malla del grado aplica igual a todas sus secciones.
        const alumnos = await prisma.alumno.findMany({
            where: { seccionId: cursoSeccion.seccionId },
            include: { usuario: { select: { nombres: true, apellidos: true, deletedAt: true } } },
        });

        const registradas = await prisma.asistencia.findMany({
            where: { cursoSeccionId: Number(cursoSeccionId), fecha: fechaDate },
        });

        const porAlumno = new Map(registradas.map((a) => [a.alumnoId, a]));

        const lista = alumnos
            .filter((a) => !a.usuario.deletedAt)
            .map((a) => ({
                alumnoId: a.alumnoId,
                nombres: a.usuario.nombres,
                apellidos: a.usuario.apellidos,
                estado: porAlumno.get(a.alumnoId)?.estado ?? null,
                asistenciaId: porAlumno.get(a.alumnoId)?.asistenciaId ?? null,
            }))
            .sort((a, b) => a.apellidos.localeCompare(b.apellidos));

        return res.json({
            status: 'success',
            data: {
                cursoSeccionId: cursoSeccion.cursoSeccionId,
                curso: cursoSeccion.curso.nombre,
                grado: cursoSeccion.seccion.grado.nombre,
                seccion: cursoSeccion.seccion.nombre,
                fecha: formatFecha(fechaDate),
                yaRegistrada: registradas.length > 0,
                alumnos: lista,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener la lista.', error });
    }
};

/**
 * Pasa lista de toda la sección de un jalón.
 * POST /api/asistencia/pasar-lista
 *
 * Usa upsert, así que volver a mandar la misma lista corrige lo registrado
 * en lugar de duplicarlo. Eso permite que el catedrático se equivoque y
 * vuelva a guardar sin problema.
 */
export const pasarLista = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId, fecha, asistencias } = req.body;

    if (!cursoSeccionId || !fecha || !Array.isArray(asistencias)) {
        return res.status(400).json({
            status: 'error',
            message: 'cursoSeccionId, fecha y asistencias (arreglo) son obligatorios',
        });
    }

    if (asistencias.length === 0) {
        return res.status(400).json({ status: 'error', message: 'El arreglo de asistencias viene vacío' });
    }

    const fechaDate = parseFecha(fecha);
    if (!fechaDate) {
        return res.status(400).json({
            status: 'error',
            message: 'La fecha debe venir en formato YYYY-MM-DD. Ejemplo: 2026-09-15',
        });
    }

    if (fechaDate > hoyUTC()) {
        return res.status(400).json({ status: 'error', message: 'No se puede pasar lista de una fecha futura' });
    }

    // Validación de cada entrada antes de tocar la base
    for (const item of asistencias) {
        if (!item.alumnoId || !item.estado) {
            return res.status(400).json({
                status: 'error',
                message: 'Cada asistencia debe traer alumnoId y estado',
            });
        }
        if (!ESTADOS.includes(item.estado as Estado)) {
            return res.status(400).json({
                status: 'error',
                message: `Estado inválido: "${item.estado}". Los valores permitidos son: ${ESTADOS.join(', ')}`,
            });
        }
    }

    const ids = asistencias.map((a: any) => Number(a.alumnoId));
    if (new Set(ids).size !== ids.length) {
        return res.status(400).json({
            status: 'error',
            message: 'Hay alumnos repetidos en el arreglo',
        });
    }

    try {
        const cursoSeccion = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(cursoSeccionId) },
            include: { seccion: true },
        });

        if (!cursoSeccion) {
            return res.status(404).json({
                status: 'error',
                message: `Asignación curso-sección con ID: ${cursoSeccionId} no encontrada`,
            });
        }

        if (!(await puedeGestionarCurso(req, cursoSeccion))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para pasar lista en este curso.',
            });
        }

        // Todos los alumnos enviados tienen que pertenecer a esa sección
        const alumnosValidos = await prisma.alumno.findMany({
            where: { alumnoId: { in: ids }, seccionId: cursoSeccion.seccionId },
            select: { alumnoId: true },
        });

        if (alumnosValidos.length !== ids.length) {
            const validos = new Set(alumnosValidos.map((a) => a.alumnoId));
            const invalidos = ids.filter((id) => !validos.has(id));
            return res.status(400).json({
                status: 'error',
                message: `Estos alumnos no pertenecen a la sección de este curso: ${invalidos.join(', ')}`,
            });
        }

        const resultado = await prisma.$transaction(
            asistencias.map((item: any) =>
                prisma.asistencia.upsert({
                    where: {
                        cursoSeccionId_alumnoId_fecha: {
                            cursoSeccionId: Number(cursoSeccionId),
                            alumnoId: Number(item.alumnoId),
                            fecha: fechaDate,
                        },
                    },
                    update: { estado: item.estado },
                    create: {
                        cursoSeccionId: Number(cursoSeccionId),
                        alumnoId: Number(item.alumnoId),
                        fecha: fechaDate,
                        estado: item.estado,
                    },
                }),
            ),
        );

        const presentes = resultado.filter((a) => a.estado === 'Presente').length;

        return res.status(201).json({
            status: 'success',
            message: `Lista registrada: ${presentes} presente(s), ${resultado.length - presentes} ausente(s).`,
            data: {
                fecha: formatFecha(fechaDate),
                total: resultado.length,
                presentes,
                ausentes: resultado.length - presentes,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al pasar lista.', error });
    }
};

//Get All (filtros: ?cursoSeccionId ?alumnoId ?fecha ?desde ?hasta ?estado)
export const getAsistencias = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId, alumnoId, fecha, desde, hasta, estado } = req.query;

    try {
        const where: any = {};
        if (cursoSeccionId) where.cursoSeccionId = Number(cursoSeccionId);
        if (alumnoId) where.alumnoId = Number(alumnoId);
        if (estado) where.estado = estado;

        if (fecha) {
            const f = parseFecha(fecha);
            if (!f) return res.status(400).json({ status: 'error', message: 'fecha inválida (use YYYY-MM-DD)' });
            where.fecha = f;
        } else if (desde || hasta) {
            where.fecha = {};
            if (desde) {
                const d = parseFecha(desde);
                if (!d) return res.status(400).json({ status: 'error', message: 'desde inválida (use YYYY-MM-DD)' });
                where.fecha.gte = d;
            }
            if (hasta) {
                const h = parseFecha(hasta);
                if (!h) return res.status(400).json({ status: 'error', message: 'hasta inválida (use YYYY-MM-DD)' });
                where.fecha.lte = h;
            }
        }

        const asistencias = await prisma.asistencia.findMany({
            where,
            include: {
                alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
                cursoSeccion: { include: { curso: true } },
            },
            orderBy: [{ fecha: 'desc' }, { alumnoId: 'asc' }],
        });

        return res.json({
            status: 'success',
            data: asistencias.map((a) => ({ ...a, fecha: formatFecha(a.fecha) })),
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las asistencias.', error });
    }
};

/**
 * Resumen por alumno de un curso: cuántas clases tuvo, cuántas asistió y su
 * porcentaje. Sirve para el reporte del catedrático y para lo que el
 * encargado consulta del rendimiento de su hijo.
 *
 * GET /api/asistencia/resumen/:cursoSeccionId
 */
export const getResumenAsistencia = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId } = req.params;

    try {
        const cursoSeccion = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(cursoSeccionId) },
            include: { curso: true, seccion: { include: { grado: true } } },
        });

        if (!cursoSeccion) {
            return res.status(404).json({
                status: 'error',
                message: `Asignación curso-sección con ID: ${cursoSeccionId} no encontrada`,
            });
        }

        const registros = await prisma.asistencia.findMany({
            where: { cursoSeccionId: Number(cursoSeccionId) },
            include: { alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
        });

        // Días distintos en que se pasó lista para este curso
        const diasRegistrados = new Set(registros.map((r) => formatFecha(r.fecha))).size;

        const porAlumno = new Map<number, { nombres: string; apellidos: string; presentes: number; total: number }>();

        for (const r of registros) {
            const actual = porAlumno.get(r.alumnoId) ?? {
                nombres: r.alumno.usuario.nombres,
                apellidos: r.alumno.usuario.apellidos,
                presentes: 0,
                total: 0,
            };
            actual.total += 1;
            if (r.estado === 'Presente') actual.presentes += 1;
            porAlumno.set(r.alumnoId, actual);
        }

        const resumen = Array.from(porAlumno.entries())
            .map(([alumnoId, d]) => ({
                alumnoId,
                nombres: d.nombres,
                apellidos: d.apellidos,
                presentes: d.presentes,
                ausentes: d.total - d.presentes,
                totalRegistrado: d.total,
                porcentaje: d.total > 0 ? Number(((d.presentes / d.total) * 100).toFixed(2)) : 0,
            }))
            .sort((a, b) => a.apellidos.localeCompare(b.apellidos));

        return res.json({
            status: 'success',
            data: {
                curso: cursoSeccion.curso.nombre,
                grado: cursoSeccion.seccion.grado.nombre,
                seccion: cursoSeccion.seccion.nombre,
                diasRegistrados,
                alumnos: resumen,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al generar el resumen.', error });
    }
};

//Put: corregir el estado de un alumno puntual
export const updateAsistencia = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado) {
        return res.status(400).json({ status: 'error', message: 'El estado es obligatorio' });
    }

    if (!ESTADOS.includes(estado as Estado)) {
        return res.status(400).json({
            status: 'error',
            message: `Estado inválido: "${estado}". Los valores permitidos son: ${ESTADOS.join(', ')}`,
        });
    }

    try {
        const actual = await prisma.asistencia.findUnique({
            where: { asistenciaId: Number(id) },
            include: { cursoSeccion: { include: { seccion: true } } },
        });

        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Asistencia con ID: ${id} no encontrada` });
        }

        if (!(await puedeGestionarCurso(req, actual.cursoSeccion))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para modificar esta asistencia.',
            });
        }

        const actualizada = await prisma.asistencia.update({
            where: { asistenciaId: Number(id) },
            data: { estado },
        });

        return res.json({
            status: 'success',
            data: { ...actualizada, fecha: formatFecha(actualizada.fecha) },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar la asistencia con ID ${id}.`, error });
    }
};

//Delete
export const deleteAsistenciaById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const actual = await prisma.asistencia.findUnique({
            where: { asistenciaId: Number(id) },
            include: { cursoSeccion: { include: { seccion: true } } },
        });

        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Asistencia con ID: ${id} no encontrada` });
        }

        if (!(await puedeGestionarCurso(req, actual.cursoSeccion))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para eliminar esta asistencia.',
            });
        }

        await prisma.asistencia.delete({ where: { asistenciaId: Number(id) } });

        return res.json({ status: 'success', message: `Se eliminó la asistencia con ID: ${id} correctamente.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar la asistencia con ID: ${id}.`, error });
    }
};
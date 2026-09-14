import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { puedeOperarSede } from '../middlewares/role.middleware.js';
import { formatHora } from '../lib/horas.js';

const incluirDetalle = {
    curso: true,
    seccion: { include: { grado: true, sede: true } },
    catedratico: {
        include: { usuario: { select: { usuarioId: true, nombres: true, apellidos: true, email: true } } },
    },
    horarios: { orderBy: { diaSemana: 'asc' as const } },
};

// Las horas salen como Date por el @db.Time; se formatean a 'HH:MM' para el API
const mapearRespuesta = (cs: any) => ({
    ...cs,
    horarios: cs.horarios?.map((h: any) => ({
        horarioId: h.horarioId,
        diaSemana: h.diaSemana,
        horaInicio: formatHora(h.horaInicio),
        horaFin: formatHora(h.horaFin),
    })),
});

//Get All (filtros: ?seccionId=N ?catedraticoId=N ?sedeId=N)
export const getCursosSeccion = async (req: AuthenticatedRequest, res: Response) => {
    const { seccionId, catedraticoId, sedeId } = req.query;

    try {
        const where: any = {};
        if (seccionId) where.seccionId = Number(seccionId);
        if (catedraticoId) where.catedraticoId = Number(catedraticoId);
        if (sedeId) where.seccion = { sedeId: Number(sedeId) };

        const asignaciones = await prisma.cursoSeccion.findMany({
            where,
            include: incluirDetalle,
        });

        return res.json({ status: 'success', data: asignaciones.map(mapearRespuesta) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las asignaciones.', error });
    }
};

//Get by ID
export const getCursoSeccionById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const asignacion = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(id) },
            include: incluirDetalle,
        });

        if (!asignacion) {
            return res.status(404).json({ status: 'error', message: `Asignación con ID: ${id} no encontrada` });
        }

        return res.json({ status: 'success', data: mapearRespuesta(asignacion) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener la asignación con ID: ${id}.`, error });
    }
};

//Get de los cursos que imparte un catedratico (su horario personal)
export const getCursosDeCatedratico = async (req: AuthenticatedRequest, res: Response) => {
    const { catedraticoId } = req.params;

    try {
        const asignaciones = await prisma.cursoSeccion.findMany({
            where: { catedraticoId: Number(catedraticoId) },
            include: incluirDetalle,
        });

        return res.json({ status: 'success', data: asignaciones.map(mapearRespuesta) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los cursos del catedrático.', error });
    }
};

//Post: asigna un curso a una seccion con su catedratico
export const createCursoSeccion = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoId, seccionId, catedraticoId } = req.body;

    if (!cursoId || !seccionId || !catedraticoId) {
        return res.status(400).json({
            status: 'error',
            message: 'cursoId, seccionId y catedraticoId son obligatorios',
        });
    }

    try {
        const seccion = await prisma.seccion.findUnique({
            where: { seccionId: Number(seccionId) },
            include: { grado: true },
        });
        if (!seccion || seccion.deletedAt) {
            return res.status(404).json({ status: 'error', message: `Sección con ID: ${seccionId} no encontrada` });
        }

        // El Admin de Sede solo puede asignar dentro de su propia sede
        if (!(await puedeOperarSede(req, seccion.sedeId))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para asignar cursos en esta sede.',
            });
        }

        const curso = await prisma.curso.findUnique({ where: { cursoId: Number(cursoId) } });
        if (!curso) {
            return res.status(404).json({ status: 'error', message: `Curso con ID: ${cursoId} no encontrado` });
        }

        // Regla: la malla de cursos de un grado es la misma para todas sus secciones,
        // así que el curso tiene que pertenecer a la malla del grado de la sección.
        const enMalla = await prisma.mallaCurricular.findUnique({
            where: { gradoId_cursoId: { gradoId: seccion.gradoId, cursoId: Number(cursoId) } },
        });
        if (!enMalla) {
            return res.status(400).json({
                status: 'error',
                message: `El curso ${curso.nombre} no pertenece a la malla de ${seccion.grado.nombre}. Agréguelo primero a la malla del grado.`,
            });
        }

        const catedratico = await prisma.catedratico.findUnique({
            where: { catedraticoId: Number(catedraticoId) },
            include: { usuario: true },
        });
        if (!catedratico) {
            return res.status(404).json({ status: 'error', message: `Catedrático con ID: ${catedraticoId} no encontrado` });
        }

        // El catedrático debe pertenecer a la misma sede de la sección
        if (catedratico.usuario.sedeId !== seccion.sedeId) {
            return res.status(400).json({
                status: 'error',
                message: 'El catedrático no pertenece a la sede de esta sección.',
            });
        }

        const duplicado = await prisma.cursoSeccion.findUnique({
            where: { cursoId_seccionId: { cursoId: Number(cursoId), seccionId: Number(seccionId) } },
        });
        if (duplicado) {
            return res.status(409).json({
                status: 'error',
                message: 'Esa sección ya tiene asignado ese curso.',
            });
        }

        // Se crean también las 4 unidades del curso, como exige el enunciado
        const nueva = await prisma.$transaction(async (tx) => {
            const cs = await tx.cursoSeccion.create({
                data: {
                    cursoId: Number(cursoId),
                    seccionId: Number(seccionId),
                    catedraticoId: Number(catedraticoId),
                },
            });

            await tx.unidad.createMany({
                data: [1, 2, 3, 4].map((numero) => ({ cursoSeccionId: cs.cursoSeccionId, numero })),
                skipDuplicates: true,
            });

            return tx.cursoSeccion.findUnique({
                where: { cursoSeccionId: cs.cursoSeccionId },
                include: incluirDetalle,
            });
        });

        return res.status(201).json({ status: 'success', data: mapearRespuesta(nueva) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear la asignación.', error });
    }
};

//Put: solo se permite cambiar de catedratico
export const updateCursoSeccion = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { catedraticoId } = req.body;

    if (!catedraticoId) {
        return res.status(400).json({
            status: 'error',
            message: 'Solo se puede reasignar el catedrático. Envíe catedraticoId.',
        });
    }

    try {
        const actual = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(id) },
            include: { seccion: true, horarios: true },
        });
        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Asignación con ID: ${id} no encontrada` });
        }

        if (!(await puedeOperarSede(req, actual.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        const nuevo = await prisma.catedratico.findUnique({
            where: { catedraticoId: Number(catedraticoId) },
            include: { usuario: true },
        });
        if (!nuevo) {
            return res.status(404).json({ status: 'error', message: `Catedrático con ID: ${catedraticoId} no encontrado` });
        }

        if (nuevo.usuario.sedeId !== actual.seccion.sedeId) {
            return res.status(400).json({
                status: 'error',
                message: 'El catedrático no pertenece a la sede de esta sección.',
            });
        }

        // Al cambiar de catedrático hay que revisar que los horarios ya
        // existentes de este curso no choquen con la agenda del nuevo.
        for (const horario of actual.horarios) {
            const choque = await prisma.horario.findFirst({
                where: {
                    diaSemana: horario.diaSemana,
                    horaInicio: { lt: horario.horaFin },
                    horaFin: { gt: horario.horaInicio },
                    cursoSeccionId: { not: actual.cursoSeccionId },
                    cursoSeccion: {
                        catedraticoId: Number(catedraticoId),
                        seccion: { sedeId: actual.seccion.sedeId },
                    },
                },
                include: { cursoSeccion: { include: { curso: true } } },
            });

            if (choque) {
                return res.status(409).json({
                    status: 'error',
                    message:
                        `No se puede reasignar: el catedrático ya imparte ${choque.cursoSeccion.curso.nombre} ` +
                        `en la franja ${formatHora(horario.horaInicio)} - ${formatHora(horario.horaFin)}.`,
                });
            }
        }

        const actualizada = await prisma.cursoSeccion.update({
            where: { cursoSeccionId: Number(id) },
            data: { catedraticoId: Number(catedraticoId) },
            include: incluirDetalle,
        });

        return res.json({ status: 'success', data: mapearRespuesta(actualizada) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar la asignación con ID ${id}.`, error });
    }
};

//Delete (bloqueado si ya hay notas o asistencias registradas)
export const deleteCursoSeccionById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const actual = await prisma.cursoSeccion.findUnique({
            where: { cursoSeccionId: Number(id) },
            include: { seccion: true },
        });
        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Asignación con ID: ${id} no encontrada` });
        }

        if (!(await puedeOperarSede(req, actual.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        const notas = await prisma.nota.count({
            where: { actividad: { unidad: { cursoSeccionId: Number(id) } } },
        });
        const asistencias = await prisma.asistencia.count({ where: { cursoSeccionId: Number(id) } });

        if (notas > 0 || asistencias > 0) {
            return res.status(409).json({
                status: 'error',
                message: `No se puede eliminar la asignación: tiene ${notas} nota(s) y ${asistencias} registro(s) de asistencia.`,
            });
        }

        await prisma.$transaction([
            prisma.horario.deleteMany({ where: { cursoSeccionId: Number(id) } }),
            prisma.actividad.deleteMany({ where: { unidad: { cursoSeccionId: Number(id) } } }),
            prisma.unidad.deleteMany({ where: { cursoSeccionId: Number(id) } }),
            prisma.cursoSeccion.delete({ where: { cursoSeccionId: Number(id) } }),
        ]);

        return res.json({ status: 'success', message: `Se eliminó la asignación con ID: ${id} correctamente.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar la asignación con ID: ${id}.`, error });
    }
};
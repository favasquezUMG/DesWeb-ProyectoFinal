import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

//Get All (soporta filtro opcional ?gradoId=N para traer solo la malla de un grado)
export const getCursos = async (req: Request, res: Response) => {
    const { gradoId } = req.query;

    try {
        const where: any = {};
        if (gradoId) {
            where.mallas = { some: { gradoId: Number(gradoId) } };
        }

        const cursos = await prisma.curso.findMany({
            where,
            include: {
                mallas: {
                    include: { grado: { select: { gradoId: true, nombre: true, nivel: true } } },
                },
            },
            orderBy: { nombre: 'asc' },
        });

        return res.json({ status: 'success', data: cursos });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los cursos.', error });
    }
};

//Get by ID
export const getCursoById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const curso = await prisma.curso.findUnique({
            where: { cursoId: Number(id) },
            include: {
                mallas: { include: { grado: true } },
                cursosSeccion: {
                    include: {
                        seccion: { include: { grado: true, sede: true } },
                        catedratico: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
                    },
                },
            },
        });

        if (!curso) {
            return res.status(404).json({ status: 'error', message: `Curso con ID: ${id} no encontrado` });
        }

        return res.json({ status: 'success', data: curso });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el curso con ID: ${id}.`, error });
    }
};

//Post create
//Opcionalmente recibe gradosIds: [] para agregarlo de una vez a la malla de esos grados
export const createCurso = async (req: Request, res: Response) => {
    const { nombre, descripcion, gradosIds } = req.body;

    if (!nombre) {
        return res.status(400).json({ status: 'error', message: 'El nombre del curso es obligatorio' });
    }

    if (gradosIds !== undefined && !Array.isArray(gradosIds)) {
        return res.status(400).json({ status: 'error', message: 'gradosIds debe ser un arreglo de IDs de grado' });
    }

    try {
        const duplicado = await prisma.curso.findFirst({ where: { nombre } });
        if (duplicado) {
            return res.status(400).json({ status: 'error', message: `El curso ${nombre} ya está registrado.` });
        }

        // Se valida que todos los grados existan antes de abrir la transacción
        if (gradosIds?.length) {
            const encontrados = await prisma.grado.count({
                where: { gradoId: { in: gradosIds.map(Number) } },
            });
            if (encontrados !== gradosIds.length) {
                return res.status(404).json({ status: 'error', message: 'Uno o más grados no existen.' });
            }
        }

        const newCurso = await prisma.$transaction(async (tx) => {
            const curso = await tx.curso.create({
                data: { nombre, descripcion: descripcion ?? null },
            });

            if (gradosIds?.length) {
                await tx.mallaCurricular.createMany({
                    data: gradosIds.map((gradoId: number) => ({
                        gradoId: Number(gradoId),
                        cursoId: curso.cursoId,
                    })),
                    skipDuplicates: true,
                });
            }

            return tx.curso.findUnique({
                where: { cursoId: curso.cursoId },
                include: { mallas: { include: { grado: true } } },
            });
        });

        return res.status(201).json({ status: 'success', data: newCurso });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el curso.', error });
    }
};

//Put
export const updateCurso = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    try {
        const cursoActual = await prisma.curso.findUnique({ where: { cursoId: Number(id) } });
        if (!cursoActual) {
            return res.status(404).json({ status: 'error', message: `Curso con ID: ${id} no encontrado` });
        }

        if (nombre) {
            const duplicado = await prisma.curso.findFirst({ where: { nombre } });
            if (duplicado && duplicado.cursoId !== Number(id)) {
                return res.status(400).json({ status: 'error', message: `El curso ${nombre} ya está registrado.` });
            }
        }

        const dataToUpdate: any = {};
        if (nombre !== undefined) dataToUpdate.nombre = nombre;
        if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;

        const updatedCurso = await prisma.curso.update({
            where: { cursoId: Number(id) },
            data: dataToUpdate,
        });

        return res.json({ status: 'success', data: updatedCurso });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar el curso con ID ${id}.`, error });
    }
};

//Delete (fisico, bloqueado si el curso ya tiene secciones asignadas)
export const deleteCursoById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const asignaciones = await prisma.cursoSeccion.count({ where: { cursoId: Number(id) } });
        if (asignaciones > 0) {
            return res.status(409).json({
                status: 'error',
                message: `No se puede eliminar el curso con ID: ${id} porque está asignado a ${asignaciones} sección(es).`,
            });
        }

        await prisma.$transaction([
            prisma.mallaCurricular.deleteMany({ where: { cursoId: Number(id) } }),
            prisma.curso.delete({ where: { cursoId: Number(id) } }),
        ]);

        return res.json({ status: 'success', message: `Se eliminó el curso con ID: ${id} correctamente.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el curso con ID: ${id}.`, error });
    }
};

// ---------- Malla curricular: qué cursos lleva cada grado ----------

//Agrega el curso a la malla de un grado
export const asignarCursoAGrado = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { gradoId } = req.body;

    if (!gradoId) {
        return res.status(400).json({ status: 'error', message: 'El gradoId es obligatorio' });
    }

    try {
        const curso = await prisma.curso.findUnique({ where: { cursoId: Number(id) } });
        if (!curso) {
            return res.status(404).json({ status: 'error', message: `Curso con ID: ${id} no encontrado` });
        }

        const grado = await prisma.grado.findUnique({ where: { gradoId: Number(gradoId) } });
        if (!grado) {
            return res.status(404).json({ status: 'error', message: `Grado con ID: ${gradoId} no encontrado` });
        }

        const existente = await prisma.mallaCurricular.findUnique({
            where: { gradoId_cursoId: { gradoId: Number(gradoId), cursoId: Number(id) } },
        });
        if (existente) {
            return res.status(400).json({ status: 'error', message: 'El curso ya pertenece a la malla de ese grado.' });
        }

        const malla = await prisma.mallaCurricular.create({
            data: { gradoId: Number(gradoId), cursoId: Number(id) },
            include: { grado: true, curso: true },
        });

        return res.status(201).json({ status: 'success', data: malla });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al asignar el curso al grado.', error });
    }
};

//Quita el curso de la malla de un grado
export const quitarCursoDeGrado = async (req: Request, res: Response) => {
    const { id, gradoId } = req.params;

    try {
        const existente = await prisma.mallaCurricular.findUnique({
            where: { gradoId_cursoId: { gradoId: Number(gradoId), cursoId: Number(id) } },
        });
        if (!existente) {
            return res.status(404).json({ status: 'error', message: 'El curso no pertenece a la malla de ese grado.' });
        }

        // Si ya hay secciones de ese grado impartiendo el curso, quitarlo de la
        // malla dejaría asignaciones huérfanas respecto al plan de estudios.
        const enUso = await prisma.cursoSeccion.count({
            where: { cursoId: Number(id), seccion: { gradoId: Number(gradoId) } },
        });
        if (enUso > 0) {
            return res.status(409).json({
                status: 'error',
                message: `No se puede quitar el curso de la malla porque ${enUso} sección(es) de ese grado ya lo tienen asignado.`,
            });
        }

        await prisma.mallaCurricular.delete({
            where: { gradoId_cursoId: { gradoId: Number(gradoId), cursoId: Number(id) } },
        });

        return res.json({ status: 'success', message: 'Curso removido de la malla del grado correctamente.' });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al quitar el curso de la malla.', error });
    }
};
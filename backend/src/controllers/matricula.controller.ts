import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { puedeOperarSede, ROL } from '../middlewares/role.middleware.js';

const ESTADOS = ['Activa', 'Retirada'] as const;
type Estado = (typeof ESTADOS)[number];

const incluirDetalle = {
    alumno: { include: { usuario: { select: { usuarioId: true, nombres: true, apellidos: true, email: true } } } },
    encargado: { include: { usuario: { select: { usuarioId: true, nombres: true, apellidos: true, email: true } } } },
    seccion: { include: { grado: true, sede: true } },
};

/**
 * ACUERDO DEL EQUIPO: la sección del alumno vive en dos lugares
 * (Alumno.seccionId y Matricula.seccionId). Para que nunca se
 * desincronicen, SOLO este módulo escribe Alumno.seccionId, y siempre
 * dentro de la misma transacción que toca la matrícula.
 *
 * Si algún otro módulo necesita cambiar la sección de un alumno, tiene
 * que hacerlo pasando por aquí.
 */

//Get All (filtros: ?alumnoId ?seccionId ?encargadoId ?anioLectivo ?estado)
export const getMatriculas = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, seccionId, encargadoId, anioLectivo, estado } = req.query;

    try {
        const where: any = {};
        if (alumnoId) where.alumnoId = Number(alumnoId);
        if (seccionId) where.seccionId = Number(seccionId);
        if (encargadoId) where.encargadoId = Number(encargadoId);
        if (anioLectivo) where.anioLectivo = Number(anioLectivo);
        if (estado) where.estado = estado;

        const matriculas = await prisma.matricula.findMany({
            where,
            include: incluirDetalle,
            orderBy: [{ anioLectivo: 'desc' }, { fechaMatricula: 'desc' }],
        });

        return res.json({ status: 'success', data: matriculas });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las matrículas.', error });
    }
};

//Get by ID
export const getMatriculaById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const matricula = await prisma.matricula.findUnique({
            where: { matriculaId: Number(id) },
            include: incluirDetalle,
        });

        if (!matricula) {
            return res.status(404).json({ status: 'error', message: `Matrícula con ID: ${id} no encontrada` });
        }

        return res.json({ status: 'success', data: matricula });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener la matrícula con ID: ${id}.`, error });
    }
};

//Historial de matrículas de un alumno (todos los años)
export const getMatriculasDeAlumno = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId } = req.params;

    try {
        const matriculas = await prisma.matricula.findMany({
            where: { alumnoId: Number(alumnoId) },
            include: incluirDetalle,
            orderBy: { anioLectivo: 'desc' },
        });

        return res.json({ status: 'success', data: matriculas });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el historial del alumno.', error });
    }
};

/**
 * Inscribe al alumno en una sección.
 * POST /api/matriculas
 *
 * Al quedar matriculado, el alumno automáticamente lleva todos los cursos
 * de la malla de ese grado, porque los cursos cuelgan de la sección
 * (CursoSeccion) y no del alumno individual. Por eso no se insertan
 * cursos aquí: se derivan solos.
 */
export const createMatricula = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, seccionId, encargadoId, anioLectivo } = req.body;

    if (!alumnoId || !seccionId || !encargadoId) {
        return res.status(400).json({
            status: 'error',
            message: 'alumnoId, seccionId y encargadoId son obligatorios',
        });
    }

    try {
        const seccion = await prisma.seccion.findUnique({
            where: { seccionId: Number(seccionId) },
            include: { grado: true, sede: true },
        });

        if (!seccion || seccion.deletedAt) {
            return res.status(404).json({ status: 'error', message: `Sección con ID: ${seccionId} no encontrada` });
        }

        // Si no mandan el año, se toma el de la sección
        const anio = anioLectivo ? Number(anioLectivo) : seccion.anioLectivo;

        if (anio !== seccion.anioLectivo) {
            return res.status(400).json({
                status: 'error',
                message: `La sección pertenece al año lectivo ${seccion.anioLectivo}, no a ${anio}.`,
            });
        }

        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { usuario: true },
        });
        if (!alumno) {
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const encargado = await prisma.encargado.findUnique({
            where: { encargadoId: Number(encargadoId) },
            include: { usuario: true },
        });
        if (!encargado) {
            return res.status(404).json({ status: 'error', message: `Encargado con ID: ${encargadoId} no encontrado` });
        }

        // Regla: solo el padre/encargado matricula al alumno. Se verifica
        // que ese encargado esté efectivamente vinculado a ese alumno.
        const vinculo = await prisma.alumnoEncargado.findUnique({
            where: {
                alumnoId_encargadoId: { alumnoId: Number(alumnoId), encargadoId: Number(encargadoId) },
            },
        });
        if (!vinculo) {
            return res.status(400).json({
                status: 'error',
                message: 'Ese encargado no está registrado como responsable de este alumno.',
            });
        }

        // Un encargado solo puede matricular a los alumnos a su cargo
        const esEncargadoLogueado = Number(req.user?.id) === Number(encargadoId);
        if (!esEncargadoLogueado && !(await puedeOperarSede(req, seccion.sedeId))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para matricular en esta sede.',
            });
        }

        // Un alumno no puede tener dos matrículas activas el mismo año
        const existente = await prisma.matricula.findFirst({
            where: { alumnoId: Number(alumnoId), anioLectivo: anio, estado: 'Activa' },
            include: { seccion: { include: { grado: true } } },
        });
        if (existente) {
            return res.status(409).json({
                status: 'error',
                message:
                    `El alumno ya tiene una matrícula activa en ${anio} ` +
                    `(${existente.seccion.grado.nombre} sección ${existente.seccion.nombre}). ` +
                    `Para cambiarlo de sección use el traslado en lugar de crear otra matrícula.`,
            });
        }

        // La transacción es lo que garantiza que Matricula.seccionId y
        // Alumno.seccionId nunca queden diciendo cosas distintas.
        const matricula = await prisma.$transaction(async (tx) => {
            const nueva = await tx.matricula.create({
                data: {
                    alumnoId: Number(alumnoId),
                    seccionId: Number(seccionId),
                    encargadoId: Number(encargadoId),
                    anioLectivo: anio,
                    estado: 'Activa',
                },
            });

            await tx.alumno.update({
                where: { alumnoId: Number(alumnoId) },
                data: { seccionId: Number(seccionId) },
            });

            // El usuario del alumno también se mueve a la sede de la sección
            await tx.usuario.update({
                where: { usuarioId: Number(alumnoId) },
                data: { sedeId: seccion.sedeId },
            });

            return tx.matricula.findUnique({
                where: { matriculaId: nueva.matriculaId },
                include: incluirDetalle,
            });
        });

        // Los cursos que le quedan asignados, para confirmárselos al encargado
        const cursos = await prisma.cursoSeccion.findMany({
            where: { seccionId: Number(seccionId) },
            include: { curso: true },
        });

        return res.status(201).json({
            status: 'success',
            message: `Alumno matriculado en ${seccion.grado.nombre} sección ${seccion.nombre}, ${seccion.sede.nombre}.`,
            data: {
                matricula,
                cursosAsignados: cursos.map((cs) => ({
                    cursoSeccionId: cs.cursoSeccionId,
                    nombre: cs.curso.nombre,
                })),
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear la matrícula.', error });
    }
};

/**
 * Traslada al alumno a otra sección.
 * PUT /api/matriculas/:id
 *
 * No se crea una matrícula nueva: se actualiza la existente, junto con la
 * copia en Alumno.seccionId, en la misma transacción.
 */
export const trasladarMatricula = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { seccionId } = req.body;

    if (!seccionId) {
        return res.status(400).json({
            status: 'error',
            message: 'seccionId es obligatorio para trasladar al alumno',
        });
    }

    try {
        const matricula = await prisma.matricula.findUnique({
            where: { matriculaId: Number(id) },
            include: { seccion: true },
        });
        if (!matricula) {
            return res.status(404).json({ status: 'error', message: `Matrícula con ID: ${id} no encontrada` });
        }

        if (matricula.estado !== 'Activa') {
            return res.status(400).json({
                status: 'error',
                message: 'Solo se puede trasladar una matrícula activa.',
            });
        }

        if (matricula.seccionId === Number(seccionId)) {
            return res.status(400).json({
                status: 'error',
                message: 'El alumno ya está en esa sección.',
            });
        }

        const nuevaSeccion = await prisma.seccion.findUnique({
            where: { seccionId: Number(seccionId) },
            include: { grado: true, sede: true },
        });
        if (!nuevaSeccion || nuevaSeccion.deletedAt) {
            return res.status(404).json({ status: 'error', message: `Sección con ID: ${seccionId} no encontrada` });
        }

        if (nuevaSeccion.anioLectivo !== matricula.anioLectivo) {
            return res.status(400).json({
                status: 'error',
                message: `La sección destino es del año ${nuevaSeccion.anioLectivo} y la matrícula es del ${matricula.anioLectivo}.`,
            });
        }

        // El traslado lo autoriza la administración, no el encargado
        if (!(await puedeOperarSede(req, nuevaSeccion.sedeId))) {
            return res.status(403).json({
                status: 'error',
                message: 'No tiene permisos para trasladar alumnos a esta sede.',
            });
        }

        const actualizada = await prisma.$transaction(async (tx) => {
            const m = await tx.matricula.update({
                where: { matriculaId: Number(id) },
                data: { seccionId: Number(seccionId) },
            });

            await tx.alumno.update({
                where: { alumnoId: matricula.alumnoId },
                data: { seccionId: Number(seccionId) },
            });

            await tx.usuario.update({
                where: { usuarioId: matricula.alumnoId },
                data: { sedeId: nuevaSeccion.sedeId },
            });

            return tx.matricula.findUnique({
                where: { matriculaId: m.matriculaId },
                include: incluirDetalle,
            });
        });

        return res.json({
            status: 'success',
            message: `Alumno trasladado a ${nuevaSeccion.grado.nombre} sección ${nuevaSeccion.nombre}.`,
            data: actualizada,
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al trasladar la matrícula con ID ${id}.`, error });
    }
};

/**
 * Cambia el estado de la matrícula (retirar al alumno).
 * PUT /api/matriculas/:id/estado
 */
export const cambiarEstadoMatricula = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { estado } = req.body;

    if (!estado || !ESTADOS.includes(estado as Estado)) {
        return res.status(400).json({
            status: 'error',
            message: `Estado inválido. Los valores permitidos son: ${ESTADOS.join(', ')}`,
        });
    }

    try {
        const matricula = await prisma.matricula.findUnique({
            where: { matriculaId: Number(id) },
            include: { seccion: true },
        });
        if (!matricula) {
            return res.status(404).json({ status: 'error', message: `Matrícula con ID: ${id} no encontrada` });
        }

        if (!(await puedeOperarSede(req, matricula.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        const actualizada = await prisma.matricula.update({
            where: { matriculaId: Number(id) },
            data: { estado },
            include: incluirDetalle,
        });

        return res.json({ status: 'success', data: actualizada });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al cambiar el estado de la matrícula ${id}.`, error });
    }
};

//Delete (solo si no hay notas ni asistencias del alumno en esa sección)
export const deleteMatriculaById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const matricula = await prisma.matricula.findUnique({
            where: { matriculaId: Number(id) },
            include: { seccion: true },
        });
        if (!matricula) {
            return res.status(404).json({ status: 'error', message: `Matrícula con ID: ${id} no encontrada` });
        }

        if (!(await puedeOperarSede(req, matricula.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        const notas = await prisma.nota.count({
            where: {
                alumnoId: matricula.alumnoId,
                actividad: { unidad: { cursoSeccion: { seccionId: matricula.seccionId } } },
            },
        });
        const asistencias = await prisma.asistencia.count({
            where: {
                alumnoId: matricula.alumnoId,
                cursoSeccion: { seccionId: matricula.seccionId },
            },
        });

        if (notas > 0 || asistencias > 0) {
            return res.status(409).json({
                status: 'error',
                message:
                    `No se puede eliminar la matrícula: el alumno tiene ${notas} nota(s) y ` +
                    `${asistencias} registro(s) de asistencia en esa sección. Use el retiro en su lugar.`,
            });
        }

        await prisma.matricula.delete({ where: { matriculaId: Number(id) } });

        return res.json({ status: 'success', message: `Se eliminó la matrícula con ID: ${id} correctamente.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar la matrícula con ID: ${id}.`, error });
    }
};
import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { puedeOperarSede } from '../middlewares/role.middleware.js';
import { parseHora, formatHora, esDiaValido, DIAS_SEMANA } from '../lib/horas.js';
import { detectarChoque } from '../lib/choqueHorario.js';

const mapearHorario = (h: any) => ({
    horarioId: h.horarioId,
    cursoSeccionId: h.cursoSeccionId,
    diaSemana: h.diaSemana,
    dia: DIAS_SEMANA[h.diaSemana],
    horaInicio: formatHora(h.horaInicio),
    horaFin: formatHora(h.horaFin),
    cursoSeccion: h.cursoSeccion,
});

/** Valida y normaliza el cuerpo del request. Devuelve el error listo o los datos limpios. */
const validarEntrada = (body: any) => {
    const { diaSemana, horaInicio, horaFin } = body;

    if (diaSemana === undefined || !horaInicio || !horaFin) {
        return { error: 'diaSemana, horaInicio y horaFin son obligatorios' };
    }

    if (!esDiaValido(diaSemana)) {
        return { error: 'diaSemana debe ser un número del 1 (Lunes) al 7 (Domingo)' };
    }

    const inicio = parseHora(horaInicio);
    const fin = parseHora(horaFin);

    if (!inicio || !fin) {
        return { error: 'Las horas deben venir en formato HH:MM (24 horas). Ejemplo: 07:30' };
    }

    if (inicio >= fin) {
        return { error: 'La hora de inicio debe ser anterior a la hora de fin' };
    }

    return { data: { diaSemana: Number(diaSemana), horaInicio: inicio, horaFin: fin } };
};

//Get All (filtros: ?cursoSeccionId=N ?catedraticoId=N ?seccionId=N ?diaSemana=N)
export const getHorarios = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId, catedraticoId, seccionId, diaSemana } = req.query;

    try {
        const where: any = {};
        if (cursoSeccionId) where.cursoSeccionId = Number(cursoSeccionId);
        if (diaSemana) where.diaSemana = Number(diaSemana);
        if (catedraticoId || seccionId) {
            where.cursoSeccion = {};
            if (catedraticoId) where.cursoSeccion.catedraticoId = Number(catedraticoId);
            if (seccionId) where.cursoSeccion.seccionId = Number(seccionId);
        }

        const horarios = await prisma.horario.findMany({
            where,
            include: {
                cursoSeccion: {
                    include: {
                        curso: true,
                        seccion: { include: { grado: true } },
                        catedratico: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
                    },
                },
            },
            orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
        });

        return res.json({ status: 'success', data: horarios.map(mapearHorario) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los horarios.', error });
    }
};

//Get by ID
export const getHorarioById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const horario = await prisma.horario.findUnique({
            where: { horarioId: Number(id) },
            include: { cursoSeccion: { include: { curso: true, seccion: true } } },
        });

        if (!horario) {
            return res.status(404).json({ status: 'error', message: `Horario con ID: ${id} no encontrado` });
        }

        return res.json({ status: 'success', data: mapearHorario(horario) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el horario con ID: ${id}.`, error });
    }
};

/**
 * Post de verificación previa: le dice al frontend si una franja chocaría,
 * SIN guardar nada. Sirve para pintar la advertencia en el formulario
 * antes de que el usuario le dé a Guardar.
 */
export const verificarChoque = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId, horarioId } = req.body;

    if (!cursoSeccionId) {
        return res.status(400).json({ status: 'error', message: 'cursoSeccionId es obligatorio' });
    }

    const validacion = validarEntrada(req.body);
    if (validacion.error) {
        return res.status(400).json({ status: 'error', message: validacion.error });
    }

    try {
        const choque = await detectarChoque(
            Number(cursoSeccionId),
            validacion.data!,
            horarioId ? Number(horarioId) : undefined,
        );

        return res.json({
            status: 'success',
            data: {
                disponible: choque === null,
                choque: choque ?? null,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al verificar el horario.', error });
    }
};

//Post create
export const createHorario = async (req: AuthenticatedRequest, res: Response) => {
    const { cursoSeccionId } = req.body;

    if (!cursoSeccionId) {
        return res.status(400).json({ status: 'error', message: 'cursoSeccionId es obligatorio' });
    }

    const validacion = validarEntrada(req.body);
    if (validacion.error) {
        return res.status(400).json({ status: 'error', message: validacion.error });
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

        if (!(await puedeOperarSede(req, cursoSeccion.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        // Criterio de aceptación: el sistema impide guardar una asignación de
        // horario que choque con otra existente para el mismo catedrático.
        const choque = await detectarChoque(Number(cursoSeccionId), validacion.data!);
        if (choque) {
            return res.status(409).json({
                status: 'error',
                tipoChoque: choque.tipo,
                message: choque.mensaje,
            });
        }

        const nuevo = await prisma.horario.create({
            data: {
                cursoSeccionId: Number(cursoSeccionId),
                diaSemana: validacion.data!.diaSemana,
                horaInicio: validacion.data!.horaInicio,
                horaFin: validacion.data!.horaFin,
            },
            include: { cursoSeccion: { include: { curso: true, seccion: true } } },
        });

        return res.status(201).json({ status: 'success', data: mapearHorario(nuevo) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el horario.', error });
    }
};

//Put
export const updateHorario = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    const validacion = validarEntrada(req.body);
    if (validacion.error) {
        return res.status(400).json({ status: 'error', message: validacion.error });
    }

    try {
        const actual = await prisma.horario.findUnique({
            where: { horarioId: Number(id) },
            include: { cursoSeccion: { include: { seccion: true } } },
        });
        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Horario con ID: ${id} no encontrado` });
        }

        if (!(await puedeOperarSede(req, actual.cursoSeccion.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        // Se excluye el propio horario de la comparación, si no chocaría consigo mismo
        const choque = await detectarChoque(actual.cursoSeccionId, validacion.data!, Number(id));
        if (choque) {
            return res.status(409).json({
                status: 'error',
                tipoChoque: choque.tipo,
                message: choque.mensaje,
            });
        }

        const actualizado = await prisma.horario.update({
            where: { horarioId: Number(id) },
            data: {
                diaSemana: validacion.data!.diaSemana,
                horaInicio: validacion.data!.horaInicio,
                horaFin: validacion.data!.horaFin,
            },
            include: { cursoSeccion: { include: { curso: true, seccion: true } } },
        });

        return res.json({ status: 'success', data: mapearHorario(actualizado) });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar el horario con ID ${id}.`, error });
    }
};

//Delete
export const deleteHorarioById = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const actual = await prisma.horario.findUnique({
            where: { horarioId: Number(id) },
            include: { cursoSeccion: { include: { seccion: true } } },
        });
        if (!actual) {
            return res.status(404).json({ status: 'error', message: `Horario con ID: ${id} no encontrado` });
        }

        if (!(await puedeOperarSede(req, actual.cursoSeccion.seccion.sedeId))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos sobre esta sede.' });
        }

        await prisma.horario.delete({ where: { horarioId: Number(id) } });

        return res.json({ status: 'success', message: `Se eliminó el horario con ID: ${id} correctamente.` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el horario con ID: ${id}.`, error });
    }
};
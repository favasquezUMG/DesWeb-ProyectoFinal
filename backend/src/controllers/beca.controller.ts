import type { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

const parseId = (id: unknown): number | null => {
    if (typeof id !== 'string' || !/^\d+$/.test(id)) return null;
    return Number(id);
};

const errorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Error desconocido';
};

const handlePrismaError = (res: Response, error: unknown, notFoundMessage: string, serverMessage: string) => {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        return res.status(404).json({ status: 'error', message: notFoundMessage });
    }
    return res.status(500).json({ status: 'error', message: serverMessage, error: errorMessage(error) });
};

// Datos del alumno que necesita el frontend para mostrar nombre y grado sin
// tener que pedirlos por separado.
const incluirAlumno = {
    alumno: {
        select: {
            alumnoId: true,
            usuario: { select: { nombres: true, apellidos: true } },
            seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
        },
    },
} as const;

//Get All (soporta filtro opcional ?activa=true|false)
export const getBecas = async (req: Request, res: Response) => {
    const { activa } = req.query;

    try {
        const where: any = {};
        if(activa === 'true') where.activa = true;
        if(activa === 'false') where.activa = false;

        const becas = await prisma.beca.findMany({
            where,
            include: incluirAlumno,
            orderBy: [{ alumno: { usuario: { apellidos: 'asc' } } }, { alumno: { usuario: { nombres: 'asc' } } }],
        });

        return res.json({ status: 'success', data: becas })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener las becas.', error: errorMessage(error) })
    }
}

//Get by ID
export const getBecaById = async (req: Request, res: Response) => {
    const { id } = req.params;

    const becaId = parseId(id);
    if(becaId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const beca = await prisma.beca.findUnique({
            where: { becaId },
            include: incluirAlumno,
        });

        if(!beca){
            return res.status(404).json({ status: 'error', message: `Beca con ID: ${id} no encontrada` })
        }

        return res.json({ status: 'success', data: beca });
    } catch (error) {
        return handlePrismaError(res, error, `Beca con ID: ${id} no encontrada`, `Error al obtener la beca con ID: ${id}.`);
    }
}

//Post create
export const createBeca = async (req: Request, res: Response ) => {
    const { alumnoId, porcentaje, descripcion, fechaInicio, fechaFin } = req.body;

    if(!alumnoId || porcentaje === undefined || porcentaje === null || !fechaInicio) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios para crear una beca' });
    }

    const porcentajeNum = Number(porcentaje);
    if(isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100){
        return res.status(400).json({ status: 'error', message: 'El porcentaje debe ser un número entre 0 y 100' });
    }

    const fechaInicioDate = new Date(fechaInicio);
    if(isNaN(fechaInicioDate.getTime())){
        return res.status(400).json({ status: 'error', message: 'La fecha de inicio no es válida' });
    }

    let fechaFinDate: Date | null = null;
    if(fechaFin){
        fechaFinDate = new Date(fechaFin);
        if(isNaN(fechaFinDate.getTime())){
            return res.status(400).json({ status: 'error', message: 'La fecha de fin no es válida' });
        }
        if(fechaFinDate <= fechaInicioDate){
            return res.status(400).json({ status: 'error', message: 'La fecha de fin debe ser posterior a la fecha de inicio' });
        }
    }

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) }
        });
        if(!alumno){
            return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` })
        }

        const newBeca = await prisma.beca.create({
            data: {
                alumnoId: Number(alumnoId),
                porcentaje: porcentajeNum,
                descripcion: descripcion ?? null,
                fechaInicio: fechaInicioDate,
                fechaFin: fechaFinDate
            }
        });

        return res.status(200).json({ status: 'success', data: newBeca })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear la beca.', error: errorMessage(error) })
    }
}

//Put
export const updateBeca = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { alumnoId, porcentaje, descripcion, fechaInicio, fechaFin, activa } = req.body;

    const becaId = parseId(id);
    if(becaId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const becaActual = await prisma.beca.findUnique({
            where: { becaId }
        });
        if(!becaActual){
            return res.status(404).json({ status: 'error', message: `Beca con ID: ${id} no encontrada` })
        }

        if(alumnoId !== undefined){
            const alumno = await prisma.alumno.findUnique({
                where: { alumnoId: Number(alumnoId) }
            });
            if(!alumno){
                return res.status(404).json({ status: 'error', message: `Alumno con ID: ${alumnoId} no encontrado` })
            }
        }

        let porcentajeNum: number | undefined;
        if(porcentaje !== undefined){
            porcentajeNum = Number(porcentaje);
            if(isNaN(porcentajeNum) || porcentajeNum < 0 || porcentajeNum > 100){
                return res.status(400).json({ status: 'error', message: 'El porcentaje debe ser un número entre 0 y 100' });
            }
        }

        const nuevaFechaInicio = fechaInicio !== undefined ? new Date(fechaInicio) : becaActual.fechaInicio;
        if(fechaInicio !== undefined && isNaN(nuevaFechaInicio.getTime())){
            return res.status(400).json({ status: 'error', message: 'La fecha de inicio no es válida' });
        }

        const nuevaFechaFin = fechaFin !== undefined ? (fechaFin ? new Date(fechaFin) : null) : becaActual.fechaFin;
        if(fechaFin && isNaN(nuevaFechaFin!.getTime())){
            return res.status(400).json({ status: 'error', message: 'La fecha de fin no es válida' });
        }

        if(nuevaFechaFin && nuevaFechaFin <= nuevaFechaInicio){
            return res.status(400).json({ status: 'error', message: 'La fecha de fin debe ser posterior a la fecha de inicio' });
        }

        const dataToUpdate: any = {};
        if(alumnoId !== undefined) dataToUpdate.alumnoId = Number(alumnoId);
        if(porcentajeNum !== undefined) dataToUpdate.porcentaje = porcentajeNum;
        if(descripcion !== undefined) dataToUpdate.descripcion = descripcion;
        if(fechaInicio !== undefined) dataToUpdate.fechaInicio = nuevaFechaInicio;
        if(fechaFin !== undefined) dataToUpdate.fechaFin = nuevaFechaFin;
        if(activa !== undefined) dataToUpdate.activa = Boolean(activa);

        const updatedBeca = await prisma.beca.update({
            where: { becaId },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: updatedBeca })
    } catch (error) {
        return handlePrismaError(res, error, `Beca con ID: ${id} no encontrada`, `Error al actualizar la beca con ID ${id}.`);
    };
}

//Delete (logico: no se borra el registro, se desactiva)
export const deleteBecaById = async (req: Request, res: Response ) => {
    const { id } = req.params;

    const becaId = parseId(id);
    if(becaId === null){
        return res.status(400).json({ status: 'error', message: `El ID: ${id} no es un número válido` });
    }

    try {
        const becaActual = await prisma.beca.findUnique({
            where: { becaId }
        });
        if(!becaActual){
            return res.status(404).json({ status: 'error', message: `Beca con ID: ${id} no encontrada` })
        }

        await prisma.beca.update({
            where: { becaId },
            data: { activa: false }
        })

        return res.json({ status: 'success', message: `Se desactivó la beca con ID: ${id} correctamente.`});
    } catch (error) {
        return handlePrismaError(res, error, `Beca con ID: ${id} no encontrada`, `Error al eliminar la beca con ID: ${id}.`);
    }
}

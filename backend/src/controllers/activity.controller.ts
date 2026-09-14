import type { Response, Request } from 'express';
import { prisma } from '../lib/prisma.js';

//Get all
export const getActivities = async (_req: Request, res: Response) => {
    try {
        const activities = await prisma.actividad.findMany({
            include:{
                unidad: {
                    select: { numero: true, cursoSeccionId: true }
                }
            }
        });

        return res.json({ status: 'success', data: activities })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'No se pudo obtener las actividades', error })
    }
}

//Get By ID
export const getActivityById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const activity = await prisma.actividad.findUnique({
            where: { actividadId: Number(id) },
            include: { unidad: true }
        })

        if(!activity){
            return res.status(404).json({ status: 'error', message: `No se encontró la actividad con ID: ${id}.`})
        }

        return res.json({ status: 'success', data: activity })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener la actividad con ID: ${id}.`, error })
    }
}

//Get By Unidad
export const getActivitiesByUnidad = async (req: Request, res: Response) => {
  const { unidadId } = req.params;

  try {
    const activities = await prisma.actividad.findMany({
      where: { unidadId: Number(unidadId) },
      orderBy: { fecha: 'asc' }
    });

    return res.json({ status: 'success', data: activities });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: `Error al obtener actividades para la unidad: ${unidadId}`, error });
  }
};

//Post create
export const createActivity = async (req: Request, res: Response) => {
    const { unidadId, nombre, puntosMaximos, fecha } = req.body;

    if(!unidadId || !nombre || !puntosMaximos || !fecha){
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios.' })
    }

    const parseDate = new Date(fecha); 
    if(isNaN(parseDate.getTime())){
        return res.status(400).json({ status: 'error', message: 'La fecha es invalida'})
    }

    try {
        const newActivity = await prisma.actividad.create({
            data: {
                unidadId: Number(unidadId),
                nombre,
                puntosMaximos: Number(puntosMaximos),
                fecha: parseDate
            }
        })

        return res.status(201).json({
            status: 'success',
            data: newActivity
        })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear una nueva actividad', error })
    }
}

//Put update
export const updateActivity = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { nombre, puntosMaximos, fecha } = req.body;

    try {
        const dataToUpdate: any = {};

        if(nombre) dataToUpdate.nombre = nombre;
        if(puntosMaximos) dataToUpdate.puntosMaximos = Number(puntosMaximos);
        if(fecha){
            const parseDate = new Date(fecha);
            if(isNaN(parseDate.getTime())){
                return res.status(400).json({ status: 'error', message: 'Fecha ingresada invalida.'})
            }
            dataToUpdate.fecha = parseDate;
        }

        const activityUpdated = await prisma.actividad.update({
            where: { actividadId: Number(id) },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: activityUpdated })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar la actividad con ID: ${id}.`, error })
    }
}

//Delete
export const deleteActivity = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await prisma.actividad.delete({
            where: { actividadId: Number(id) }
        })

        return res.json({ status: 'success', message: `Actividad con ID: ${id} eliminada correctamente.` })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el la actividad con ID: ${id}.`, error });
    }
}
import type { Response, Request } from 'express';
import { prisma } from '../lib/prisma.js';

//Get all
export const getActivites = async (req: Request, res: Response) => {
    try {
        const activities = await prisma.actividad.findMany

        return res.json({ status: 'success', data: activities })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: '', error })
    }
}

export const getActivitesById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const activity = await prisma.actividad.findUnique({
            where: { actividadId: Number(id) }
        })

        return res.json({ status: 'success', data: activity })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener la actividad con ID: ${id}.`, error })
    }
}

export const createActivity = async (req: Request, res: Response) => {
    const { unidadId, nombre, puntosMaximos, fecha } = req.body;

    if(!unidadId || !nombre || !puntosMaximos || !fecha ){
        return res.status(400).json({ })
    }

    if(fecha === Date) return res.status(400).json({ status: 'error', message: 'La fecha no es una fecha'}) //Comprobar, creo que mejor es formatear la fecha antes y si no se convierte dar este error

    try {
        const newActivity = await prisma.actividad.create({
            data: {
                unidadId: unidadId,
                nombre: nombre,
                puntosMaximos: Number(puntosMaximos),
                fecha: new Date(fecha)
            }
        })
    } catch (error) {

    }
}
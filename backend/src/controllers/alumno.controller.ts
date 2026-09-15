import type { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

const errorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : 'Error desconocido';
};

//Get All (soporta filtro opcional ?seccionId=N)
export const getAlumnos = async (req: Request, res: Response) => {
    const { seccionId } = req.query;

    try {
        const where: any = {};
        if (seccionId) where.seccionId = Number(seccionId);

        const alumnos = await prisma.alumno.findMany({
            where,
            select: {
                alumnoId: true,
                seccionId: true,
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { select: { seccionId: true, nombre: true, grado: { select: { nombre: true } } } },
            },
            orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
        });

        return res.json({ status: 'success', data: alumnos });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener los alumnos.', error: errorMessage(error) });
    }
};

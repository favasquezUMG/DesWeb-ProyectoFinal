import type { Response, Request } from 'express';
import type { TipoActividad } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { puedeGestionarCursoSeccion } from '../services/acceso.service.js';

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

// Cada unidad vale 100 puntos: 60 de zona (tareas, proyectos...) y 40 de examen.
// La nota final del curso es el promedio de las 4 unidades.
export const PUNTEO_POR_TIPO: Record<TipoActividad, number> = { Zona: 60, Examen: 40 };
const TIPOS = Object.keys(PUNTEO_POR_TIPO) as TipoActividad[];

const leerTipo = (tipo: unknown): TipoActividad | null =>
    TIPOS.includes(tipo as TipoActividad) ? (tipo as TipoActividad) : null;

const cargarUnidad = (unidadId: number) =>
    prisma.unidad.findUnique({
        where: { unidadId },
        include: { cursoSeccion: { include: { seccion: { select: { sedeId: true } } } } },
    });

// Suma de los punteos de un tipo ya asignados en la unidad, sin contar la actividad que se edita
const punteoAsignado = async (unidadId: number, tipo: TipoActividad, excluirActividadId?: number) => {
    const suma = await prisma.actividad.aggregate({
        _sum: { puntosMaximos: true },
        where: {
            unidadId,
            tipo,
            ...(excluirActividadId ? { actividadId: { not: excluirActividadId } } : {}),
        },
    });
    return Number(suma._sum.puntosMaximos ?? 0);
};

const mensajeExcedePunteo = (tipo: TipoActividad, asignado: number) => {
    const maximo = PUNTEO_POR_TIPO[tipo];
    const nombre = tipo === 'Zona' ? 'La zona' : 'El examen';
    return asignado >= maximo
        ? `${nombre} de esta unidad ya tiene ${asignado} de ${maximo} puntos asignados; no quedan puntos disponibles.`
        : `${nombre} de esta unidad vale ${maximo} puntos: solo quedan ${maximo - asignado} disponibles.`;
};

//Post create
export const createActivity = async (req: AuthenticatedRequest, res: Response) => {
    const { unidadId, nombre, puntosMaximos, fecha } = req.body;
    const tipo = req.body.tipo === undefined ? 'Zona' : leerTipo(req.body.tipo);

    if(!unidadId || !nombre?.trim() || !puntosMaximos || !fecha){
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios.' })
    }

    if (!tipo) {
        return res.status(400).json({ status: 'error', message: `El tipo debe ser uno de: ${TIPOS.join(', ')}.` })
    }

    const puntos = Number(puntosMaximos);
    if (isNaN(puntos) || puntos <= 0) {
        return res.status(400).json({ status: 'error', message: 'El punteo debe ser un número mayor a 0.' })
    }

    const parseDate = new Date(fecha);
    if(isNaN(parseDate.getTime())){
        return res.status(400).json({ status: 'error', message: 'La fecha es invalida'})
    }

    try {
        const unidad = await cargarUnidad(Number(unidadId));
        if (!unidad) {
            return res.status(404).json({ status: 'error', message: `No se encontró la unidad con ID: ${unidadId}.` })
        }
        if (!(await puedeGestionarCursoSeccion(req, unidad.cursoSeccion))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos para crear actividades en este curso.' })
        }

        const asignado = await punteoAsignado(unidad.unidadId, tipo);
        if (asignado + puntos > PUNTEO_POR_TIPO[tipo]) {
            return res.status(400).json({ status: 'error', message: mensajeExcedePunteo(tipo, asignado) })
        }

        const newActivity = await prisma.actividad.create({
            data: {
                unidadId: Number(unidadId),
                nombre: nombre.trim(),
                puntosMaximos: puntos,
                fecha: parseDate,
                tipo,
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
export const updateActivity = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { nombre, puntosMaximos, fecha } = req.body;

    try {
        const actividad = await prisma.actividad.findUnique({ where: { actividadId: Number(id) } });
        if (!actividad) {
            return res.status(404).json({ status: 'error', message: `No se encontró la actividad con ID: ${id}.` })
        }

        const unidad = await cargarUnidad(actividad.unidadId);
        if (!unidad || !(await puedeGestionarCursoSeccion(req, unidad.cursoSeccion))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos para editar actividades de este curso.' })
        }

        const tipo = req.body.tipo === undefined ? actividad.tipo : leerTipo(req.body.tipo);
        if (!tipo) {
            return res.status(400).json({ status: 'error', message: `El tipo debe ser uno de: ${TIPOS.join(', ')}.` })
        }

        const puntos = puntosMaximos === undefined ? Number(actividad.puntosMaximos) : Number(puntosMaximos);
        if (isNaN(puntos) || puntos <= 0) {
            return res.status(400).json({ status: 'error', message: 'El punteo debe ser un número mayor a 0.' })
        }

        // Se valida el límite solo si la actividad suma más puntos a su tipo (subir el punteo
        // o pasarla de zona a examen); bajarlo siempre se permite para corregir unidades excedidas
        const sumaMas = tipo !== actividad.tipo || puntos > Number(actividad.puntosMaximos);
        if (sumaMas) {
            const asignado = await punteoAsignado(unidad.unidadId, tipo, actividad.actividadId);
            if (asignado + puntos > PUNTEO_POR_TIPO[tipo]) {
                return res.status(400).json({ status: 'error', message: mensajeExcedePunteo(tipo, asignado) })
            }
        }

        // No se puede bajar el punteo por debajo de una nota ya registrada
        if (puntos < Number(actividad.puntosMaximos)) {
            const notaMayor = await prisma.nota.aggregate({ _max: { valor: true }, where: { actividadId: actividad.actividadId } });
            if (notaMayor._max.valor !== null && Number(notaMayor._max.valor) > puntos) {
                return res.status(400).json({
                    status: 'error',
                    message: `Ya hay notas de hasta ${Number(notaMayor._max.valor)} puntos en esta actividad; el punteo no puede ser menor.`,
                })
            }
        }

        const dataToUpdate: any = { puntosMaximos: puntos, tipo };

        if(nombre?.trim()) dataToUpdate.nombre = nombre.trim();
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

//Delete: borra tambien las notas registradas en la actividad
export const deleteActivity = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const actividad = await prisma.actividad.findUnique({ where: { actividadId: Number(id) } });
        if (!actividad) {
            return res.status(404).json({ status: 'error', message: `No se encontró la actividad con ID: ${id}.` })
        }

        const unidad = await cargarUnidad(actividad.unidadId);
        if (!unidad || !(await puedeGestionarCursoSeccion(req, unidad.cursoSeccion))) {
            return res.status(403).json({ status: 'error', message: 'No tiene permisos para eliminar actividades de este curso.' })
        }

        await prisma.$transaction([
            prisma.nota.deleteMany({ where: { actividadId: Number(id) } }),
            prisma.actividad.delete({ where: { actividadId: Number(id) } }),
        ]);

        return res.json({ status: 'success', message: `Actividad con ID: ${id} eliminada correctamente.` })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el la actividad con ID: ${id}.`, error });
    }
}

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { destinatariosDeEvento, enviarRecordatorioEvento } from "../services/recordatorios.service.js";
import { enviarEnSegundoPlano } from "../services/notificacion.service.js";

//Get all
export const getEvents = async (req: Request, res: Response) => {
    const { sedeId } = req.query;

    try {
        const whereCondition: any = {};

        if(sedeId){
            whereCondition.OR = [
                { sedeId: null},
                { sedeId: Number(sedeId) }
            ];
        }

        const events = await prisma.evento.findMany({
            where: whereCondition,
            orderBy: { fecha: 'asc' },
            include: {
                sede: {
                    select: {
                        nombre: true
                    }
                }
            }
        })

        return res.json({ status: 'success', data: events })
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'No se pudieron obtener los eventos.', error});
    }
}

//Get By ID
export const getEventById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const event = await prisma.evento.findUnique({
            where: { eventoId: Number(id) },
            include: { 
                sede: { 
                    select: {
                        nombre: true 
                    } 
                }
            }
        });

        if (!event) {
            return res.status(404).json({ status: 'error', message: `Evento con ID: ${id} no encontrado` });
        }

        return res.json({ status: 'success', data: event });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al obtener el evento con ID: ${id}.`, error });
    }
};

//Post create
export const createEvent = async (req: Request, res: Response) => {
    const { sedeId, nombre, descripcion, fecha, tipoEvento, enviarRecordatorio } = req.body;

    if (!nombre || !fecha || !tipoEvento) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios' });
    }

    const parsedDate = new Date(fecha);
    if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Fecha invalida' });
    }

    try {
        const newEvent = await prisma.evento.create({
        data: {
            sedeId: sedeId ? Number(sedeId) : null,
            nombre,
            descripcion: descripcion ?? null,
            fecha: parsedDate,
            tipoEvento, //Festivo, Academico, Deportivo, Reunion
            enviarRecordatorio: enviarRecordatorio ?? true
        }
        });

        return res.status(201).json({ status: 'success', data: newEvent });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al crear el evento', error });
    }
};

//Put
export const updateEvent = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { sedeId, nombre, descripcion, fecha, tipoEvento, enviarRecordatorio } = req.body;

    try {
        const dataToUpdate: any = {};

        if (nombre) dataToUpdate.nombre = nombre;
        if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
        if (tipoEvento) dataToUpdate.tipoEvento = tipoEvento;
        if (enviarRecordatorio !== undefined) dataToUpdate.enviarRecordatorio = enviarRecordatorio;
        if (sedeId !== undefined) dataToUpdate.sedeId = sedeId ? Number(sedeId) : null;

        if (fecha) {
            const parsedDate = new Date(fecha);
            if (isNaN(parsedDate.getTime())) {
                return res.status(400).json({ status: 'error', message: 'Fecha inválida' });
            }
            dataToUpdate.fecha = parsedDate;
            // Si cambia la fecha el recordatorio se vuelve a programar
            dataToUpdate.recordatorioEnviadoEn = null;
        }

        const updatedEvento = await prisma.evento.update({
            where: { eventoId: Number(id) },
            data: dataToUpdate
        });

        return res.json({ status: 'success', data: updatedEvento });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al actualizar el evento con ID: ${id}.`, error });
    }
};

//Delete
export const deleteEvent = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        await prisma.evento.delete({
        where: { eventoId: Number(id) }
        });

        return res.json({ status: 'success', message: `Evento con ID: ${id} eliminado correctamente` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al eliminar el evento con ID ${id}`, error });
    }
};

//Post: envia el recordatorio del evento ahora mismo, sin esperar al envio automatico del dia anterior
export const enviarRecordatorioAhora = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const evento = await prisma.evento.findUnique({ where: { eventoId: Number(id) } });

        if (!evento) {
            return res.status(404).json({ status: 'error', message: `Evento con ID: ${id} no encontrado` });
        }

        const destinatarios = await destinatariosDeEvento(evento);
        if (destinatarios.length === 0) {
            return res.status(400).json({ status: 'error', message: 'No hay encargados a quienes enviar el recordatorio.' });
        }

        await prisma.evento.update({
            where: { eventoId: evento.eventoId },
            data: { recordatorioEnviadoEn: new Date() }
        });

        enviarEnSegundoPlano(`Recordatorio "${evento.nombre}"`, () => enviarRecordatorioEvento(evento, destinatarios));

        return res.json({ status: 'success', message: `Enviando recordatorio a ${destinatarios.length} encargado(s).` });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: `Error al enviar el recordatorio del evento con ID: ${id}.`, error });
    }
};

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { destinatariosDeEvento, enviarRecordatorioEvento } from "../services/recordatorios.service.js";
import { enviarEnSegundoPlano } from "../services/notificacion.service.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { esAlcanceGlobal, obtenerNombreRol, ROL, sedeDelAlcance } from "../middlewares/role.middleware.js";

// El personal de sede solo administra los eventos de su sede; los generales (sin sede) son del
// administrador general. Devuelve el sedeId que corresponde guardar, o un mensaje de error.
const sedeParaEvento = async (req: AuthenticatedRequest, pedida: unknown): Promise<{ sedeId: number | null } | { error: string }> => {
    const alcance = await sedeDelAlcance(req);
    if (alcance === null) return { sedeId: pedida ? Number(pedida) : null };
    if (alcance === -1) return { error: "Su usuario no tiene una sede asignada." };
    if (pedida && Number(pedida) !== alcance) return { error: "Solo puede administrar eventos de su sede." };
    return { sedeId: alcance };
};

const puedeEditarEvento = async (req: AuthenticatedRequest, eventoId: number) => {
    const evento = await prisma.evento.findUnique({ where: { eventoId }, select: { sedeId: true } });
    if (!evento) return { codigo: 404, error: `Evento con ID: ${eventoId} no encontrado` };
    const alcance = await sedeDelAlcance(req);
    if (alcance !== null && evento.sedeId !== alcance) {
        return { codigo: 403, error: evento.sedeId === null ? "Los eventos generales los administra el administrador general." : "El evento pertenece a otra sede." };
    }
    return null;
};
import { hijosDe } from "../services/vinculos.service.js";

//Get all
// Sin ?sedeId, quien no es administrador general ve los eventos generales y los de su sede
export const getEvents = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const whereCondition: any = {};
        const rol = await obtenerNombreRol(req);
        let sedeId = req.query.sedeId;
        if (!sedeId && req.user?.sedeId && !esAlcanceGlobal(rol)) {
            sedeId = String(req.user.sedeId);
        }

        if (!req.query.sedeId && rol === ROL.ENCARGADO) {
            // Un encargado puede tener hijos en varias sedes (y no tener sede propia):
            // ve los eventos generales y los de las sedes de sus hijos
            const hijos = await prisma.alumno.findMany({
                where: hijosDe(Number(req.user?.id)),
                select: { seccion: { select: { sedeId: true } } },
            });
            const sedes = [...new Set(hijos.map((h) => h.seccion.sedeId))];
            whereCondition.OR = [{ sedeId: null }, { sedeId: { in: sedes } }];
        } else if (sedeId) {
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
export const createEvent = async (req: AuthenticatedRequest, res: Response) => {
    const { sedeId, nombre, descripcion, fecha, tipoEvento, enviarRecordatorio } = req.body;

    if (!nombre || !fecha || !tipoEvento) {
        return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios' });
    }

    const parsedDate = new Date(fecha);
    if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({ status: 'error', message: 'Fecha invalida' });
    }

    try {
        const sede = await sedeParaEvento(req, sedeId);
        if ("error" in sede) return res.status(403).json({ status: 'error', message: sede.error });

        const newEvent = await prisma.evento.create({
        data: {
            sedeId: sede.sedeId,
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
export const updateEvent = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { sedeId, nombre, descripcion, fecha, tipoEvento, enviarRecordatorio } = req.body;

    try {
        const sinPermiso = await puedeEditarEvento(req, Number(id));
        if (sinPermiso) return res.status(sinPermiso.codigo).json({ status: 'error', message: sinPermiso.error });

        const dataToUpdate: any = {};

        if (nombre) dataToUpdate.nombre = nombre;
        if (descripcion !== undefined) dataToUpdate.descripcion = descripcion;
        if (tipoEvento) dataToUpdate.tipoEvento = tipoEvento;
        if (enviarRecordatorio !== undefined) dataToUpdate.enviarRecordatorio = enviarRecordatorio;
        if (sedeId !== undefined) {
            const sede = await sedeParaEvento(req, sedeId);
            if ("error" in sede) return res.status(403).json({ status: 'error', message: sede.error });
            dataToUpdate.sedeId = sede.sedeId;
        }

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
export const deleteEvent = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const sinPermiso = await puedeEditarEvento(req, Number(id));
        if (sinPermiso) return res.status(sinPermiso.codigo).json({ status: 'error', message: sinPermiso.error });

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

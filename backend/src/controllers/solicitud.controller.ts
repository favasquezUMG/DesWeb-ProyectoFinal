import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

export const crearSolicitud = async (req: Request, res: Response) => {
    const {
        numero,
        modo,
        encargado,
        alumno,
        documentos,
        observaciones,
        fechaSolicitud,
        fechaLimite
    } = req.body;

    if(!numero || !encargado || !alumno){
        return res.status(400).json({
            status: "error",
            message: "Faltan campos obligatorios para registrar la solicitud"
        })
    }

    try {
        let sedeId: number | null = null;
        if(alumno.sede){
            const sedeDB = await prisma.sede.findFirst({
                where: { nombre: alumno.sede, deletedAt: null }
            });
            if(sedeDB) sedeId = sedeDB.sedeId;
        }

        const nuevaSoli = await prisma.solicitud.create({
            data: {
                numero,
                modo: modo === 'publico' ? 'PUBLICO' : 'PRESENCIAL',
                encargadoNombres: encargado.nombres,
                encargadoApellidos: encargado.apellidos,
                encargadoDpi: encargado.dpi,
                encargadoTelefono: encargado.telefono,
                encargadoCorreo: encargado.correo,
                encargadoParentesco: encargado.parentesco,
                alumnoNombres: alumno.nombres,
                alumnoApellidos: alumno.apellidos,
                alumnoFechaNacimiento: new Date(alumno.fechaNacimiento),
                alumnoNivel: alumno.nivel,
                alumnoCarrera: alumno.carrera || null,
                alumnoAnio: alumno.anio || null,
                alumnoGrado: alumno.grado || null,
                sedeId,
                documentos: documentos || [],
                observaciones: observaciones || null,
                fechaSolicitud: new Date(fechaSolicitud),
                fechaLimite: new Date(fechaLimite)
            }
        });

        return res.status(201).json({ status: "success", data: nuevaSoli})
    } catch (error) {
        console.error("»SOLI_CTRL: Error al crear solicitud:", error);
        return res.status(500).json({ status: "error", message: "No se pudo crear la solicitud", error})
    }
}

export const getSolicitudes = async (_req: Request, res: Response) => {
    try {
        const solicitudes = await prisma.solicitud.findMany({})
        
        if(solicitudes.length === 0){
            return res.status(404).json({ status: "error", message: "No hay solicitudes registradas"})
        }

        return res.json({ status: "success", data: solicitudes});
    } catch (error) {
        console.error("»SOL_CTRL: Error al obtener las solicitudes:", error);
        return res.status(500).json({ status: "error", message: "No se pudo obtener las solicitudes", error})
    }
}

export const getSolicitudById = async (req: Request, res: Response) => {
    const { id } = req.params;

    try{
        const solicitud = await prisma.solicitud.findUnique({
            where: { solicitudId: Number(id) }
        });

        if(!solicitud){
            return res.status(404).json({ status: "error", message: `No se encontró una solicitud con ID: ${id}.`})
        }

        return res.json({ status: "success", data: solicitud});
    } catch (error) {
        console.error(`»SOLI_CTRL: Error al obtener la solicitud con ID: ${id}.`, error)
        return res.status(500).json({ status: "error", message: `No se pudo obtener la solicitud con ID: ${id}.`, error})
    }
}

export const getSolicitudByNumero = async (req: Request, res: Response) => {
    const { numero } = req.query;

    if(!numero){
        return res.status(400).json({ status: "error", message: "Faltan campos obligatorios."})
    }

    try{ 
        const solicitud = await prisma.solicitud.findUnique({
            where: { numero: String(numero).trim() }
        })

        if(!solicitud){
            return res.status(404).json({ status: "error", message: `No se encontro ninguna solicitud con numero ${numero}`})
        }

        return res.json({ status: "success", data: solicitud})
    } catch (error) {
        console.error(`»SOLI_CTRL: No se pudo obtener la solicitud con numero ${numero}.`, error)
        return res.status(500).json({ status: "error", message: `No se pudo obtener la solicitud con Numero: ${numero}.`, error})
    }
}

export const getSolicitudByDpiCorreo = async (req: Request, res: Response) => {
    const { dpi, correo } = req.query;

    if(!dpi || !correo){
        return res.status(400).json({ status: "error", message: "Faltan campos obligatorios."})
    }

    try{
        const solicitud = await prisma.solicitud.findFirst({
            where: {
                encargadoDpi: String(dpi).trim(),
                encargadoCorreo: String(correo).trim().toLowerCase()
            },
            include:{
                sede: { select: { nombre: true }}
            },
            orderBy: { createdAt: 'desc'}
        })

        if(!solicitud){
            return res.status(404).json({
                status: "error",
                message: `No se encontro ninguna solicitud con estos datos: DPI:${dpi}, Correo:${correo}.`
            });
        }

        return res.json({ status: "success", data: solicitud})
    } catch (error) {
        console.error("»SOLI_CTRL: No se pudo obtener la solicitud.")
        return res.status(500).json({ status: "error", message: "No se pudo obtener la solicitud con esos parametros.", error})
    }
}

export const updateEstadoSolicitud = async (req: Request, res: Response) => {
    const { id } = req.params;
    const { estado, observaciones } = req.body;

    const estadosValidos = ['PENDIENTE', 'REVISION', 'APROBADA', 'RECHAZADA', 'VENCIDA'];

    if (!estado || !estadosValidos.includes(estado)) {
        return res.status(400).json({ status: 'error', message: 'El estado proporcionado no es válido.'});
    }

    try{
        const solicitud = await prisma.solicitud.findUnique({
            where: { solicitudId: Number(id) }
        })

        if(!solicitud){
            return res.status(404).json({ status: "error", message: `No se pudo encontrar la solicitud con ID: ${id}.`})
        }

        const solicitudActualizada = await prisma.solicitud.update({
            where: { solicitudId: Number(id) },
            data: {
                estado,
                ...(observaciones !== undefined && { observaciones })                
            },
            include:{
                sede: { select: { nombre: true }}
            }
        })

        return res.json({
            status: "success",
            data: solicitudActualizada
        })
    } catch (error) {
        console.error(`»SOLI_CTRL: Error al actualizar el estado de la solicitud con ID: ${id}.`, error)
        return res.status(500).json({ status: "error", message: `No se pudo actualizar el estado de la solicitud con ID: ${id}.`, error})
    }
}
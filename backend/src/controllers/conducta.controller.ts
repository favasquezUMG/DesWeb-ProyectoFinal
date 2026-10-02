import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ROL, esAlcanceGlobal, obtenerNombreRol, puedeOperarSede, tienePermiso } from "../middlewares/role.middleware.js";
import { encargadoTieneAcceso, hijosDe } from "../services/vinculos.service.js";
import { encargadosDeAlumno, enviarADestinatarios } from "../services/notificacion.service.js";
import { plantillaReporteConducta } from "../templates/mail.templates.js";
import { suspenderPorConductaGrave } from "../services/becas.service.js";

const TIPOS_CONDUCTA = ["Positivo", "Leve", "Grave"];

const incluirDetalle = {
    alumno: {
        select: {
            alumnoId: true,
            usuario: { select: { nombres: true, apellidos: true } },
            seccion: { select: { seccionId: true, nombre: true, sedeId: true, grado: { select: { nombre: true } } } },
        },
    },
    autor: { select: { usuarioId: true, nombres: true, apellidos: true } },
};

// GET /api/conducta?alumnoId=N&revisado=true|false
// Cada rol ve solo lo que le corresponde: el encargado los de sus hijos, el catedratico los suyos,
// el admin de sede los de su sede y el admin general todos.
export const getReportesConducta = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, revisado } = req.query;
    const usuarioId = Number(req.user?.id);

    try {
        const rol = await obtenerNombreRol(req);
        const where: Prisma.ReporteConductaWhereInput = {};

        if (alumnoId) where.alumnoId = Number(alumnoId);
        if (revisado === "true" || revisado === "false") where.revisado = revisado === "true";

        if (rol === ROL.ENCARGADO) {
            where.alumno = hijosDe(usuarioId);
        } else if (rol === ROL.CATEDRATICO) {
            where.autorId = usuarioId;
        } else if (rol === ROL.ALUMNO) {
            where.alumnoId = usuarioId;
        } else if (!esAlcanceGlobal(rol)) {
            // Personal de sede (administrador de sede o roles del colegio): solo su sede
            where.alumno = { seccion: { sedeId: Number(req.user?.sedeId) } };
        }

        const reportes = await prisma.reporteConducta.findMany({
            where,
            include: incluirDetalle,
            orderBy: { fecha: "desc" },
        });

        return res.json({ status: "success", data: reportes });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudieron obtener los reportes de conducta.", error });
    }
};

// POST /api/conducta  { alumnoId, tipo, titulo, descripcion }
// Crea el reporte y avisa por correo a los encargados del alumno
export const createReporteConducta = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, tipo, titulo, descripcion } = req.body;
    const autorId = Number(req.user?.id);

    if (!alumnoId || !tipo || !titulo || !descripcion) {
        return res.status(400).json({ status: "error", message: "alumnoId, tipo, titulo y descripcion son obligatorios." });
    }
    if (!TIPOS_CONDUCTA.includes(tipo)) {
        return res.status(400).json({ status: "error", message: `El tipo debe ser uno de: ${TIPOS_CONDUCTA.join(", ")}.` });
    }

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId: Number(alumnoId) },
            include: { usuario: true, seccion: true },
        });
        if (!alumno) {
            return res.status(404).json({ status: "error", message: `Alumno con ID: ${alumnoId} no encontrado` });
        }

        const rol = await obtenerNombreRol(req);
        if (rol === ROL.CATEDRATICO) {
            const imparteEnSeccion = await prisma.cursoSeccion.findFirst({
                where: { seccionId: alumno.seccionId, catedraticoId: autorId },
            });
            if (!imparteEnSeccion) {
                return res.status(403).json({ status: "error", message: "Solo puede reportar alumnos de las secciones donde imparte clases." });
            }
        } else if (!(await puedeOperarSede(req, alumno.seccion.sedeId))) {
            return res.status(403).json({ status: "error", message: "No puede reportar alumnos de otra sede." });
        }

        const reporte = await prisma.reporteConducta.create({
            data: {
                alumnoId: alumno.alumnoId,
                autorId,
                tipo,
                titulo: String(titulo).slice(0, 150),
                descripcion: String(descripcion).slice(0, 1000),
            },
            include: incluirDetalle,
        });

        // Las becas cuyo programa no admite faltas graves quedan suspendidas
        const becasSuspendidas = tipo === "Grave"
            ? await suspenderPorConductaGrave(alumno.alumnoId, reporte.titulo, autorId)
            : 0;

        const nombreAlumno = `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`;
        const autor = `${reporte.autor.nombres} ${reporte.autor.apellidos}`;
        const encargados = await encargadosDeAlumno(alumno.alumnoId);

        const { enviados } = await enviarADestinatarios(
            encargados,
            (d) => ({
                ...plantillaReporteConducta({
                    nombreDestinatario: d.nombre,
                    nombreAlumno,
                    tipo,
                    titulo: reporte.titulo,
                    descripcion: reporte.descripcion,
                    autor,
                    fecha: reporte.fecha,
                }),
                mensaje: `${tipo}: ${reporte.titulo} - ${nombreAlumno}`,
            }),
            "Conducta"
        );

        return res.status(201).json({
            status: "success",
            message:
                (encargados.length === 0
                    ? "Reporte creado. El alumno no tiene encargados registrados para notificar."
                    : `Reporte creado y enviado a ${enviados} de ${encargados.length} encargado(s).`) +
                (becasSuspendidas > 0 ? " La beca del alumno quedó suspendida por la falta grave." : ""),
            data: reporte,
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al crear el reporte de conducta.", error });
    }
};

// PATCH /api/conducta/:id/revisar  { comentario? }
// El encargado confirma que leyo el reporte
export const revisarReporteConducta = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { comentario } = req.body ?? {};
    const encargadoId = Number(req.user?.id);

    try {
        const reporte = await prisma.reporteConducta.findUnique({
            where: { reporteId: Number(id) },
        });
        if (!reporte) {
            return res.status(404).json({ status: "error", message: `Reporte con ID: ${id} no encontrado` });
        }
        if (!(await encargadoTieneAcceso(encargadoId, reporte.alumnoId))) {
            return res.status(403).json({ status: "error", message: "Solo un encargado del alumno puede revisar este reporte." });
        }

        const actualizado = await prisma.reporteConducta.update({
            where: { reporteId: reporte.reporteId },
            data: {
                revisado: true,
                fechaRevision: new Date(),
                comentarioEncargado: comentario ? String(comentario).slice(0, 500) : reporte.comentarioEncargado,
            },
            include: incluirDetalle,
        });

        return res.json({ status: "success", data: actualizado });
    } catch (error) {
        return res.status(500).json({ status: "error", message: `Error al revisar el reporte con ID: ${id}.`, error });
    }
};

// DELETE /api/conducta/:id  (el autor o un administrador de la sede)
export const deleteReporteConducta = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const reporte = await prisma.reporteConducta.findUnique({
            where: { reporteId: Number(id) },
            include: { alumno: { include: { seccion: true } } },
        });
        if (!reporte) {
            return res.status(404).json({ status: "error", message: `Reporte con ID: ${id} no encontrado` });
        }

        const esAutor = reporte.autorId === Number(req.user?.id);
        const esAdminDeLaSede =
            (await tienePermiso(req, "conducta")) && (await puedeOperarSede(req, reporte.alumno.seccion.sedeId));
        if (!esAutor && !esAdminDeLaSede) {
            return res.status(403).json({ status: "error", message: "No tiene permisos para eliminar este reporte." });
        }

        await prisma.reporteConducta.delete({ where: { reporteId: reporte.reporteId } });
        return res.json({ status: "success", message: `Reporte con ID: ${id} eliminado correctamente` });
    } catch (error) {
        return res.status(500).json({ status: "error", message: `Error al eliminar el reporte con ID: ${id}.`, error });
    }
};

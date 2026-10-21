import type { Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { construirBoletin } from "../services/boletin.service.js";
import { accesoPortalDe, MENSAJE_SIN_ACCESO } from "../services/accesoPortal.service.js";
import { clasesDeAlumno, asistenciaDeAlumno } from "../services/alumno.service.js";

// Portal del alumno: todo es de solo lectura y siempre sobre el alumno logueado.

// Corta el paso si la sede (o su nivel) no le da acceso, aunque tenga un token vigente
export const requiereAccesoPortal = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
        const acceso = await accesoPortalDe(Number(req.user?.id));
        if (acceso === null) return res.status(403).json({ status: "error", message: "Solo los alumnos pueden usar esta sección." });
        if (!acceso) return res.status(403).json({ status: "error", message: MENSAJE_SIN_ACCESO });
        return next();
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al verificar el acceso.", error });
    }
};

// GET /api/portal-alumno/perfil
export const getPerfil = async (req: AuthenticatedRequest, res: Response) => {
    const alumnoId = Number(req.user?.id);

    try {
        const alumno = await prisma.alumno.findUnique({
            where: { alumnoId },
            include: {
                usuario: { select: { nombres: true, apellidos: true, email: true } },
                seccion: { include: { grado: true, sede: { select: { nombre: true } } } },
                encargados: {
                    where: { activo: true, restringido: false, esPrincipal: true },
                    include: { encargado: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
                },
            },
        });
        if (!alumno) return res.status(404).json({ status: "error", message: "Alumno no encontrado." });

        const principal = alumno.encargados[0]?.encargado.usuario;

        return res.json({
            status: "success",
            data: {
                alumnoId,
                nombre: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                usuario: alumno.usuario.email,
                grado: alumno.seccion.grado.nombre,
                nivel: alumno.seccion.grado.nivel,
                seccion: alumno.seccion.nombre,
                sede: alumno.seccion.sede.nombre,
                anioLectivo: alumno.seccion.anioLectivo,
                encargadoPrincipal: principal ? `${principal.nombres} ${principal.apellidos}` : null,
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener tu información.", error });
    }
};

// GET /api/portal-alumno/notas
export const getMisNotas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const boletin = await construirBoletin(Number(req.user?.id));
        if (!boletin) return res.status(404).json({ status: "error", message: "Alumno no encontrado." });
        return res.json({ status: "success", data: boletin });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener tus notas.", error });
    }
};

// GET /api/portal-alumno/horario — clases de la sección del alumno, por día y hora
export const getMiHorario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const clases = await clasesDeAlumno(Number(req.user?.id));
        if (!clases) return res.status(404).json({ status: "error", message: "Alumno no encontrado." });
        return res.json({ status: "success", data: clases });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener tu horario.", error });
    }
};

// GET /api/portal-alumno/asistencia — resumen y días con tarde, ausencia o justificación
export const getMiAsistencia = async (req: AuthenticatedRequest, res: Response) => {
    try {
        return res.json({ status: "success", data: await asistenciaDeAlumno(Number(req.user?.id)) });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener tu asistencia.", error });
    }
};

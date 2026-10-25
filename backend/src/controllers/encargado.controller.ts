import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { encargadoTieneAcceso, esResponsableDe, filtroVinculo } from "../services/vinculos.service.js";
import { registrarBitacora } from "../services/bitacora.service.js";
import { formatFecha } from "../lib/fechas.js";
import { construirBoletin } from "../services/boletin.service.js";
import { clasesDeAlumno } from "../services/alumno.service.js";
import { accesoPorNivel, tieneAccesoPortal } from "../services/accesoPortal.service.js";
import { validarPassword } from "../services/usuarios.service.js";
import { ReglaNegocioError } from "../lib/errores.js";
import { actualizarSalud, leerSalud } from "../services/salud.service.js";
import bcrypt from "bcryptjs";

// Vista del encargado (padre, madre, tutor): sus hijos, el boletín de notas,
// las opciones de matrícula y sus preferencias por alumno. Todo pasa por el
// vínculo alumno-encargado vigente.

const nombreCompleto = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

// GET /api/encargado/hijos — alumnos a cargo con lo que el vínculo le permite hacer
export const getHijos = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);

    try {
        const vinculos = await prisma.alumnoEncargado.findMany({
            where: { encargadoId, ...filtroVinculo(), alumno: { usuario: { deletedAt: null } } },
            include: {
                alumno: {
                    include: {
                        usuario: { select: { nombres: true, apellidos: true, email: true } },
                        seccion: { include: { grado: true, sede: { select: { nombre: true } } } },
                        matriculas: { select: { anioLectivo: true, estado: true } },
                    },
                },
            },
            orderBy: { alumno: { usuario: { nombres: "asc" } } },
        });

        return res.json({
            status: "success",
            data: vinculos.map((v) => {
                // Retirado: tiene matrícula del ciclo de su sección pero ninguna activa
                const delCiclo = v.alumno.matriculas.filter((m) => m.anioLectivo === v.alumno.seccion.anioLectivo);
                return {
                alumnoId: v.alumnoId,
                nombre: nombreCompleto(v.alumno.usuario),
                email: v.alumno.usuario.email,
                grado: v.alumno.seccion.grado.nombre,
                seccion: v.alumno.seccion.nombre,
                sede: v.alumno.seccion.sede.nombre,
                sedeId: v.alumno.seccion.sedeId,
                anioLectivo: v.alumno.seccion.anioLectivo,
                retirado: delCiclo.length > 0 && !delCiclo.some((m) => m.estado === "Activa"),
                parentesco: v.parentesco,
                esPrincipal: v.esPrincipal,
                responsableFinanciero: v.responsableFinanciero,
                autorizadoRecoger: v.autorizadoRecoger,
                puedeVerNotas: v.puedeVerNotas,
                puedeVerPagos: v.puedeVerPagos,
                recibeNotificaciones: v.recibeNotificaciones,
                vigenteHasta: v.vigenteHasta ? formatFecha(v.vigenteHasta) : null,
                usuarioPortal: v.alumno.usuario.email,
                accesoPortal: tieneAccesoPortal({ accesoPortal: v.alumno.accesoPortal, nivel: v.alumno.seccion.grado.nivel }),
                accesoPorNivel: accesoPorNivel(v.alumno.seccion.grado.nivel),
                necesidadesApoyo: v.alumno.necesidadesApoyo,
                alergias: v.alumno.alergias,
                medicamentos: v.alumno.medicamentos,
                };
            }),
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener los alumnos a su cargo.", error });
    }
};

// GET /api/encargado/hijos/:alumnoId/notas — boletín del ciclo actual del alumno
export const getBoletinHijo = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);

    try {
        if (!(await encargadoTieneAcceso(encargadoId, alumnoId, "notas"))) {
            return res.status(403).json({ status: "error", message: "No tiene permiso para ver las notas de este alumno." });
        }

        const boletin = await construirBoletin(alumnoId);
        if (!boletin) {
            return res.status(404).json({ status: "error", message: "Alumno no encontrado." });
        }

        return res.json({ status: "success", data: boletin });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener las notas del alumno.", error });
    }
};

// GET /api/encargado/hijos/:alumnoId/horario — clases de la semana. Basta un vínculo vigente
// (un encargado con restricción judicial no puede saber dónde está el alumno a cada hora)
export const getHorarioHijo = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);

    try {
        if (!(await encargadoTieneAcceso(encargadoId, alumnoId))) {
            return res.status(403).json({ status: "error", message: "Este alumno no está a su cargo." });
        }

        const clases = await clasesDeAlumno(alumnoId);
        if (!clases) return res.status(404).json({ status: "error", message: "Alumno no encontrado." });

        return res.json({ status: "success", data: clases });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener el horario del alumno.", error });
    }
};

// GET /api/encargado/hijos/:alumnoId/matricula — historial de matrículas y secciones
// abiertas (año en curso o siguientes) en las que el encargado puede inscribirlo
export const getOpcionesMatricula = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);

    try {
        if (!(await encargadoTieneAcceso(encargadoId, alumnoId))) {
            return res.status(403).json({ status: "error", message: "Este alumno no está a su cargo." });
        }

        const anioActual = new Date().getFullYear();

        const [puedeMatricular, matriculas, secciones] = await Promise.all([
            esResponsableDe(encargadoId, alumnoId),
            prisma.matricula.findMany({
                where: { alumnoId },
                include: { seccion: { include: { grado: true, sede: { select: { nombre: true } } } } },
                orderBy: [{ anioLectivo: "desc" }, { fechaMatricula: "desc" }],
            }),
            prisma.seccion.findMany({
                where: { deletedAt: null, anioLectivo: { gte: anioActual }, sede: { activo: true, deletedAt: null } },
                include: {
                    grado: { include: { mallas: { include: { curso: { select: { nombre: true } } } } } },
                    sede: { select: { sedeId: true, nombre: true } },
                    cursosSeccion: { include: { curso: { select: { nombre: true } } } },
                    _count: { select: { alumnos: true } },
                },
                orderBy: [{ anioLectivo: "asc" }, { sedeId: "asc" }, { grado: { orden: "asc" } }, { nombre: "asc" }],
            }),
        ]);

        return res.json({
            status: "success",
            data: {
                puedeMatricular,
                matriculas: matriculas.map((m) => ({
                    matriculaId: m.matriculaId,
                    anioLectivo: m.anioLectivo,
                    estado: m.estado,
                    fechaMatricula: m.fechaMatricula,
                    grado: m.seccion.grado.nombre,
                    seccion: m.seccion.nombre,
                    sede: m.seccion.sede.nombre,
                })),
                secciones: secciones.map((s) => {
                    // Si la sección aún no tiene cursos asignados se muestra la malla del grado
                    const cursos = s.cursosSeccion.length
                        ? s.cursosSeccion.map((cs) => cs.curso.nombre)
                        : s.grado.mallas.map((m) => m.curso.nombre);
                    return {
                        seccionId: s.seccionId,
                        nombre: s.nombre,
                        anioLectivo: s.anioLectivo,
                        alumnos: s._count.alumnos,
                        grado: { gradoId: s.grado.gradoId, nombre: s.grado.nombre, nivel: s.grado.nivel, orden: s.grado.orden },
                        sede: s.sede,
                        cursos: [...new Set(cursos)].sort((a, b) => a.localeCompare(b, "es")),
                    };
                }),
            },
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener las opciones de matrícula.", error });
    }
};

// PATCH /api/encargado/hijos/:alumnoId/notificaciones { recibeNotificaciones }
// El encargado decide si quiere recibir avisos por correo de ese alumno
export const setNotificacionesHijo = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);
    const { recibeNotificaciones } = req.body ?? {};

    if (typeof recibeNotificaciones !== "boolean") {
        return res.status(400).json({ status: "error", message: "Indique si desea recibir notificaciones." });
    }

    try {
        if (!(await encargadoTieneAcceso(encargadoId, alumnoId))) {
            return res.status(403).json({ status: "error", message: "Este alumno no está a su cargo." });
        }

        await prisma.alumnoEncargado.update({
            where: { alumnoId_encargadoId: { alumnoId, encargadoId } },
            data: { recibeNotificaciones },
        });

        await registrarBitacora(
            encargadoId,
            "Preferencia de notificaciones",
            "Alumno",
            alumnoId,
            `El encargado ${recibeNotificaciones ? "activó" : "desactivó"} las notificaciones por correo.`,
        );

        return res.json({
            status: "success",
            message: recibeNotificaciones ? "Recibirá las notificaciones de este alumno." : "Ya no recibirá notificaciones de este alumno.",
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al guardar la preferencia.", error });
    }
};

// POST /api/encargado/hijos/:alumnoId/password { password }
// El responsable del alumno le asigna una contraseña nueva (los alumnos sin correo propio
// no pueden recuperar la suya por su cuenta)
export const restablecerPasswordHijo = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);

    try {
        if (!(await esResponsableDe(encargadoId, alumnoId))) {
            return res.status(403).json({
                status: "error",
                message: "Solo el contacto principal o el responsable de pagos puede cambiar la contraseña del alumno.",
            });
        }

        const password = validarPassword(req.body?.password);
        await prisma.usuario.update({ where: { usuarioId: alumnoId }, data: { passwordHash: await bcrypt.hash(password, 10) } });

        await registrarBitacora(encargadoId, "Contraseña restablecida", "Alumno", alumnoId, "El encargado asignó una nueva contraseña de acceso al portal.");

        return res.json({ status: "success", message: "Contraseña del alumno actualizada." });
    } catch (error) {
        if (error instanceof ReglaNegocioError) {
            return res.status(error.status).json({ status: "error", message: error.message });
        }
        return res.status(500).json({ status: "error", message: "Error al cambiar la contraseña del alumno.", error });
    }
};

// PUT /api/encargado/hijos/:alumnoId/salud { necesidadesApoyo, alergias, medicamentos }
// El contacto principal o el responsable de pagos mantiene al día la información de salud
export const setSaludHijo = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);
    const alumnoId = Number(req.params.alumnoId);

    try {
        if (!(await esResponsableDe(encargadoId, alumnoId))) {
            return res.status(403).json({
                status: "error",
                message: "Solo el contacto principal o el responsable de pagos puede cambiar la información de salud del alumno.",
            });
        }

        const data = await actualizarSalud(alumnoId, leerSalud(req.body), encargadoId, "El encargado");
        return res.json({ status: "success", message: "Información de salud actualizada.", data });
    } catch (error) {
        if (error instanceof ReglaNegocioError) {
            return res.status(error.status).json({ status: "error", message: error.message });
        }
        return res.status(500).json({ status: "error", message: "Error al guardar la información de salud.", error });
    }
};

import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ROL, obtenerNombreRol } from "../middlewares/role.middleware.js";
import { filtroAlumnoConAcceso, filtroAlumnoSinAcceso, tieneAccesoPortal } from "./accesoPortal.service.js";
import { encargadoTieneAcceso, filtroVinculo } from "./vinculos.service.js";
import { puedeGestionarCursoSeccion, puedeVerAlumno } from "./acceso.service.js";

// Reglas de las tareas con entrega en linea:
//  - Entrega el alumno si tiene acceso al portal; si no (Primaria, o excepcion de la sede), su encargado.
//  - El catedratico del curso ve todas las entregas, las califica (la nota va a Nota) o las devuelve.
//  - Una entrega calificada ya no se puede cambiar; una devuelta se puede volver a entregar.

export type EstadoEntrega = "Entregada" | "Devuelta" | "Calificada";
export type EstadoTarea = "Pendiente" | "Atrasada" | EstadoEntrega;

export const incluirCursoSeccion = {
    unidad: { include: { cursoSeccion: { include: { seccion: { select: { seccionId: true, sedeId: true } }, curso: { select: { nombre: true } } } } } },
} satisfies Prisma.ActividadInclude;

export const cargarTarea = async (actividadId: number) => {
    const actividad = await prisma.actividad.findUnique({ where: { actividadId }, include: incluirCursoSeccion });
    if (!actividad) throw new ReglaNegocioError(`No se encontró la actividad con ID: ${actividadId}.`, 404);
    return actividad;
};

export type TareaCargada = Awaited<ReturnType<typeof cargarTarea>>;

export const exigirGestion = async (req: AuthenticatedRequest, tarea: TareaCargada) => {
    if (!(await puedeGestionarCursoSeccion(req, tarea.unidad.cursoSeccion))) {
        throw new ReglaNegocioError("No tiene permisos sobre las tareas de este curso.", 403);
    }
};

export const exigirAlumnoDeLaSeccion = async (tarea: TareaCargada, alumnoId: number) => {
    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId },
        select: { seccionId: true, accesoPortal: true, seccion: { select: { grado: { select: { nivel: true } } } } },
    });
    if (!alumno || alumno.seccionId !== tarea.unidad.cursoSeccion.seccionId) {
        throw new ReglaNegocioError("El alumno no pertenece a la sección de este curso.", 400);
    }
    return { accesoPortal: tieneAccesoPortal({ accesoPortal: alumno.accesoPortal, nivel: alumno.seccion.grado.nivel }) };
};

// ¿Quien hace la peticion es quien debe entregar por este alumno?
export const puedeEntregarPor = async (req: AuthenticatedRequest, alumnoId: number, accesoPortal: boolean) => {
    const usuarioId = Number(req.user?.id);
    const rol = await obtenerNombreRol(req);
    if (rol === ROL.ALUMNO) return accesoPortal && usuarioId === alumnoId;
    if (rol === ROL.ENCARGADO) return !accesoPortal && (await encargadoTieneAcceso(usuarioId, alumnoId, "notas"));
    return false;
};

export const exigirVerAlumno = async (req: AuthenticatedRequest, alumnoId: number) => {
    if (!(await puedeVerAlumno(req, alumnoId, "notas", "notas"))) {
        throw new ReglaNegocioError("No tiene permisos para ver las tareas de este alumno.", 403);
    }
};

export const vencida = (tarea: { fechaLimite: Date | null }, ahora = new Date()) => !!tarea.fechaLimite && ahora > tarea.fechaLimite;

export const entregaTarde = (tarea: { fechaLimite: Date | null }, entrega: { fechaEntrega: Date; enClase: boolean }) =>
    !entrega.enClase && !!tarea.fechaLimite && entrega.fechaEntrega > tarea.fechaLimite;

export const estadoTarea = (tarea: { fechaLimite: Date | null }, entrega: { estado: string } | null): EstadoTarea =>
    entrega ? (entrega.estado as EstadoEntrega) : vencida(tarea) ? "Atrasada" : "Pendiente";

// La entrega se puede crear o cambiar: no calificada y dentro del plazo (o con atrasadas permitidas)
export const motivoNoEditable = (
    tarea: { aceptaEntregas: boolean; fechaLimite: Date | null; permiteAtrasadas: boolean },
    entrega: { estado: string } | null,
): string | null => {
    if (!tarea.aceptaEntregas) return "Esta actividad no recibe entregas en línea.";
    if (entrega?.estado === "Calificada") return "La entrega ya fue calificada.";
    if (vencida(tarea) && !tarea.permiteAtrasadas) return "La fecha límite ya pasó y esta tarea no acepta entregas atrasadas.";
    return null;
};

// ---------------------------------------------------------------------------
// Avisos dentro del sistema (sin correo: serian demasiados)
// ---------------------------------------------------------------------------

// Quien recibe los avisos de las tareas de cada alumno: el alumno si tiene portal; si no, sus encargados
const destinatariosDeAlumnos = async (alumnoWhere: Prisma.AlumnoWhereInput): Promise<number[]> => {
    const [alumnos, encargados] = await Promise.all([
        prisma.alumno.findMany({ where: { AND: [alumnoWhere, filtroAlumnoConAcceso], usuario: { deletedAt: null } }, select: { alumnoId: true } }),
        prisma.alumnoEncargado.findMany({
            where: { alumno: { AND: [alumnoWhere, filtroAlumnoSinAcceso] }, ...filtroVinculo("notificaciones"), puedeVerNotas: true },
            select: { encargadoId: true },
        }),
    ]);
    return [...new Set([...alumnos.map((a) => a.alumnoId), ...encargados.map((e) => e.encargadoId)])];
};

const avisar = async (usuarioIds: number[], titulo: string, mensaje: string) => {
    if (usuarioIds.length === 0) return;
    try {
        await prisma.notificacion.createMany({
            data: usuarioIds.map((usuarioId) => ({ usuarioId, titulo: titulo.slice(0, 150), mensaje: mensaje.slice(0, 500), tipo: "Tarea" })),
        });
    } catch (error) {
        console.error("❌ No se pudieron registrar los avisos de la tarea:", error);
    }
};

const formatoLimite = (fecha: Date) =>
    fecha.toLocaleString("es-GT", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: process.env.COLEGIO_ZONA_HORARIA || "America/Guatemala" });

export const avisarNuevaTarea = async (tarea: { nombre: string; fechaLimite: Date | null }, seccionId: number, curso: string) => {
    const limite = tarea.fechaLimite ? ` Fecha límite: ${formatoLimite(tarea.fechaLimite)}.` : "";
    await avisar(await destinatariosDeAlumnos({ seccionId }), `Nueva tarea de ${curso}: ${tarea.nombre}`, `Hay una nueva tarea para entregar en línea.${limite}`);
};

export const avisarRevision = async (alumnoId: number, tarea: { nombre: string }, curso: string, calificada: boolean, nota?: number, puntos?: number) => {
    const titulo = calificada ? `Tarea calificada: ${tarea.nombre}` : `Tarea devuelta: ${tarea.nombre}`;
    const mensaje = calificada
        ? `La tarea de ${curso} fue calificada con ${nota} de ${puntos} puntos.`
        : `El catedrático de ${curso} devolvió la tarea para que se corrija y se vuelva a entregar.`;
    await avisar(await destinatariosDeAlumnos({ alumnoId }), titulo, mensaje);
};

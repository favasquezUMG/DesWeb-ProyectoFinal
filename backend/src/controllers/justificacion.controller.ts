import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { puedeOperarSede, sedeDelAlcance } from "../middlewares/role.middleware.js";
import { encargadoTieneAcceso, hijosDe } from "../services/vinculos.service.js";
import { aplicarJustificacion } from "../services/justificaciones.service.js";
import { sendMail } from "../services/mail.service.js";
import { plantillaJustificacion } from "../templates/mail.templates.js";
import { formatFecha, hoyUTC, parseFecha } from "../lib/fechas.js";

const ESTADOS_REVISION = ["Aprobada", "Rechazada"];
// Se puede justificar una falta de hasta un mes atrás, o avisar de una ausencia de hasta un mes adelante
const DIAS_VENTANA = 30;
const MS_DIA = 24 * 60 * 60 * 1000;

const incluirDetalle = {
    alumno: {
        select: {
            alumnoId: true,
            usuario: { select: { nombres: true, apellidos: true } },
            seccion: { select: { nombre: true, sedeId: true, grado: { select: { nombre: true } } } },
        },
    },
    solicitante: { select: { usuarioId: true, nombres: true, apellidos: true, email: true } },
    revisor: { select: { nombres: true, apellidos: true } },
} satisfies Prisma.JustificacionAusenciaInclude;

const aDto = <T extends { fecha: Date }>(j: T) => ({ ...j, fecha: formatFecha(j.fecha) });

// GET /api/justificaciones/mis-hijos
// Para el encargado: asistencia de cada hijo (resumen y días con faltas o tardanzas)
// junto con sus solicitudes de justificación.
export const getAsistenciaHijos = async (req: AuthenticatedRequest, res: Response) => {
    const encargadoId = Number(req.user?.id);

    try {
        const hijos = await prisma.alumno.findMany({
            where: { ...hijosDe(encargadoId, "notas"), usuario: { deletedAt: null } },
            include: {
                usuario: { select: { nombres: true, apellidos: true } },
                seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
                asistencias: {
                    include: { cursoSeccion: { select: { curso: { select: { nombre: true } } } } },
                    orderBy: { fecha: "desc" },
                },
                justificaciones: { include: { revisor: { select: { nombres: true, apellidos: true } } }, orderBy: { fecha: "desc" } },
            },
            orderBy: { usuario: { nombres: "asc" } },
        });

        const data = hijos.map((h) => {
            const cuenta = (estado: string) => h.asistencias.filter((a) => a.estado === estado).length;
            const resumen = {
                presentes: cuenta("Presente"),
                tardes: cuenta("Tarde"),
                ausentes: cuenta("Ausente"),
                justificados: cuenta("Justificado"),
                total: h.asistencias.length,
                porcentaje: 100,
            };
            const computables = resumen.total - resumen.justificados;
            if (computables > 0) {
                resumen.porcentaje = Number((((resumen.presentes + resumen.tardes) / computables) * 100).toFixed(2));
            }

            // Días con algo distinto de "Presente", agrupados por fecha
            const dias = new Map<string, { curso: string; estado: string }[]>();
            for (const a of h.asistencias) {
                if (a.estado === "Presente") continue;
                const k = formatFecha(a.fecha);
                dias.set(k, [...(dias.get(k) ?? []), { curso: a.cursoSeccion.curso.nombre, estado: a.estado }]);
            }

            return {
                alumnoId: h.alumnoId,
                nombre: `${h.usuario.nombres} ${h.usuario.apellidos}`,
                grado: `${h.seccion.grado.nombre} "${h.seccion.nombre}"`,
                resumen,
                dias: [...dias.entries()].map(([fecha, clases]) => ({ fecha, clases })),
                justificaciones: h.justificaciones.map(aDto),
            };
        });

        return res.json({ status: "success", data });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudo obtener la asistencia.", error });
    }
};

// POST /api/justificaciones  { alumnoId, fecha, motivo }
// El encargado solicita justificar la ausencia de su hijo en un día completo
export const solicitarJustificacion = async (req: AuthenticatedRequest, res: Response) => {
    const { alumnoId, fecha, motivo } = req.body ?? {};
    const encargadoId = Number(req.user?.id);

    const fechaDate = parseFecha(fecha);
    if (!alumnoId || !fechaDate || typeof motivo !== "string" || !motivo.trim()) {
        return res.status(400).json({ status: "error", message: "alumnoId, fecha (YYYY-MM-DD) y motivo son obligatorios." });
    }

    const diferencia = Math.round((fechaDate.getTime() - hoyUTC().getTime()) / MS_DIA);
    if (Math.abs(diferencia) > DIAS_VENTANA) {
        return res.status(400).json({
            status: "error",
            message: `Solo se pueden justificar ausencias de los últimos ${DIAS_VENTANA} días o avisar de las próximas ${DIAS_VENTANA}.`,
        });
    }

    try {
        if (!(await encargadoTieneAcceso(encargadoId, Number(alumnoId), "notas"))) {
            return res.status(403).json({ status: "error", message: "No puede solicitar justificaciones para este alumno." });
        }

        const existente = await prisma.justificacionAusencia.findUnique({
            where: { alumnoId_fecha: { alumnoId: Number(alumnoId), fecha: fechaDate } },
        });
        if (existente && existente.estado !== "Rechazada") {
            return res.status(409).json({
                status: "error",
                message: existente.estado === "Aprobada"
                    ? "La ausencia de ese día ya está justificada."
                    : "Ya hay una solicitud pendiente para ese día.",
            });
        }

        // Una solicitud rechazada se puede volver a enviar (por ejemplo, con la constancia)
        const datos = {
            motivo: motivo.trim().slice(0, 500),
            estado: "Pendiente",
            solicitanteId: encargadoId,
            revisorId: null,
            comentario: null,
            fechaSolicitud: new Date(),
            fechaRevision: null,
        };
        const justificacion = existente
            ? await prisma.justificacionAusencia.update({ where: { justificacionId: existente.justificacionId }, data: datos })
            : await prisma.justificacionAusencia.create({ data: { ...datos, alumnoId: Number(alumnoId), fecha: fechaDate } });

        return res.status(201).json({
            status: "success",
            message: "Solicitud enviada. La administración de la sede la revisará.",
            data: aDto(justificacion),
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudo enviar la solicitud.", error });
    }
};

// DELETE /api/justificaciones/:id  (el encargado retira una solicitud aún pendiente)
export const cancelarJustificacion = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const j = await prisma.justificacionAusencia.findUnique({ where: { justificacionId: Number(id) } });
        if (!j || !(await encargadoTieneAcceso(Number(req.user?.id), j.alumnoId))) {
            return res.status(404).json({ status: "error", message: `Solicitud con ID: ${id} no encontrada` });
        }
        if (j.estado !== "Pendiente") {
            return res.status(400).json({ status: "error", message: "Solo se pueden retirar solicitudes pendientes." });
        }

        await prisma.justificacionAusencia.delete({ where: { justificacionId: j.justificacionId } });
        return res.json({ status: "success", message: "Solicitud retirada." });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudo retirar la solicitud.", error });
    }
};

// GET /api/justificaciones?estado=Pendiente
// Para la administración: solicitudes de los alumnos de su sede
export const getJustificaciones = async (req: AuthenticatedRequest, res: Response) => {
    const { estado } = req.query;

    try {
        const sedeId = await sedeDelAlcance(req);
        const where: Prisma.JustificacionAusenciaWhereInput = {};
        if (typeof estado === "string" && estado) where.estado = estado;
        if (sedeId !== null) where.alumno = { seccion: { sedeId } };

        const justificaciones = await prisma.justificacionAusencia.findMany({
            where,
            include: incluirDetalle,
            orderBy: [{ fechaSolicitud: "desc" }],
            take: 200,
        });

        // Clases que el alumno tiene registradas ese día, para que quien revisa vea el impacto
        const data = await Promise.all(justificaciones.map(async (j) => {
            const clases = await prisma.asistencia.findMany({
                where: { alumnoId: j.alumnoId, fecha: j.fecha },
                select: { estado: true, cursoSeccion: { select: { curso: { select: { nombre: true } } } } },
            });
            return { ...aDto(j), clases: clases.map((c) => ({ curso: c.cursoSeccion.curso.nombre, estado: c.estado })) };
        }));

        return res.json({ status: "success", data });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudieron obtener las justificaciones.", error });
    }
};

// PATCH /api/justificaciones/:id/revisar  { estado: "Aprobada" | "Rechazada", comentario? }
export const revisarJustificacion = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;
    const { estado, comentario } = req.body ?? {};

    if (!ESTADOS_REVISION.includes(estado)) {
        return res.status(400).json({ status: "error", message: `El estado debe ser uno de: ${ESTADOS_REVISION.join(", ")}.` });
    }
    if (estado === "Rechazada" && (typeof comentario !== "string" || !comentario.trim())) {
        return res.status(400).json({ status: "error", message: "Indique el motivo del rechazo." });
    }

    try {
        const j = await prisma.justificacionAusencia.findUnique({
            where: { justificacionId: Number(id) },
            include: incluirDetalle,
        });
        if (!j) {
            return res.status(404).json({ status: "error", message: `Solicitud con ID: ${id} no encontrada` });
        }
        if (!(await puedeOperarSede(req, j.alumno.seccion.sedeId))) {
            return res.status(403).json({ status: "error", message: "No puede revisar solicitudes de otra sede." });
        }
        if (j.estado !== "Pendiente") {
            return res.status(400).json({ status: "error", message: `La solicitud ya fue ${j.estado.toLowerCase()}.` });
        }

        const aprobada = estado === "Aprobada";
        const [actualizada, aplicadas] = await prisma.$transaction(async (tx) => {
            const act = await tx.justificacionAusencia.update({
                where: { justificacionId: j.justificacionId },
                data: {
                    estado,
                    revisorId: Number(req.user?.id),
                    comentario: typeof comentario === "string" && comentario.trim() ? comentario.trim().slice(0, 300) : null,
                    fechaRevision: new Date(),
                },
                include: incluirDetalle,
            });
            const { count } = aprobada ? await aplicarJustificacion(j.alumnoId, j.fecha, tx) : { count: 0 };
            return [act, count] as const;
        });

        const nombreAlumno = `${j.alumno.usuario.nombres} ${j.alumno.usuario.apellidos}`;
        const { subject, html } = plantillaJustificacion({
            nombreDestinatario: j.solicitante.nombres,
            nombreAlumno,
            fecha: j.fecha,
            aprobada,
            comentario: actualizada.comentario,
        });
        await sendMail({
            to: j.solicitante.email,
            subject,
            html,
            usuarioId: j.solicitante.usuarioId,
            mensaje: `Justificación del ${formatFecha(j.fecha)} ${aprobada ? "aprobada" : "rechazada"} - ${nombreAlumno}`,
            tipo: "Asistencia",
        });

        return res.json({
            status: "success",
            message: aprobada
                ? `Justificación aprobada${aplicadas > 0 ? `: ${aplicadas} falta(s) quedaron justificadas` : ""}.`
                : "Justificación rechazada.",
            data: aDto(actualizada),
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudo revisar la solicitud.", error });
    }
};

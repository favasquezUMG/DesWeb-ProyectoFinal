import type { Request, Response } from "express";
import { sendMail } from "../services/mail.service.js";
import {
    plantillaNotificacionGeneral,
    plantillaRecordatorioEvento,
    plantillaMatricula,
    plantillaBoletaNotas,
    plantillaReporteConducta,
    plantillaComunicado,
} from "../templates/mail.templates.js";

type PlantillaResult = { subject: string; html: string };

// Cada plantilla se arma con datos de ejemplo; cualquier campo del body los sobrescribe
const PLANTILLAS: Record<string, (body: any) => PlantillaResult> = {
    general: (b) =>
        plantillaNotificacionGeneral({
            nombreDestinatario: b.nombreDestinatario,
            titulo: b.titulo ?? "Correo de prueba",
            mensaje: b.mensaje ?? "Este es un correo de prueba del servicio de notificaciones del Sistema Escolar.",
        }),
    "recordatorio-evento": (b) =>
        plantillaRecordatorioEvento({
            nombreDestinatario: b.nombreDestinatario ?? "Encargado1 Prueba",
            nombreEvento: b.nombreEvento ?? "Acto cívico de Independencia",
            fecha: b.fecha ?? "2026-10-15",
            descripcion: b.descripcion ?? "Acto cívico y desfile. Asistir con uniforme de gala.",
            esManana: b.esManana ?? true,
        }),
    matricula: (b) =>
        plantillaMatricula({
            nombreDestinatario: b.nombreDestinatario ?? "Encargado1 Prueba",
            nombreAlumno: b.nombreAlumno ?? "Alumno1 Prueba",
            estado: b.estado === "Rechazada" ? "Rechazada" : "Aceptada",
            motivo: b.motivo ?? null,
        }),
    boleta: (b) =>
        plantillaBoletaNotas({
            nombreDestinatario: b.nombreDestinatario ?? "Encargado1 Prueba",
            nombreAlumno: b.nombreAlumno ?? "Alumno1 Prueba",
            seccion: b.seccion ?? 'Primero Primaria "A"',
            cursos: b.cursos ?? [
                { curso: "Matemática", unidades: [{ numero: 1, nota: 20 }, { numero: 2, nota: 18 }, { numero: 3, nota: 22 }], total: 60 },
                { curso: "Comunicación y Lenguaje", unidades: [{ numero: 1, nota: 23 }, { numero: 2, nota: 21 }, { numero: 3, nota: 24 }], total: 68 },
            ],
        }),
    conducta: (b) =>
        plantillaReporteConducta({
            nombreDestinatario: b.nombreDestinatario ?? "Encargado1 Prueba",
            nombreAlumno: b.nombreAlumno ?? "Alumno1 Prueba",
            tipo: b.tipo ?? "Leve",
            titulo: b.titulo ?? "Uso de celular en clase",
            descripcion: b.descripcion ?? "El alumno utilizó el celular durante la explicación después de dos llamados de atención.",
            autor: b.autor ?? "Catedratico1 Prueba",
            fecha: b.fecha ?? new Date(),
        }),
    comunicado: (b) =>
        plantillaComunicado({
            nombreDestinatario: b.nombreDestinatario ?? "Encargado1 Prueba",
            tipo: b.tipo ?? "Aviso",
            titulo: b.titulo ?? "Reunión de padres de familia",
            mensaje: b.mensaje ?? "Se convoca a reunión de padres el viernes a las 16:00 horas en el salón de actos.",
        }),
};

// POST /api/mail/test y /api/mail/test/:plantilla  { to, usuarioId?, ...datos de la plantilla }
export const testMail = async (req: Request, res: Response) => {
    const nombrePlantilla = String(req.params.plantilla ?? "general");
    const { to, usuarioId, mensaje } = req.body;

    if (!to) {
        return res.status(400).json({ status: "error", message: 'El campo "to" es obligatorio.' });
    }

    const armarPlantilla = PLANTILLAS[nombrePlantilla];
    if (!armarPlantilla) {
        return res.status(400).json({
            status: "error",
            message: `Plantilla inválida. Las plantillas disponibles son: ${Object.keys(PLANTILLAS).join(", ")}`,
        });
    }

    const { subject, html } = armarPlantilla(req.body);

    const enviado = await sendMail({
        to,
        subject,
        html,
        usuarioId: usuarioId ? Number(usuarioId) : undefined,
        mensaje,
    });

    if (!enviado) {
        return res.status(502).json({ status: "error", message: "No se pudo enviar el correo, revisa los logs del servidor." });
    }

    return res.json({ status: "success", message: `Correo "${nombrePlantilla}" enviado a ${to}.` });
};

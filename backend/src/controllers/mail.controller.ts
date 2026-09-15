import type { Request, Response } from "express";
import { sendMail } from "../services/mail.service.js";
import { plantillaNotificacionGeneral } from "../templates/mail.templates.js";

/**
 * Endpoint temporal para probar el envío de correo. Quitar antes de producción.
 */
export const testMail = async (req: Request, res: Response) => {
    const { to, usuarioId, titulo, mensaje } = req.body;

    if (!to) {
        return res.status(400).json({ status: "error", message: 'El campo "to" es obligatorio.' });
    }

    const { subject, html } = plantillaNotificacionGeneral({
        titulo: titulo ?? "Correo de prueba",
        mensaje: mensaje ?? "Este es un correo de prueba del servicio de notificaciones del Sistema Escolar.",
    });

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

    return res.json({ status: "success", message: `Correo enviado a ${to}.` });
};

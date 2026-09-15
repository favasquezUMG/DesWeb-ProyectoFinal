import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
});

// Convierte el html a texto plano simple, para guardarlo en Notificacion.mensaje
const htmlATextoPlano = (html: string): string =>
    html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

interface SendMailParams {
    to: string;
    subject: string;
    html: string;
    /** Si se provee, ademas se registra la notificación en la tabla Notificacion */
    usuarioId?: number;
    /** Texto para Notificacion.mensaje. Si no se da, se deriva del html. */
    mensaje?: string;
}

/**
 * Envía un correo por SMTP y, si se provee usuarioId, registra la notificación
 * en la base de datos. Un fallo en el envío del correo NUNCA lanza: se loguea
 * y se devuelve false para que la operación que llamó a sendMail continue.
 */
export const sendMail = async ({ to, subject, html, usuarioId, mensaje }: SendMailParams): Promise<boolean> => {
    let enviado = false;

    try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || process.env.MAIL_USER,
            to,
            subject,
            html,
        });
        enviado = true;
    } catch (error) {
        console.error(`❌ Error al enviar correo a ${to}:`, error);
    }

    if (usuarioId) {
        try {
            await prisma.notificacion.create({
                data: {
                    usuarioId,
                    titulo: subject.slice(0, 150),
                    mensaje: (mensaje ?? htmlATextoPlano(html)).slice(0, 500),
                },
            });
        } catch (error) {
            console.error(`❌ Error al registrar la notificación para el usuario ${usuarioId}:`, error);
        }
    }

    return enviado;
};

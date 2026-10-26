import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";

const transporter = nodemailer.createTransport({
    // pool reutiliza la conexion SMTP en los envios masivos (comunicados, boletas, recordatorios)
    pool: true,
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT) || 587,
    secure: Number(process.env.MAIL_PORT) === 465,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD,
    },
});

const htmlATextoPlano = (html: string): string =>
    html
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

// Con MAIL_DOMINIOS_PERMITIDOS (ej. "gmail.com") solo se envia a esos dominios: en desarrollo evita
// gastar la cuota de Gmail en los correos ficticios del seed. Sin la variable se envia a todos.
export const correoPermitido = (email: string): boolean => {
    const permitidos = (process.env.MAIL_DOMINIOS_PERMITIDOS ?? "")
        .split(",")
        .map((d) => d.trim().toLowerCase())
        .filter(Boolean);
    if (permitidos.length === 0) return true;
    const dominio = email.split("@")[1]?.toLowerCase() ?? "";
    return permitidos.includes(dominio);
};

interface SendMailParams {
    to: string;
    subject: string;
    html: string;
    usuarioId?: number;
    mensaje?: string;
    tipo?: string;
}

export const sendMail = async ({ to, subject, html, usuarioId, mensaje, tipo }: SendMailParams): Promise<boolean> => {
    let enviado = false;

    // La notificacion dentro del sistema se registra igual aunque el correo se omita
    if (!correoPermitido(to)) {
        console.log(`↷ Correo omitido (dominio no permitido): ${to}`);
    } else try {
        await transporter.sendMail({
            from: process.env.MAIL_FROM || `"${process.env.COLEGIO_NOMBRE || 'Colegio Vanguardia'}" <${process.env.MAIL_USER}>`,
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
                    ...(tipo ? { tipo: tipo.slice(0, 20) } : {}),
                },
            });
        } catch (error) {
            console.error(`❌ Error al registrar la notificación para el usuario ${usuarioId}:`, error);
        }
    }

    return enviado;
};

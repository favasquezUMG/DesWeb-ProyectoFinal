import { resolve4 } from "node:dns/promises";
import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "../lib/prisma.js";

// nodemailer elige al azar entre las IP del host (IPv4 e IPv6) y Render no tiene salida por IPv6:
// la mitad de los envios fallaba con ENETUNREACH. Se conecta siempre por IPv4 y el nombre real
// del host va en servername para que el certificado TLS se valide igual.
const crearTransporter = async (): Promise<Transporter> => {
    const host = process.env.MAIL_HOST;
    const [ipv4] = host ? await resolve4(host).catch(() => []) : [];

    return nodemailer.createTransport({
        // pool reutiliza la conexion SMTP en los envios masivos (comunicados, boletas, recordatorios)
        pool: true,
        host: ipv4 ?? host,
        port: Number(process.env.MAIL_PORT) || 587,
        secure: Number(process.env.MAIL_PORT) === 465,
        ...(host ? { tls: { servername: host } } : {}),
        auth: {
            user: process.env.MAIL_USER,
            pass: process.env.MAIL_PASSWORD,
        },
    });
};

let transporter: Promise<Transporter> | null = null;
const getTransporter = () => (transporter ??= crearTransporter());

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
        await (await getTransporter()).sendMail({
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

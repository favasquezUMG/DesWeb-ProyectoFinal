import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { sendMail } from "./mail.service.js";

export interface Destinatario {
    usuarioId: number;
    email: string;
    nombre: string;
}

type ContenidoCorreo = { subject: string; html: string; mensaje?: string };

const seleccionUsuario = { usuarioId: true, email: true, nombres: true, apellidos: true } as const;

const aDestinatario = (u: { usuarioId: number; email: string; nombres: string; apellidos: string }): Destinatario => ({
    usuarioId: u.usuarioId,
    email: u.email,
    nombre: `${u.nombres} ${u.apellidos}`,
});

// Usuarios activos que cumplan el filtro, sin repetidos
export const buscarDestinatarios = async (where: Prisma.UsuarioWhereInput): Promise<Destinatario[]> => {
    const usuarios = await prisma.usuario.findMany({
        where: { ...where, deletedAt: null },
        select: seleccionUsuario,
    });
    return usuarios.map(aDestinatario);
};

export const encargadosDeAlumno = (alumnoId: number) =>
    buscarDestinatarios({ encargado: { alumnosEncargado: { some: { alumnoId } } } });

// Encargados de todos los alumnos que cumplan el filtro (por sede, seccion, etc.)
export const encargadosDeAlumnos = (alumnoWhere: Prisma.AlumnoWhereInput) =>
    buscarDestinatarios({ encargado: { alumnosEncargado: { some: { alumno: alumnoWhere } } } });

// Envia un correo personalizado a cada destinatario (y registra su Notificacion).
// Es secuencial a proposito: el transporter usa pool y asi no se satura el SMTP.
export const enviarADestinatarios = async (
    destinatarios: Destinatario[],
    construir: (d: Destinatario) => ContenidoCorreo,
    tipo: string,
): Promise<{ enviados: number; fallidos: number }> => {
    let enviados = 0;
    let fallidos = 0;

    for (const d of destinatarios) {
        const { subject, html, mensaje } = construir(d);
        const ok = await sendMail({ to: d.email, subject, html, usuarioId: d.usuarioId, mensaje, tipo });
        if (ok) enviados++;
        else fallidos++;
    }

    return { enviados, fallidos };
};

// Para envios grandes: se responde al cliente de inmediato y el envio sigue en segundo plano
export const enviarEnSegundoPlano = (descripcion: string, envio: () => Promise<{ enviados: number; fallidos: number }>) => {
    envio()
        .then(({ enviados, fallidos }) => {
            console.log(`📧 ${descripcion}: ${enviados} enviados, ${fallidos} fallidos.`);
        })
        .catch((error) => {
            console.error(`❌ Error en el envío "${descripcion}":`, error);
        });
};

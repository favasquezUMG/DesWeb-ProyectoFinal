import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { correoPermitido, sendMail } from "./mail.service.js";
import { filtroVinculo } from "./vinculos.service.js";

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

// Solo los encargados con vinculo vigente que aceptan notificaciones. Con "notas" o "pagos"
// ademas deben tener permiso de ver esa informacion (ej. un padre sin custodia que paga
// pero no recibe boletas, o un encargado con restriccion judicial que no recibe nada).
const vinculoNotificable = (tambien?: "notas" | "pagos"): Prisma.AlumnoEncargadoWhereInput => ({
    ...filtroVinculo("notificaciones"),
    ...(tambien === "notas" ? { puedeVerNotas: true } : {}),
    ...(tambien === "pagos" ? { puedeVerPagos: true } : {}),
});

export const encargadosDeAlumno = (alumnoId: number, tambien?: "notas" | "pagos") =>
    buscarDestinatarios({ encargado: { alumnosEncargado: { some: { alumnoId, ...vinculoNotificable(tambien) } } } });

// Encargados de todos los alumnos que cumplan el filtro (por sede, seccion, etc.)
export const encargadosDeAlumnos = (alumnoWhere: Prisma.AlumnoWhereInput) =>
    buscarDestinatarios({ encargado: { alumnosEncargado: { some: { alumno: alumnoWhere, ...vinculoNotificable() } } } });

// Envia un correo personalizado a cada destinatario (y registra su Notificacion).
// Es secuencial a proposito: el transporter usa pool y asi no se satura el SMTP.
export const enviarADestinatarios = async (
    destinatarios: Destinatario[],
    construir: (d: Destinatario) => ContenidoCorreo,
    tipo: string,
): Promise<{ enviados: number; fallidos: number; omitidos: number }> => {
    let enviados = 0;
    let fallidos = 0;
    let omitidos = 0;

    for (const d of destinatarios) {
        const { subject, html, mensaje } = construir(d);
        const permitido = correoPermitido(d.email);
        const ok = await sendMail({ to: d.email, subject, html, usuarioId: d.usuarioId, mensaje, tipo });
        if (!permitido) omitidos++;
        else if (ok) enviados++;
        else fallidos++;
    }

    return { enviados, fallidos, omitidos };
};

// Para envios grandes: se responde al cliente de inmediato y el envio sigue en segundo plano
export const enviarEnSegundoPlano = (descripcion: string, envio: () => Promise<{ enviados: number; fallidos: number; omitidos?: number }>) => {
    envio()
        .then(({ enviados, fallidos, omitidos }) => {
            console.log(`📧 ${descripcion}: ${enviados} enviados, ${fallidos} fallidos${omitidos ? `, ${omitidos} omitidos por dominio` : ""}.`);
        })
        .catch((error) => {
            console.error(`❌ Error en el envío "${descripcion}":`, error);
        });
};

import type { Response } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { esAlcanceGlobal, obtenerNombreRol, puedeOperarSede } from "../middlewares/role.middleware.js";
import {
    buscarDestinatarios,
    encargadosDeAlumnos,
    enviarADestinatarios,
    enviarEnSegundoPlano,
    type Destinatario,
} from "../services/notificacion.service.js";
import { plantillaComunicado } from "../templates/mail.templates.js";

const TIPOS_COMUNICADO = ["Aviso", "Sancion", "Actividad", "Asueto"];
const DESTINOS = ["encargados", "catedraticos", "alumnos", "todos", "seccion"] as const;
type Destino = (typeof DESTINOS)[number];

const ETIQUETA_DESTINO: Record<Destino, string> = {
    encargados: "Padres y encargados",
    catedraticos: "Catedráticos",
    alumnos: "Alumnos",
    todos: "Toda la comunidad",
    seccion: "Encargados de sección",
};

const sinRepetidos = (lista: Destinatario[]): Destinatario[] => [
    ...new Map(lista.map((d) => [d.usuarioId, d])).values(),
];

const resolverDestinatarios = async (
    destino: Destino,
    sedeId: number | null,
    seccionId?: number,
): Promise<Destinatario[]> => {
    const alumnoDeSede: Prisma.AlumnoWhereInput = sedeId ? { seccion: { sedeId } } : {};

    switch (destino) {
        case "encargados":
            return encargadosDeAlumnos(alumnoDeSede);
        case "catedraticos":
            return buscarDestinatarios({ catedratico: { isNot: null }, ...(sedeId ? { sedeId } : {}) });
        case "alumnos":
            return buscarDestinatarios({ alumno: sedeId ? { is: alumnoDeSede } : { isNot: null } });
        case "seccion":
            return encargadosDeAlumnos({ seccionId });
        case "todos": {
            const [encargados, catedraticos, alumnos] = await Promise.all([
                resolverDestinatarios("encargados", sedeId),
                resolverDestinatarios("catedraticos", sedeId),
                resolverDestinatarios("alumnos", sedeId),
            ]);
            return sinRepetidos([...encargados, ...catedraticos, ...alumnos]);
        }
    }
};

// POST /api/notificaciones/comunicados  { tipo, titulo, mensaje, destino, seccionId?, sedeId? }
// El admin de sede siempre envia a su sede; el admin general puede elegir sede o enviar a todas.
export const enviarComunicado = async (req: AuthenticatedRequest, res: Response) => {
    const { tipo, titulo, mensaje, destino, seccionId } = req.body;

    if (!tipo || !titulo || !mensaje || !destino) {
        return res.status(400).json({ status: "error", message: "tipo, titulo, mensaje y destino son obligatorios." });
    }
    if (!TIPOS_COMUNICADO.includes(tipo)) {
        return res.status(400).json({ status: "error", message: `El tipo debe ser uno de: ${TIPOS_COMUNICADO.join(", ")}.` });
    }
    if (!DESTINOS.includes(destino)) {
        return res.status(400).json({ status: "error", message: `El destino debe ser uno de: ${DESTINOS.join(", ")}.` });
    }
    if (destino === "seccion" && !seccionId) {
        return res.status(400).json({ status: "error", message: "seccionId es obligatorio cuando el destino es 'seccion'." });
    }

    try {
        const rol = await obtenerNombreRol(req);
        let sedeId: number | null =
            !esAlcanceGlobal(rol) ? Number(req.user?.sedeId) : req.body.sedeId ? Number(req.body.sedeId) : null;
        let etiqueta = ETIQUETA_DESTINO[destino as Destino];

        if (destino === "seccion") {
            const seccion = await prisma.seccion.findUnique({
                where: { seccionId: Number(seccionId) },
                include: { grado: true },
            });
            if (!seccion) {
                return res.status(404).json({ status: "error", message: `Sección con ID: ${seccionId} no encontrada` });
            }
            if (!(await puedeOperarSede(req, seccion.sedeId))) {
                return res.status(403).json({ status: "error", message: "No puede enviar comunicados a secciones de otra sede." });
            }
            sedeId = seccion.sedeId;
            etiqueta = `Encargados — ${seccion.grado.nombre} "${seccion.nombre}"`;
        }

        const destinatarios = await resolverDestinatarios(destino as Destino, sedeId, Number(seccionId));

        if (destinatarios.length === 0) {
            return res.status(400).json({ status: "error", message: "No hay destinatarios para el grupo seleccionado." });
        }

        const comunicado = await prisma.comunicado.create({
            data: {
                sedeId,
                autorId: Number(req.user?.id),
                tipo,
                titulo: String(titulo).slice(0, 150),
                mensaje: String(mensaje).slice(0, 2000),
                destinatarios: etiqueta.slice(0, 150),
                totalDestinatarios: destinatarios.length,
            },
        });

        enviarEnSegundoPlano(`Comunicado #${comunicado.comunicadoId}`, () =>
            enviarADestinatarios(
                destinatarios,
                (d) => ({
                    ...plantillaComunicado({ nombreDestinatario: d.nombre, tipo, titulo: comunicado.titulo, mensaje: comunicado.mensaje }),
                    mensaje: comunicado.mensaje,
                }),
                tipo
            )
        );

        return res.status(201).json({
            status: "success",
            message: `Comunicado en envío a ${destinatarios.length} destinatario(s).`,
            data: comunicado,
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al enviar el comunicado.", error });
    }
};

// GET /api/notificaciones/comunicados  (historial; el admin de sede ve los de su sede y los generales)
export const getComunicados = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rol = await obtenerNombreRol(req);
        const where: Prisma.ComunicadoWhereInput =
            !esAlcanceGlobal(rol) ? { OR: [{ sedeId: Number(req.user?.sedeId) }, { sedeId: null }] } : {};

        const comunicados = await prisma.comunicado.findMany({
            where,
            include: {
                autor: { select: { nombres: true, apellidos: true } },
                sede: { select: { nombre: true } },
            },
            orderBy: { fechaEnvio: "desc" },
            take: 100,
        });

        return res.json({ status: "success", data: comunicados });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudieron obtener los comunicados.", error });
    }
};

// GET /api/notificaciones/mias?noLeidas=true
export const getMisNotificaciones = async (req: AuthenticatedRequest, res: Response) => {
    const { noLeidas } = req.query;

    try {
        const notificaciones = await prisma.notificacion.findMany({
            where: { usuarioId: Number(req.user?.id), ...(noLeidas === "true" ? { leida: false } : {}) },
            orderBy: { fechaEnvio: "desc" },
            take: 100,
        });

        return res.json({ status: "success", data: notificaciones });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "No se pudieron obtener las notificaciones.", error });
    }
};

// PATCH /api/notificaciones/:id/leida
export const marcarNotificacionLeida = async (req: AuthenticatedRequest, res: Response) => {
    const { id } = req.params;

    try {
        const { count } = await prisma.notificacion.updateMany({
            where: { notificacionId: Number(id), usuarioId: Number(req.user?.id) },
            data: { leida: true },
        });

        if (count === 0) {
            return res.status(404).json({ status: "error", message: `Notificación con ID: ${id} no encontrada` });
        }

        return res.json({ status: "success", message: "Notificación marcada como leída." });
    } catch (error) {
        return res.status(500).json({ status: "error", message: `Error al actualizar la notificación con ID: ${id}.`, error });
    }
};

// PATCH /api/notificaciones/leidas  (marca todas las del usuario como leidas)
export const marcarTodasLeidas = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { count } = await prisma.notificacion.updateMany({
            where: { usuarioId: Number(req.user?.id), leida: false },
            data: { leida: true },
        });

        return res.json({ status: "success", message: `${count} notificación(es) marcada(s) como leída(s).` });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al marcar las notificaciones como leídas.", error });
    }
};

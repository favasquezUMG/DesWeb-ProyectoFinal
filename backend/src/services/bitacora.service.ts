import { prisma } from "../lib/prisma.js";

export type EntidadBitacora = "Usuario" | "Rol" | "Alumno";

// Deja constancia de un cambio sensible (quien, que y cuando). Nunca hace fallar la operacion.
export const registrarBitacora = async (
    usuarioId: number | null,
    accion: string,
    entidad: EntidadBitacora,
    entidadId: number,
    detalle: string,
) => {
    try {
        await prisma.bitacora.create({
            data: { usuarioId, accion: accion.slice(0, 50), entidad, entidadId, detalle: detalle.slice(0, 1000) },
        });
    } catch (error) {
        console.error("❌ No se pudo registrar en la bitácora:", error);
    }
};

export const obtenerBitacora = (entidad: EntidadBitacora, entidadId: number, limite = 50) =>
    prisma.bitacora.findMany({
        where: { entidad, entidadId },
        include: { usuario: { select: { nombres: true, apellidos: true } } },
        orderBy: { fecha: "desc" },
        take: limite,
    });

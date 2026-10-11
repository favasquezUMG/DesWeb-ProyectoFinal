import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// Alumnos (de la lista dada) con una justificación aprobada para ese día
export const aprobadasDelDia = async (alumnoIds: number[], fecha: Date): Promise<Set<number>> => {
    if (alumnoIds.length === 0) return new Set();
    const aprobadas = await prisma.justificacionAusencia.findMany({
        where: { alumnoId: { in: alumnoIds }, fecha, estado: "Aprobada" },
        select: { alumnoId: true },
    });
    return new Set(aprobadas.map((j) => j.alumnoId));
};

// Al aprobar una justificación, las faltas ya registradas de ese día quedan justificadas.
// Las que se registren después se convierten al pasar lista.
export const aplicarJustificacion = (alumnoId: number, fecha: Date, db: Prisma.TransactionClient = prisma) =>
    db.asistencia.updateMany({
        where: { alumnoId, fecha, estado: "Ausente" },
        data: { estado: "Justificado" },
    });

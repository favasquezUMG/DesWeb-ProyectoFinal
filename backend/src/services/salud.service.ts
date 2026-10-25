import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import { registrarBitacora } from "./bitacora.service.js";

// Información de salud del alumno: discapacidad o necesidad de apoyo, alergias y medicamentos.
// Es opcional y nunca influye en la aprobación de una inscripción; sirve para atenderlo
// bien en clase y en una emergencia.
export interface DatosSalud {
    necesidadesApoyo: string | null;
    alergias: string | null;
    medicamentos: string | null;
}

const MAX_LARGO = 500;

const seleccionSalud = { necesidadesApoyo: true, alergias: true, medicamentos: true } satisfies Prisma.AlumnoSelect;

const limpiar = (valor: unknown, campo: string): string | null => {
    if (valor === undefined || valor === null) return null;
    if (typeof valor !== "string") throw new ReglaNegocioError(`El campo ${campo} debe ser texto.`, 400);
    const texto = valor.trim();
    if (texto.length > MAX_LARGO) throw new ReglaNegocioError(`El campo ${campo} admite hasta ${MAX_LARGO} caracteres.`, 400);
    return texto || null;
};

export const leerSalud = (body: Record<string, unknown> | undefined): DatosSalud => ({
    necesidadesApoyo: limpiar(body?.necesidadesApoyo, "discapacidad o necesidad de apoyo"),
    alergias: limpiar(body?.alergias, "alergias"),
    medicamentos: limpiar(body?.medicamentos, "medicamentos"),
});

// El detalle no se copia a la bitácora: es un dato sensible y la bitácora la ve más gente
export const actualizarSalud = async (alumnoId: number, datos: DatosSalud, actorId: number, quien: string) => {
    const alumno = await prisma.alumno.update({ where: { alumnoId }, data: datos, select: seleccionSalud });
    await registrarBitacora(actorId, "Información de salud", "Alumno", alumnoId, `${quien} actualizó la información de salud del alumno.`);
    return alumno;
};

import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

// ¿El alumno puede entrar al portal? Los más pequeños no suelen tener dispositivo ni correo:
// su información la consulta el encargado. Por defecto Primaria (y Preprimaria) no entra y
// Básico / Diversificado sí; la sede puede hacer una excepción por alumno (Alumno.accesoPortal).

const NIVELES_SIN_ACCESO = ["Preprimaria", "Primaria"];

export const accesoPorNivel = (nivel: string) => !NIVELES_SIN_ACCESO.includes(nivel);

export const tieneAccesoPortal = (alumno: { accesoPortal: boolean | null; nivel: string }) =>
    alumno.accesoPortal ?? accesoPorNivel(alumno.nivel);

// Filtro de Prisma equivalente, para no notificar por correo a alumnos sin acceso
export const filtroAlumnoConAcceso: Prisma.AlumnoWhereInput = {
    OR: [
        { accesoPortal: true },
        { accesoPortal: null, seccion: { grado: { nivel: { notIn: NIVELES_SIN_ACCESO } } } },
    ],
};

// El contrario, escrito aparte: un NOT sobre el filtro anterior deja fuera a los accesoPortal = null
// (en SQL, NOT (null = true) no es verdadero)
export const filtroAlumnoSinAcceso: Prisma.AlumnoWhereInput = {
    OR: [
        { accesoPortal: false },
        { accesoPortal: null, seccion: { grado: { nivel: { in: NIVELES_SIN_ACCESO } } } },
    ],
};

// null si el usuario no es alumno
export const accesoPortalDe = async (usuarioId: number): Promise<boolean | null> => {
    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId: usuarioId },
        select: { accesoPortal: true, seccion: { select: { grado: { select: { nivel: true } } } } },
    });
    if (!alumno) return null;
    return tieneAccesoPortal({ accesoPortal: alumno.accesoPortal, nivel: alumno.seccion.grado.nivel });
};

export const MENSAJE_SIN_ACCESO =
    "Tu acceso al portal no está habilitado. Tu encargado puede consultar tus notas y avisos desde su cuenta; si necesitas acceso, pídelo en la administración de tu sede.";

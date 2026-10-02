import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hoyUTC } from "../lib/fechas.js";
import { ReglaNegocioError } from "../lib/errores.js";

// Reglas de los vinculos alumno-encargado (padres divorciados, abuelos, tutores temporales,
// restricciones judiciales...). Todo acceso de un encargado a datos del alumno pasa por aqui.

export const MAX_ENCARGADOS_ACTIVOS = 4;

export const PARENTESCOS = ["Madre", "Padre", "Abuelo(a)", "Tío(a)", "Hermano(a) mayor", "Padrastro / Madrastra", "Tutor legal", "Otro"];

export type PermisoVinculo = "general" | "notas" | "pagos" | "notificaciones";

const CAMPO_PERMISO: Record<Exclude<PermisoVinculo, "general">, keyof Prisma.AlumnoEncargadoWhereInput> = {
    notas: "puedeVerNotas",
    pagos: "puedeVerPagos",
    notificaciones: "recibeNotificaciones",
};

// Vinculo que hoy da acceso: activo, sin restriccion y dentro de su vigencia
export const filtroVinculo = (permiso: PermisoVinculo = "general"): Prisma.AlumnoEncargadoWhereInput => {
    const hoy = hoyUTC();
    return {
        activo: true,
        restringido: false,
        vigenteDesde: { lte: hoy },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: hoy } }],
        ...(permiso !== "general" ? { [CAMPO_PERMISO[permiso]]: true } : {}),
    };
};

// Filtro para Alumno: "los hijos de este encargado" segun el permiso pedido
export const hijosDe = (encargadoId: number, permiso: PermisoVinculo = "general"): Prisma.AlumnoWhereInput => ({
    encargados: { some: { encargadoId, ...filtroVinculo(permiso) } },
});

export const encargadoTieneAcceso = async (encargadoId: number, alumnoId: number, permiso: PermisoVinculo = "general") =>
    (await prisma.alumnoEncargado.count({ where: { alumnoId, encargadoId, ...filtroVinculo(permiso) } })) > 0;

// Puede decidir sobre temas administrativos del alumno (matricula, solicitar becas)
export const esResponsableDe = async (encargadoId: number, alumnoId: number) =>
    (await prisma.alumnoEncargado.count({
        where: {
            alumnoId,
            encargadoId,
            ...filtroVinculo(),
            AND: [{ OR: [{ esPrincipal: true }, { responsableFinanciero: true }] }],
        },
    })) > 0;

// ---------------------------------------------------------------------------
// Validacion del conjunto de vinculos de un alumno
// ---------------------------------------------------------------------------

export interface VinculoReglas {
    encargadoId: number;
    activo: boolean;
    restringido: boolean;
    esPrincipal: boolean;
    responsableFinanciero: boolean;
    vigenteDesde: Date;
    vigenteHasta: Date | null;
}

const estaVigente = (v: VinculoReglas, hoy: Date) =>
    v.activo && !v.restringido && v.vigenteDesde <= hoy && (v.vigenteHasta === null || v.vigenteHasta >= hoy);

// Se valida como quedarian TODOS los vinculos del alumno despues del cambio
export const validarVinculos = (vinculos: VinculoReglas[]) => {
    const hoy = hoyUTC();
    const activos = vinculos.filter((v) => v.activo);
    const vigentes = vinculos.filter((v) => estaVigente(v, hoy));

    if (activos.length > MAX_ENCARGADOS_ACTIVOS) {
        throw new ReglaNegocioError(`Un alumno puede tener como máximo ${MAX_ENCARGADOS_ACTIVOS} encargados activos.`);
    }
    if (vigentes.length === 0) {
        throw new ReglaNegocioError("El alumno debe conservar al menos un encargado activo y sin restricción.");
    }
    if (vinculos.some((v) => v.restringido && (v.esPrincipal || v.responsableFinanciero))) {
        throw new ReglaNegocioError("Un encargado con restricción no puede ser contacto principal ni responsable de pagos.");
    }

    const principales = vigentes.filter((v) => v.esPrincipal);
    if (principales.length === 0) {
        throw new ReglaNegocioError("El alumno debe tener un contacto principal vigente. Asigne otro antes de hacer este cambio.");
    }
    if (principales.length > 1 || vinculos.filter((v) => v.esPrincipal).length > 1) {
        throw new ReglaNegocioError("Solo puede haber un contacto principal por alumno.");
    }
    if (!vigentes.some((v) => v.responsableFinanciero)) {
        throw new ReglaNegocioError("El alumno debe tener al menos un responsable de pagos vigente.");
    }
};

import { randomInt } from "node:crypto";
import type { Prisma, Rol } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import {
    ROL,
    ROLES_DE_COMUNIDAD,
    esAlcanceGlobal,
    obtenerNombreRol,
    permisosDeRol,
    puedeOperarSede,
} from "../middlewares/role.middleware.js";
import { validarVinculos, type VinculoReglas } from "./vinculos.service.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const normalizarEmail = (email: unknown): string => {
    const valor = typeof email === "string" ? email.trim().toLowerCase() : "";
    if (!EMAIL_RE.test(valor)) throw new ReglaNegocioError("Ingrese un correo electrónico válido.", 400);
    return valor;
};

export const validarPassword = (password: unknown): string => {
    const valor = typeof password === "string" ? password : "";
    if (valor.length < 8) throw new ReglaNegocioError("La contraseña debe tener al menos 8 caracteres.", 400);
    return valor;
};

// Contraseña temporal legible (sin 0/O ni 1/l para dictarla sin confusiones)
export const generarPasswordTemporal = (): string => {
    const letras = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
    const digitos = "23456789";
    let clave = "";
    for (let i = 0; i < 6; i++) clave += letras[randomInt(letras.length)];
    for (let i = 0; i < 4; i++) clave += digitos[randomInt(digitos.length)];
    return clave;
};

export const correoEnUso = async (email: string, excluirUsuarioId?: number) =>
    (await prisma.usuario.count({
        where: { email: { equals: email, mode: "insensitive" }, ...(excluirUsuarioId ? { usuarioId: { not: excluirUsuarioId } } : {}) },
    })) > 0;

// ---------------------------------------------------------------------------
// Que roles puede asignar quien hace la peticion
// ---------------------------------------------------------------------------

const ROLES_SOLO_GENERAL: string[] = [ROL.ADMIN, ROL.ADMIN_GENERAL, ROL.ADMIN_SEDE];

// El administrador general asigna cualquier rol. El resto del personal solo puede asignar
// roles de comunidad (catedratico, alumno, encargado) o roles del colegio cuyos permisos ya
// tiene: nadie puede darle a otro mas acceso del que tiene el mismo.
export const verificarPuedeAsignarRol = async (req: AuthenticatedRequest, rol: Rol) => {
    const actor = await obtenerNombreRol(req);
    if (esAlcanceGlobal(actor)) return;

    if (ROLES_SOLO_GENERAL.includes(rol.nombre)) {
        throw new ReglaNegocioError(`Solo el Administrador General puede asignar el rol "${rol.nombre}".`, 403);
    }
    if (ROLES_DE_COMUNIDAD.includes(rol.nombre)) return;

    const propios = new Set(await permisosDeRol(Number(req.user?.rolId)));
    const ajenos = (await permisosDeRol(rol.rolId)).filter((p) => !propios.has(p));
    if (ajenos.length > 0) {
        throw new ReglaNegocioError(
            `No puede asignar el rol "${rol.nombre}" porque da acceso a módulos que usted no tiene (${ajenos.join(", ")}).`,
            403,
        );
    }
};

// Sede "natural" de un usuario: la suya, o la de sus hijos si es encargado (no tiene sede propia)
const sedesDelUsuario = async (usuarioId: number): Promise<number[]> => {
    const u = await prisma.usuario.findUnique({
        where: { usuarioId },
        select: {
            sedeId: true,
            encargado: {
                select: { alumnosEncargado: { select: { alumno: { select: { seccion: { select: { sedeId: true } } } } } } },
            },
        },
    });
    if (!u) return [];
    const sedes = new Set<number>();
    if (u.sedeId) sedes.add(u.sedeId);
    u.encargado?.alumnosEncargado.forEach((v) => sedes.add(v.alumno.seccion.sedeId));
    return [...sedes];
};

// El personal de sede solo administra cuentas de su sede, y nunca la de un administrador
export const verificarPuedeGestionar = async (req: AuthenticatedRequest, usuarioId: number) => {
    const objetivo = await prisma.usuario.findUnique({ where: { usuarioId }, include: { rol: true, rolesAdicionales: { include: { rol: true } } } });
    if (!objetivo) throw new ReglaNegocioError(`Usuario con ID: ${usuarioId} no encontrado.`, 404);

    const actor = await obtenerNombreRol(req);
    if (esAlcanceGlobal(actor)) return objetivo;

    const rolesObjetivo = [objetivo.rol, ...objetivo.rolesAdicionales.map((r) => r.rol)];
    if (rolesObjetivo.some((r) => ROLES_SOLO_GENERAL.includes(r.nombre))) {
        throw new ReglaNegocioError("Solo el Administrador General puede modificar la cuenta de un administrador.", 403);
    }

    const sedes = await sedesDelUsuario(usuarioId);
    const propias = await Promise.all(sedes.map((s) => puedeOperarSede(req, s)));
    if (sedes.length > 0 && !propias.some(Boolean)) {
        throw new ReglaNegocioError("No puede administrar usuarios de otra sede.", 403);
    }
    return objetivo;
};

// ---------------------------------------------------------------------------
// Registros de extension segun el rol (Catedratico, Encargado, Alumno)
// ---------------------------------------------------------------------------

export interface DatosDeRol {
    especialidad?: string | null;
    parentesco?: string | null;
    seccionId?: number | null;
    fechaNacimiento?: Date | null;
}

export const asegurarRegistrosDeRol = async (
    tx: Prisma.TransactionClient,
    usuarioId: number,
    nombresDeRol: string[],
    datos: DatosDeRol,
) => {
    if (nombresDeRol.includes(ROL.CATEDRATICO)) {
        await tx.catedratico.upsert({
            where: { catedraticoId: usuarioId },
            update: datos.especialidad !== undefined ? { especialidad: datos.especialidad } : {},
            create: { catedraticoId: usuarioId, especialidad: datos.especialidad ?? null },
        });
    }
    if (nombresDeRol.includes(ROL.ENCARGADO)) {
        await tx.encargado.upsert({
            where: { encargadoId: usuarioId },
            update: {},
            create: { encargadoId: usuarioId, parentesco: datos.parentesco ?? null },
        });
    }
    if (nombresDeRol.includes(ROL.ALUMNO)) {
        const existe = await tx.alumno.findUnique({ where: { alumnoId: usuarioId } });
        if (!existe) {
            if (!datos.seccionId) throw new ReglaNegocioError("Para crear un alumno indique su sección (seccionId).", 400);
            await tx.alumno.create({
                data: { alumnoId: usuarioId, seccionId: datos.seccionId, fechaNacimiento: datos.fechaNacimiento ?? null },
            });
        }
    }
};

// Combinaciones que no tienen sentido en un colegio
export const validarCombinacionDeRoles = (nombres: string[]) => {
    if (new Set(nombres).size !== nombres.length) {
        throw new ReglaNegocioError("Un rol está repetido.", 400);
    }
    if (nombres.includes(ROL.ALUMNO) && nombres.length > 1) {
        throw new ReglaNegocioError("Un alumno no puede tener otros roles en el sistema.", 400);
    }
};

// ---------------------------------------------------------------------------
// Dependencias: que impide quitarle un rol o dar de baja a un usuario
// ---------------------------------------------------------------------------

export const dependenciasDe = async (usuarioId: number) => {
    const [cursos, vinculos, alumno] = await Promise.all([
        prisma.cursoSeccion.count({ where: { catedraticoId: usuarioId } }),
        prisma.alumnoEncargado.findMany({
            where: { encargadoId: usuarioId, activo: true },
            include: { alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
        }),
        prisma.alumno.findUnique({ where: { alumnoId: usuarioId }, select: { alumnoId: true } }),
    ]);
    return {
        cursosAsignados: cursos,
        alumnosACargo: vinculos.map((v) => ({ alumnoId: v.alumnoId, nombre: `${v.alumno.usuario.nombres} ${v.alumno.usuario.apellidos}` })),
        esAlumno: alumno !== null,
    };
};

const vinculosComoReglas = (vinculos: (VinculoReglas & Record<string, unknown>)[]): VinculoReglas[] =>
    vinculos.map((v) => ({
        encargadoId: v.encargadoId,
        activo: v.activo,
        restringido: v.restringido,
        esPrincipal: v.esPrincipal,
        responsableFinanciero: v.responsableFinanciero,
        vigenteDesde: v.vigenteDesde,
        vigenteHasta: v.vigenteHasta,
    }));

// Un encargado no puede dejar de serlo si algun alumno se quedaria sin contacto principal,
// sin responsable de pagos o sin ningun encargado
export const verificarPuedeDejarDeSerEncargado = async (encargadoId: number) => {
    const vinculos = await prisma.alumnoEncargado.findMany({
        where: { encargadoId, activo: true },
        include: { alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
    });

    for (const v of vinculos) {
        const todos = await prisma.alumnoEncargado.findMany({ where: { alumnoId: v.alumnoId } });
        const sinEste = vinculosComoReglas(todos).map((x) => (x.encargadoId === encargadoId ? { ...x, activo: false, esPrincipal: false, responsableFinanciero: false } : x));
        try {
            validarVinculos(sinEste);
        } catch (error) {
            const alumno = `${v.alumno.usuario.nombres} ${v.alumno.usuario.apellidos}`;
            throw new ReglaNegocioError(
                `No se puede: ${alumno} se quedaría sin encargado válido (${(error as Error).message}) Asigne otro encargado primero.`,
            );
        }
    }
};

export const verificarNoEsUltimoAdminGeneral = async (usuarioId: number) => {
    const general = await prisma.rol.findUnique({ where: { nombre: ROL.ADMIN_GENERAL } });
    if (!general) return;
    const tieneRol = await prisma.usuario.count({
        where: { usuarioId, OR: [{ rolId: general.rolId }, { rolesAdicionales: { some: { rolId: general.rolId } } }] },
    });
    if (!tieneRol) return;

    const activos = await prisma.usuario.count({
        where: {
            deletedAt: null,
            usuarioId: { not: usuarioId },
            OR: [{ rolId: general.rolId }, { rolesAdicionales: { some: { rolId: general.rolId } } }],
        },
    });
    if (activos === 0) {
        throw new ReglaNegocioError("Es el único Administrador General activo: el colegio se quedaría sin quien administre el sistema.");
    }
};

// Valida quitarle a un usuario un rol que hoy tiene
export const verificarPuedeQuitarRol = async (usuarioId: number, nombreRol: string) => {
    const dep = await dependenciasDe(usuarioId);
    if (nombreRol === ROL.CATEDRATICO && dep.cursosAsignados > 0) {
        throw new ReglaNegocioError(`Tiene ${dep.cursosAsignados} curso(s) asignado(s) como catedrático. Reasígnelos antes de quitarle el rol.`);
    }
    if (nombreRol === ROL.ENCARGADO) await verificarPuedeDejarDeSerEncargado(usuarioId);
    if (nombreRol === ROL.ALUMNO && dep.esAlumno) {
        throw new ReglaNegocioError("No se puede quitar el rol de alumno: tiene historial académico. Dé de baja la cuenta si se retiró.");
    }
    if (nombreRol === ROL.ADMIN_GENERAL) await verificarNoEsUltimoAdminGeneral(usuarioId);
};

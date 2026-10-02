import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { prisma } from '../lib/prisma.js';

export const ROL = {
    ADMIN: 'Admin',
    ADMIN_GENERAL: 'Administrador General',
    ADMIN_SEDE: 'Administrador de Sede',
    CATEDRATICO: 'Catedratico',
    ALUMNO: 'Alumno',
    ENCARGADO: 'Encargado',
    COORDINADOR: 'Coordinador',
} as const;

export type NombreRol = (typeof ROL)[keyof typeof ROL];

// Modulos administrativos que se pueden asignar a un rol desde "Roles y permisos".
// La malla curricular y la gestion de roles quedan solo para el Administrador General.
export const MODULOS = {
    usuarios: 'Usuarios y accesos',
    alumnos: 'Alumnos y encargados',
    matriculas: 'Matrículas',
    horarios: 'Grados, cursos y horarios',
    notas: 'Notas',
    asistencia: 'Asistencia',
    conducta: 'Conducta',
    becas: 'Becas',
    pagos: 'Pagos',
    comunicados: 'Comunicados',
    calendario: 'Calendario',
    reportes: 'Reportería',
} as const;

export type Modulo = keyof typeof MODULOS;
export const LISTA_MODULOS = Object.keys(MODULOS) as Modulo[];

// Roles cuyo acceso no depende de permisos sino de su relacion con los datos
// (el catedratico ve sus cursos, el encargado a sus hijos, el alumno lo suyo)
export const ROLES_DE_COMUNIDAD: string[] = [ROL.CATEDRATICO, ROL.ALUMNO, ROL.ENCARGADO];

interface RolCache {
    nombre: string;
    esSistema: boolean;
    permisos: Set<string>;
}

let cacheRoles: Map<number, RolCache> | null = null;

const cargarRoles = async (): Promise<Map<number, RolCache>> => {
    if (cacheRoles) return cacheRoles;

    const roles = await prisma.rol.findMany({ include: { permisos: true } });
    cacheRoles = new Map(
        roles.map((r) => [r.rolId, { nombre: r.nombre, esSistema: r.esSistema, permisos: new Set(r.permisos.map((p) => p.modulo)) }]),
    );
    return cacheRoles;
};

export const invalidarCacheRoles = () => {
    cacheRoles = null;
};

const rolDelUsuario = async (req: AuthenticatedRequest): Promise<RolCache | undefined> => {
    if (!req.user) return undefined;
    const roles = await cargarRoles();
    return roles.get(Number(req.user.rolId));
};

export const obtenerNombreRol = async (req: AuthenticatedRequest): Promise<string | undefined> =>
    (await rolDelUsuario(req))?.nombre;

// Administrador General: ve y opera todas las sedes y tiene todos los permisos
export const esAlcanceGlobal = (nombreRol: string | undefined): boolean =>
    nombreRol === ROL.ADMIN_GENERAL || nombreRol === ROL.ADMIN;

// Personal administrativo: los administradores y los roles creados por el colegio
export const esPersonalAdministrativo = (nombreRol: string | undefined): boolean =>
    !!nombreRol && !ROLES_DE_COMUNIDAD.includes(nombreRol);

export const esAdministrador = (nombreRol: string | undefined): boolean =>
    nombreRol === ROL.ADMIN || nombreRol === ROL.ADMIN_GENERAL || nombreRol === ROL.ADMIN_SEDE;

export const permisosDeRol = async (rolId: number): Promise<string[]> => {
    const rol = (await cargarRoles()).get(rolId);
    if (!rol) return [];
    if (esAlcanceGlobal(rol.nombre)) return [...LISTA_MODULOS];
    return [...rol.permisos];
};

export const tienePermiso = async (req: AuthenticatedRequest, modulo: Modulo): Promise<boolean> => {
    const rol = await rolDelUsuario(req);
    if (!rol) return false;
    return esAlcanceGlobal(rol.nombre) || rol.permisos.has(modulo);
};

const responder403 = (res: Response) =>
    res.status(403).json({ status: 'error', message: 'No tiene permisos para realizar esta acción.' });

export const verificarRol = (...rolesPermitidos: NombreRol[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ status: 'error', message: 'No autenticado.' });
        }

        try {
            const rol = await rolDelUsuario(req);
            if (!rol || !rolesPermitidos.includes(rol.nombre as NombreRol)) return responder403(res);
            return next();
        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'Error al verificar los permisos.', error });
        }
    };
};

// Deja pasar al Administrador General, a los roles que tienen el permiso del modulo
// y a los roles de comunidad indicados (que luego se filtran por sus propios datos).
export const permitir = (modulo: Modulo, ...rolesConAcceso: NombreRol[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ status: 'error', message: 'No autenticado.' });
        }

        try {
            const rol = await rolDelUsuario(req);
            if (!rol) return responder403(res);
            if (esAlcanceGlobal(rol.nombre) || rol.permisos.has(modulo) || rolesConAcceso.includes(rol.nombre as NombreRol)) {
                return next();
            }
            return responder403(res);
        } catch (error) {
            return res.status(500).json({ status: 'error', message: 'Error al verificar los permisos.', error });
        }
    };
};

export const puedeOperarSede = async (req: AuthenticatedRequest, sedeId: number): Promise<boolean> => {
    if (!req.user) return false;
    if (esAlcanceGlobal(await obtenerNombreRol(req))) return true;
    return Number(req.user.sedeId) === Number(sedeId);
};

// Sede a la que se limita lo que ve el usuario: null = todas (Administrador General)
export const sedeDelAlcance = async (req: AuthenticatedRequest): Promise<number | null> => {
    if (esAlcanceGlobal(await obtenerNombreRol(req))) return null;
    return req.user?.sedeId ? Number(req.user.sedeId) : -1; // -1: sin sede asignada, no ve nada
};

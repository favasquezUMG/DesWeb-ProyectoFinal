import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from './auth.middleware.js';
import { prisma } from '../lib/prisma.js';

/**
 * Nombres de rol tal como están sembrados en prisma/seed.ts.
 * Se comparan por nombre y no por rolId porque los IDs cambian entre
 * ambientes (local, pruebas, produccion) y romperían las rutas.
 */
export const ROL = {
    ADMIN_GENERAL: 'Administrador General',
    ADMIN_SEDE: 'Administrador de Sede',
    CATEDRATICO: 'Catedratico',
    ALUMNO: 'Alumno',
    ENCARGADO: 'Encargado',
} as const;

export type NombreRol = (typeof ROL)[keyof typeof ROL];

// Cache en memoria: rolId -> nombre. Los roles casi no cambian, así que no
// tiene sentido consultarlos en cada request.
let cacheRoles: Map<number, string> | null = null;

const cargarRoles = async (): Promise<Map<number, string>> => {
    if (cacheRoles) return cacheRoles;

    const roles = await prisma.rol.findMany();
    cacheRoles = new Map(roles.map((r) => [r.rolId, r.nombre]));
    return cacheRoles;
};

/** Llamar después de crear, editar o borrar un rol para invalidar el cache. */
export const invalidarCacheRoles = () => {
    cacheRoles = null;
};

/**
 * Deja pasar solo si el rol del usuario autenticado está en la lista.
 * Uso: router.post('/', authenticateToken, verificarRol(ROL.ADMIN_GENERAL), createCurso);
 */
export const verificarRol = (...rolesPermitidos: NombreRol[]) => {
    return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({
                status: 'error',
                message: 'No autenticado.',
            });
        }

        try {
            const roles = await cargarRoles();
            const nombreRol = roles.get(Number(req.user.rolId));

            if (!nombreRol || !rolesPermitidos.includes(nombreRol as NombreRol)) {
                return res.status(403).json({
                    status: 'error',
                    message: 'No tiene permisos para realizar esta acción.',
                });
            }

            return next();
        } catch (error) {
            return res.status(500).json({
                status: 'error',
                message: 'Error al verificar los permisos.',
                error,
            });
        }
    };
};

/**
 * Regla de negocio del DERCAS: el Administrador de Sede solo opera sobre su
 * propia sede; el Administrador General sobre todas.
 * Devuelve true si el usuario puede tocar recursos de esa sede.
 */
export const puedeOperarSede = async (
    req: AuthenticatedRequest,
    sedeId: number,
): Promise<boolean> => {
    if (!req.user) return false;

    const roles = await cargarRoles();
    const nombreRol = roles.get(Number(req.user.rolId));

    if (nombreRol === ROL.ADMIN_GENERAL) return true;

    return Number(req.user.sedeId) === Number(sedeId);
};
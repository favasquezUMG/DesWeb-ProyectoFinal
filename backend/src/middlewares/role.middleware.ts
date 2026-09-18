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

let cacheRoles: Map<number, string> | null = null;

const cargarRoles = async (): Promise<Map<number, string>> => {
    if (cacheRoles) return cacheRoles;

    const roles = await prisma.rol.findMany();
    cacheRoles = new Map(roles.map((r) => [r.rolId, r.nombre]));
    return cacheRoles;
};

export const invalidarCacheRoles = () => {
    cacheRoles = null;
};

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

export const puedeOperarSede = async (
    req: AuthenticatedRequest,
    sedeId: number,
): Promise<boolean> => {
    if (!req.user) return false;

    const roles = await cargarRoles();
    const nombreRol = roles.get(Number(req.user.rolId));

if (nombreRol === ROL.ADMIN_GENERAL || nombreRol === ROL.ADMIN) return true;

    return Number(req.user.sedeId) === Number(sedeId);
};
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { permisosDeRol } from '../middlewares/role.middleware.js';

const incluirRoles = {
    rol: true,
    sede: { select: { nombre: true } },
    rolesAdicionales: { include: { rol: true } },
} as const;

type UsuarioConRoles = NonNullable<Awaited<ReturnType<typeof buscarUsuario>>>;

const buscarUsuario = (where: { email: string } | { usuarioId: number }) =>
    prisma.usuario.findFirst({
        where: { ...where, deletedAt: null }, // los usuarios dados de baja no pueden entrar
        include: incluirRoles,
    });

// Todos los roles del usuario: el principal primero y luego los adicionales
const rolesDe = (user: UsuarioConRoles) => [
    { rolId: user.rol.rolId, nombre: user.rol.nombre },
    ...user.rolesAdicionales
        .filter((r) => r.rolId !== user.rolId)
        .map((r) => ({ rolId: r.rol.rolId, nombre: r.rol.nombre })),
];

// Firma el token con el rol activo y arma la respuesta de sesion
const sesionPara = async (user: UsuarioConRoles, rolActivoId: number) => {
    const roles = rolesDe(user);
    const rolActivo = roles.find((r) => r.rolId === rolActivoId) ?? roles[0];

    const payload = {
        usuarioId: user.usuarioId,
        email: user.email,
        rolId: rolActivo.rolId,
        sedeId: user.sedeId,
    };

    const secret = process.env.JWT_SECRET || 'secret';
    const expiresIn = (process.env.JWT_EXPIRES_IN || '5m') as jwt.SignOptions['expiresIn'];
    const token = jwt.sign(payload, secret, { expiresIn });

    return {
        status: 'success',
        token,
        usuario: {
            usuarioId: user.usuarioId,
            nombre: user.nombres,
            apellidos: user.apellidos,
            email: user.email,
            rol: rolActivo.nombre,
            rolId: rolActivo.rolId,
            sedeId: user.sedeId,
            sede: user.sede?.nombre ?? null,
            roles,
            permisos: await permisosDeRol(rolActivo.rolId),
        },
    };
};

// POST /api/auth/login  { email, password, rolId? }
// rolId opcional: con que rol entrar si la persona tiene varios
export const login = async (req: Request, res: Response) => {
    const { email, password, rolId } = req.body;

    if(!email || !password){
        return res.status(400).json({ status: 'error', message: 'Email and password are required'})
    }

    try{
        const user = await buscarUsuario({ email });

        if(!user){
            return res.status(404).json({ status: 'error', message: 'Invalid credentials'})
        }

        //Se verifica la contraseña
        const validPassword = await bcrypt.compare(password, user.passwordHash)
        if(!validPassword){
            return res.status(400).json({ status: 'error', message: 'Invalid credentials'})
        }

        const pedido = Number(rolId);
        const rolInicial = rolesDe(user).some((r) => r.rolId === pedido) ? pedido : user.rolId;

        return res.json(await sesionPara(user, rolInicial));
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Internal error', error});
    }
}

// POST /api/auth/cambiar-rol  { rolId }  — entrega un token nuevo con otro de los roles del usuario
export const cambiarRol = async (req: AuthenticatedRequest, res: Response) => {
    const rolId = Number(req.body?.rolId);

    try {
        const user = await buscarUsuario({ usuarioId: Number(req.user?.id) });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Su usuario ya no está activo.' });
        }
        if (!rolesDe(user).some((r) => r.rolId === rolId)) {
            return res.status(403).json({ status: 'error', message: 'No tiene asignado ese rol.' });
        }

        return res.json(await sesionPara(user, rolId));
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al cambiar de rol.', error });
    }
};

// GET /api/auth/me  — perfil del usuario con el rol activo del token
export const me = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const user = await buscarUsuario({ usuarioId: Number(req.user?.id) });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Su usuario ya no está activo.' });
        }
        const { usuario } = await sesionPara(user, Number(req.user?.rolId));
        return res.json({ status: 'success', user: req.user, usuario });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener el perfil.', error });
    }
};

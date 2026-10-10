import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { permisosDeRol } from '../middlewares/role.middleware.js';
import { sendMail } from '../services/mail.service.js';
import { validarPassword } from '../services/usuarios.service.js';
import { ReglaNegocioError } from '../lib/errores.js';
import { plantillaRecuperarPassword } from '../templates/mail.templates.js';

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

// El token de recuperacion se firma con el hash actual de la contraseña: en cuanto se cambia,
// el enlace deja de servir (un solo uso) sin necesidad de guardarlo en la base de datos
const MINUTOS_VIGENCIA_RESET = 60;
const secretoReset = (passwordHash: string) => `${process.env.JWT_SECRET || 'secret'}${passwordHash}`;

// POST /api/auth/olvide-password  { email }
// Siempre responde lo mismo para no revelar que correos estan registrados
export const olvidePassword = async (req: Request, res: Response) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    if (!email) {
        return res.status(400).json({ status: 'error', message: 'El correo electrónico es obligatorio.' });
    }

    try {
        const user = await prisma.usuario.findFirst({
            where: { email: { equals: email, mode: 'insensitive' }, deletedAt: null },
        });

        if (user) {
            const token = jwt.sign(
                { usuarioId: user.usuarioId, tipo: 'reset' },
                secretoReset(user.passwordHash),
                { expiresIn: MINUTOS_VIGENCIA_RESET * 60 },
            );
            const baseUrl = (process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
            const { subject, html } = plantillaRecuperarPassword({
                nombreDestinatario: user.nombres,
                enlace: `${baseUrl}/?reset=${encodeURIComponent(token)}`,
                minutosVigencia: MINUTOS_VIGENCIA_RESET,
            });
            const enviado = await sendMail({ to: user.email, subject, html });
            if (!enviado) {
                return res.status(502).json({ status: 'error', message: 'No se pudo enviar el correo. Intente de nuevo más tarde.' });
            }
        }

        return res.json({
            status: 'success',
            message: 'Si el correo está registrado, recibirá un enlace para restablecer su contraseña.',
        });
    } catch (error) {
        return res.status(500).json({ status: 'error', message: 'Error al procesar la solicitud.', error });
    }
};

// POST /api/auth/restablecer-password  { token, password }
export const restablecerPassword = async (req: Request, res: Response) => {
    const { token, password } = req.body ?? {};
    const invalido = () =>
        res.status(400).json({ status: 'error', message: 'El enlace no es válido o ya venció. Solicite uno nuevo.' });

    if (typeof token !== 'string' || !token) return invalido();

    try {
        const datos = jwt.decode(token) as { usuarioId?: number; tipo?: string } | null;
        if (!datos?.usuarioId || datos.tipo !== 'reset') return invalido();

        const user = await prisma.usuario.findFirst({ where: { usuarioId: datos.usuarioId, deletedAt: null } });
        if (!user) return invalido();

        try {
            jwt.verify(token, secretoReset(user.passwordHash));
        } catch {
            return invalido();
        }

        const passwordHash = await bcrypt.hash(validarPassword(password), 10);
        await prisma.usuario.update({ where: { usuarioId: user.usuarioId }, data: { passwordHash } });

        return res.json({ status: 'success', message: 'Contraseña actualizada. Ya puede iniciar sesión.' });
    } catch (error) {
        if (error instanceof ReglaNegocioError) {
            return res.status(error.status).json({ status: 'error', message: error.message });
        }
        return res.status(500).json({ status: 'error', message: 'Error al restablecer la contraseña.', error });
    }
};

// POST /api/auth/cambiar-password  { actual, nueva }
// El usuario con sesion iniciada cambia su propia contraseña (debe confirmar la actual)
export const cambiarPassword = async (req: AuthenticatedRequest, res: Response) => {
    const { actual, nueva } = req.body ?? {};

    if (typeof actual !== 'string' || !actual) {
        return res.status(400).json({ status: 'error', message: 'Ingrese su contraseña actual.' });
    }

    try {
        const user = await prisma.usuario.findFirst({ where: { usuarioId: Number(req.user?.id), deletedAt: null } });
        if (!user) {
            return res.status(401).json({ status: 'error', message: 'Su usuario ya no está activo.' });
        }

        if (!(await bcrypt.compare(actual, user.passwordHash))) {
            return res.status(400).json({ status: 'error', message: 'La contraseña actual no es correcta.' });
        }

        const valida = validarPassword(nueva);
        if (valida === actual) {
            return res.status(400).json({ status: 'error', message: 'La nueva contraseña debe ser distinta de la actual.' });
        }

        const passwordHash = await bcrypt.hash(valida, 10);
        await prisma.usuario.update({ where: { usuarioId: user.usuarioId }, data: { passwordHash } });

        return res.json({ status: 'success', message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        if (error instanceof ReglaNegocioError) {
            return res.status(error.status).json({ status: 'error', message: error.message });
        }
        return res.status(500).json({ status: 'error', message: 'Error al cambiar la contraseña.', error });
    }
};

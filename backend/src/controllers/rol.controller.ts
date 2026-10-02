import type { Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import {
    LISTA_MODULOS,
    MODULOS,
    ROLES_DE_COMUNIDAD,
    esAlcanceGlobal,
    invalidarCacheRoles,
    type Modulo,
} from '../middlewares/role.middleware.js';
import { registrarBitacora } from '../services/bitacora.service.js';

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) {
        return res.status(error.status).json({ status: 'error', message: error.message });
    }
    return res.status(500).json({ status: 'error', message: mensaje, error: error instanceof Error ? error.message : error });
};

const leerId = (valor: unknown): number => {
    if (typeof valor !== 'string' || !/^\d+$/.test(valor)) throw new ReglaNegocioError(`El ID: ${valor} no es un número válido`, 400);
    return Number(valor);
};

// Como se comporta cada rol en la matriz de permisos
type TipoRol = 'global' | 'comunidad' | 'personal';
const tipoDe = (nombre: string): TipoRol =>
    esAlcanceGlobal(nombre) ? 'global' : ROLES_DE_COMUNIDAD.includes(nombre) ? 'comunidad' : 'personal';

const incluirResumen = {
    permisos: { select: { modulo: true } },
    _count: { select: { usuarios: { where: { deletedAt: null } }, usuariosAdicionales: true } },
} as const;

const aDto = (r: { rolId: number; nombre: string; descripcion: string | null; esSistema: boolean; permisos: { modulo: string }[]; _count: { usuarios: number; usuariosAdicionales: number } }) => {
    const tipo = tipoDe(r.nombre);
    return {
        rolId: r.rolId,
        nombre: r.nombre,
        descripcion: r.descripcion,
        esSistema: r.esSistema,
        tipo,
        // El administrador general siempre tiene todo; los roles de comunidad no usan la matriz
        permisos: tipo === 'global' ? [...LISTA_MODULOS] : tipo === 'comunidad' ? [] : r.permisos.map((p) => p.modulo),
        permisosEditables: tipo === 'personal',
        usuarios: r._count.usuarios + r._count.usuariosAdicionales,
    };
};

const validarPermisos = (valor: unknown): Modulo[] => {
    if (!Array.isArray(valor)) throw new ReglaNegocioError('permisos debe ser una lista de módulos.', 400);
    const invalidos = valor.filter((m) => !LISTA_MODULOS.includes(m));
    if (invalidos.length > 0) {
        throw new ReglaNegocioError(`Módulos no válidos: ${invalidos.join(', ')}. Use: ${LISTA_MODULOS.join(', ')}.`, 400);
    }
    return [...new Set(valor as Modulo[])];
};

// "Orientación", "orientacion" y "ORIENTACIÓN" se consideran el mismo nombre. Se compara en
// el codigo porque la comparacion sin mayusculas de la base depende de su configuracion regional.
const normalizar = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const validarNombre = async (nombre: unknown, excluirRolId?: number): Promise<string> => {
    const texto = typeof nombre === 'string' ? nombre.trim().replace(/\s+/g, ' ') : '';
    if (texto.length < 3 || texto.length > 50) throw new ReglaNegocioError('El nombre del rol debe tener entre 3 y 50 caracteres.', 400);
    const roles = await prisma.rol.findMany({ select: { rolId: true, nombre: true } });
    const repetido = roles.find((r) => r.rolId !== excluirRolId && normalizar(r.nombre) === normalizar(texto));
    if (repetido) throw new ReglaNegocioError(`Ya existe el rol "${repetido.nombre}".`);
    return texto;
};

// GET /api/roles/all
export const getRoles = async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const roles = await prisma.rol.findMany({ include: incluirResumen, orderBy: [{ esSistema: 'desc' }, { rolId: 'asc' }] });
        return res.json({ status: 'success', data: roles.map(aDto) });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los roles.');
    }
};

// GET /api/roles/modulos
export const getModulos = async (_req: AuthenticatedRequest, res: Response) =>
    res.json({ status: 'success', data: LISTA_MODULOS.map((m) => ({ modulo: m, nombre: MODULOS[m] })) });

// GET /api/roles/:id
export const getRolById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rol = await prisma.rol.findUnique({ where: { rolId: leerId(req.params.id) }, include: incluirResumen });
        if (!rol) return res.status(404).json({ status: 'error', message: `Rol con ID: ${req.params.id} no encontrado` });
        return res.json({ status: 'success', data: aDto(rol) });
    } catch (error) {
        return responderError(res, error, `Error al obtener el rol con ID: ${req.params.id}.`);
    }
};

// POST /api/roles  { nombre, descripcion?, permisos: string[] }  — rol del personal (ej. "Secretaría")
export const createRol = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const nombre = await validarNombre(req.body.nombre);
        const permisos = validarPermisos(req.body.permisos ?? []);

        const rol = await prisma.rol.create({
            data: {
                nombre,
                descripcion: req.body.descripcion ? String(req.body.descripcion).slice(0, 255) : null,
                permisos: { create: permisos.map((modulo) => ({ modulo })) },
            },
            include: incluirResumen,
        });
        invalidarCacheRoles();
        await registrarBitacora(Number(req.user?.id), 'Creación', 'Rol', rol.rolId, `Rol "${nombre}" con acceso a: ${permisos.join(', ') || 'ningún módulo'}.`);

        return res.status(201).json({ status: 'success', data: aDto(rol) });
    } catch (error) {
        return responderError(res, error, 'Error al crear el rol.');
    }
};

// PUT /api/roles/:id  { nombre?, descripcion? } — los roles de sistema no se renombran
export const updateRol = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rolId = leerId(req.params.id);
        const rol = await prisma.rol.findUnique({ where: { rolId } });
        if (!rol) return res.status(404).json({ status: 'error', message: `Rol con ID: ${rolId} no encontrado` });

        const data: { nombre?: string; descripcion?: string | null } = {};
        if (req.body.nombre !== undefined && req.body.nombre !== rol.nombre) {
            if (rol.esSistema) {
                throw new ReglaNegocioError(`"${rol.nombre}" es un rol de sistema: no se puede renombrar porque el sistema depende de él.`);
            }
            data.nombre = await validarNombre(req.body.nombre, rolId);
        }
        if (req.body.descripcion !== undefined) data.descripcion = req.body.descripcion ? String(req.body.descripcion).slice(0, 255) : null;

        const actualizado = await prisma.rol.update({ where: { rolId }, data, include: incluirResumen });
        invalidarCacheRoles();
        if (data.nombre) await registrarBitacora(Number(req.user?.id), 'Modificación', 'Rol', rolId, `Renombrado de "${rol.nombre}" a "${data.nombre}".`);

        return res.json({ status: 'success', data: aDto(actualizado) });
    } catch (error) {
        return responderError(res, error, `Error al actualizar el rol con ID ${req.params.id}.`);
    }
};

// PUT /api/roles/:id/permisos  { permisos: string[] }
export const setPermisos = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rolId = leerId(req.params.id);
        const rol = await prisma.rol.findUnique({ where: { rolId }, include: { permisos: true } });
        if (!rol) return res.status(404).json({ status: 'error', message: `Rol con ID: ${rolId} no encontrado` });

        const tipo = tipoDe(rol.nombre);
        if (tipo === 'global') throw new ReglaNegocioError('El Administrador General siempre tiene acceso a todo.', 400);
        if (tipo === 'comunidad') {
            throw new ReglaNegocioError(`El acceso de "${rol.nombre}" depende de sus cursos o de sus alumnos a cargo, no de la matriz de permisos.`, 400);
        }

        const permisos = validarPermisos(req.body.permisos);
        const antes = rol.permisos.map((p) => p.modulo);
        const agregados = permisos.filter((m) => !antes.includes(m));
        const quitados = antes.filter((m) => !permisos.includes(m as Modulo));

        await prisma.$transaction([
            prisma.permiso.deleteMany({ where: { rolId } }),
            prisma.permiso.createMany({ data: permisos.map((modulo) => ({ rolId, modulo })) }),
        ]);
        invalidarCacheRoles();

        if (agregados.length || quitados.length) {
            await registrarBitacora(Number(req.user?.id), 'Permisos', 'Rol', rolId,
                [agregados.length ? `+ ${agregados.join(', ')}` : '', quitados.length ? `− ${quitados.join(', ')}` : ''].filter(Boolean).join(' · '));
        }

        const actualizado = await prisma.rol.findUnique({ where: { rolId }, include: incluirResumen });
        return res.json({ status: 'success', data: aDto(actualizado!) });
    } catch (error) {
        return responderError(res, error, 'Error al guardar los permisos.');
    }
};

// DELETE /api/roles/:id
export const deleteRolById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const rolId = leerId(req.params.id);
        const rol = await prisma.rol.findUnique({ where: { rolId }, include: incluirResumen });
        if (!rol) return res.status(404).json({ status: 'error', message: `Rol con ID: ${rolId} no encontrado` });
        if (rol.esSistema) throw new ReglaNegocioError(`"${rol.nombre}" es un rol de sistema y no se puede eliminar.`);

        const enUso = await prisma.usuario.count({ where: { OR: [{ rolId }, { rolesAdicionales: { some: { rolId } } }] } });
        if (enUso > 0) {
            throw new ReglaNegocioError(`No se puede eliminar: ${enUso} usuario(s) tienen este rol (incluidas cuentas dadas de baja). Cámbieles el rol primero.`);
        }

        await prisma.rol.delete({ where: { rolId } });
        invalidarCacheRoles();
        await registrarBitacora(Number(req.user?.id), 'Eliminación', 'Rol', rolId, `Rol "${rol.nombre}" eliminado.`);

        return res.json({ status: 'success', message: `Se eliminó el rol "${rol.nombre}".` });
    } catch (error) {
        return responderError(res, error, `Error al eliminar el rol con ID: ${req.params.id}.`);
    }
};

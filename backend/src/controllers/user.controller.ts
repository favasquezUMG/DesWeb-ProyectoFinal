import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { ROL, ROLES_DE_COMUNIDAD, esAlcanceGlobal, sedeDelAlcance } from '../middlewares/role.middleware.js';
import { registrarBitacora, obtenerBitacora } from '../services/bitacora.service.js';
import {
    asegurarRegistrosDeRol,
    correoEnUso,
    dependenciasDe,
    generarPasswordTemporal,
    normalizarEmail,
    validarCombinacionDeRoles,
    validarPassword,
    verificarNoEsUltimoAdminGeneral,
    verificarPuedeAsignarRol,
    verificarPuedeDejarDeSerEncargado,
    verificarPuedeGestionar,
    verificarPuedeQuitarRol,
} from '../services/usuarios.service.js';

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

const actorId = (req: AuthenticatedRequest) => Number(req.user?.id);

const incluirDetalle = {
    rol: { select: { rolId: true, nombre: true } },
    sede: { select: { sedeId: true, nombre: true } },
    rolesAdicionales: { include: { rol: { select: { rolId: true, nombre: true } } } },
    catedratico: { select: { especialidad: true } },
    encargado: { select: { _count: { select: { alumnosEncargado: { where: { activo: true } } } } } },
    alumno: { select: { seccion: { select: { nombre: true, grado: { select: { nombre: true } } } } } },
} as const;

// Nunca se devuelve el hash de la contraseña
const sinPassword = <T extends { passwordHash?: string }>(u: T) => {
    const { passwordHash: _omitido, ...resto } = u;
    return resto;
};

const nombresDeRoles = async (ids: number[]) => {
    const roles = await prisma.rol.findMany({ where: { rolId: { in: ids } } });
    if (roles.length !== new Set(ids).size) throw new ReglaNegocioError('Uno de los roles indicados no existe.', 400);
    return roles;
};

// Personal administrativo (no comunidad, no global) necesita una sede
const requiereSede = (nombreRol: string) =>
    (!ROLES_DE_COMUNIDAD.includes(nombreRol) && !esAlcanceGlobal(nombreRol)) || nombreRol === ROL.CATEDRATICO;

// GET /api/usuarios  ?q ?rolId ?estado=activos|inactivos|todos ?sedeId
export const getUsers = async (req: AuthenticatedRequest, res: Response) => {
    const { q, rolId, estado = 'activos', sedeId } = req.query;

    try {
        const alcance = await sedeDelAlcance(req);
        const filtros: Prisma.UsuarioWhereInput[] = [];

        if (estado === 'activos') filtros.push({ deletedAt: null });
        if (estado === 'inactivos') filtros.push({ deletedAt: { not: null } });
        if (rolId) filtros.push({ OR: [{ rolId: Number(rolId) }, { rolesAdicionales: { some: { rolId: Number(rolId) } } }] });
        if (typeof q === 'string' && q.trim()) {
            const texto = q.trim();
            filtros.push({
                OR: [
                    { nombres: { contains: texto, mode: 'insensitive' } },
                    { apellidos: { contains: texto, mode: 'insensitive' } },
                    { email: { contains: texto, mode: 'insensitive' } },
                ],
            });
        }

        // El personal de sede ve los usuarios de su sede y a los encargados de sus alumnos
        const sede = alcance ?? (sedeId ? Number(sedeId) : null);
        if (sede !== null) {
            filtros.push({
                OR: [
                    { sedeId: sede },
                    { encargado: { alumnosEncargado: { some: { alumno: { seccion: { sedeId: sede } } } } } },
                ],
            });
        }
        // Las cuentas de administradores solo las ve el administrador general
        if (alcance !== null) {
            filtros.push({ rol: { nombre: { notIn: [ROL.ADMIN, ROL.ADMIN_GENERAL] } } });
        }

        const users = await prisma.usuario.findMany({
            where: { AND: filtros },
            include: incluirDetalle,
            orderBy: [{ apellidos: 'asc' }, { nombres: 'asc' }],
            take: 300,
        });

        return res.json({ status: 'success', data: users.map(sinPassword) });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los usuarios.');
    }
};

// GET /api/usuarios/:id  (incluye dependencias y bitacora)
export const getUserById = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = leerId(req.params.id);
        await verificarPuedeGestionar(req, id);

        const user = await prisma.usuario.findUnique({ where: { usuarioId: id }, include: incluirDetalle });
        const [dependencias, bitacora] = await Promise.all([dependenciasDe(id), obtenerBitacora('Usuario', id, 30)]);

        return res.json({ status: 'success', data: { ...sinPassword(user!), dependencias, bitacora } });
    } catch (error) {
        return responderError(res, error, `Error al obtener el usuario con ID: ${req.params.id}.`);
    }
};

// POST /api/usuarios
// { nombres, apellidos, email, password?, rolId, sedeId?, rolesAdicionales?, especialidad?, seccionId?, fechaNacimiento?, parentesco? }
// Sin password se genera una temporal y se devuelve una sola vez.
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
    const { nombres, apellidos, password, rolId, rolesAdicionales = [], especialidad, seccionId, fechaNacimiento, parentesco } = req.body;

    if (!nombres?.trim() || !apellidos?.trim() || !rolId) {
        return res.status(400).json({ status: 'error', message: 'nombres, apellidos, email y rolId son obligatorios.' });
    }

    try {
        const email = normalizarEmail(req.body.email);
        if (await correoEnUso(email)) {
            return res.status(409).json({ status: 'error', message: `El correo ${email} ya está registrado.` });
        }

        const idsRoles = [Number(rolId), ...(Array.isArray(rolesAdicionales) ? rolesAdicionales.map(Number) : [])];
        const roles = await nombresDeRoles(idsRoles);
        const principal = roles.find((r) => r.rolId === Number(rolId))!;
        validarCombinacionDeRoles(roles.map((r) => r.nombre));
        for (const rol of roles) await verificarPuedeAsignarRol(req, rol);

        // Sede: el personal de sede crea usuarios en la suya; el alumno toma la de su seccion
        const alcance = await sedeDelAlcance(req);
        let sede: number | null = alcance ?? (req.body.sedeId ? Number(req.body.sedeId) : null);
        if (principal.nombre === ROL.ALUMNO) {
            const seccion = await prisma.seccion.findUnique({ where: { seccionId: Number(seccionId) } });
            if (!seccion) throw new ReglaNegocioError('Indique una sección válida para el alumno.', 400);
            if (alcance !== null && seccion.sedeId !== alcance) throw new ReglaNegocioError('La sección pertenece a otra sede.', 403);
            sede = seccion.sedeId;
        }
        if (principal.nombre === ROL.ENCARGADO && roles.length === 1) sede = null;
        if (requiereSede(principal.nombre) && !sede) {
            throw new ReglaNegocioError(`El rol "${principal.nombre}" necesita una sede.`, 400);
        }

        const passwordTemporal = password ? null : generarPasswordTemporal();
        const passwordHash = await bcrypt.hash(password ? validarPassword(password) : passwordTemporal!, 10);

        const nuevo = await prisma.$transaction(async (tx) => {
            const u = await tx.usuario.create({
                data: {
                    nombres: nombres.trim(),
                    apellidos: apellidos.trim(),
                    email,
                    passwordHash,
                    rolId: principal.rolId,
                    sedeId: sede,
                    rolesAdicionales: { create: roles.filter((r) => r.rolId !== principal.rolId).map((r) => ({ rolId: r.rolId })) },
                },
            });
            await asegurarRegistrosDeRol(tx, u.usuarioId, roles.map((r) => r.nombre), {
                especialidad: especialidad ?? null,
                parentesco: parentesco ?? null,
                seccionId: seccionId ? Number(seccionId) : null,
                fechaNacimiento: fechaNacimiento ? new Date(fechaNacimiento) : null,
            });
            return tx.usuario.findUnique({ where: { usuarioId: u.usuarioId }, include: incluirDetalle });
        });

        await registrarBitacora(actorId(req), 'Creación', 'Usuario', nuevo!.usuarioId,
            `Cuenta creada con rol ${roles.map((r) => r.nombre).join(' + ')}.`);

        return res.status(201).json({
            status: 'success',
            data: { ...sinPassword(nuevo!), passwordTemporal },
            message: passwordTemporal ? 'Usuario creado. Entregue la contraseña temporal al usuario.' : 'Usuario creado.',
        });
    } catch (error) {
        return responderError(res, error, 'Error al crear el usuario.');
    }
};

// PUT /api/usuarios/:id  { nombres?, apellidos?, email?, password?, rolId?, sedeId?, especialidad? }
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
    const { nombres, apellidos, password, rolId, sedeId, especialidad } = req.body;

    try {
        const id = leerId(req.params.id);
        const objetivo = await verificarPuedeGestionar(req, id);
        const esUnoMismo = id === actorId(req);
        const cambios: string[] = [];
        const data: Prisma.UsuarioUpdateInput = {};

        if (nombres?.trim()) data.nombres = nombres.trim();
        if (apellidos?.trim()) data.apellidos = apellidos.trim();
        if (req.body.email !== undefined) {
            const email = normalizarEmail(req.body.email);
            if (email !== objetivo.email) {
                if (await correoEnUso(email, id)) throw new ReglaNegocioError(`El correo ${email} ya está registrado.`);
                data.email = email;
                cambios.push(`correo ${objetivo.email} → ${email}`);
            }
        }
        if (password) {
            data.passwordHash = await bcrypt.hash(validarPassword(password), 10);
            cambios.push('contraseña restablecida');
        }

        // Cambio de rol principal: el anterior se pierde, asi que se valida que no deje nada colgando
        if (rolId !== undefined && Number(rolId) !== objetivo.rolId) {
            if (esUnoMismo) throw new ReglaNegocioError('No puede cambiar su propio rol.', 403);
            const [nuevoRol] = await nombresDeRoles([Number(rolId)]);
            await verificarPuedeAsignarRol(req, nuevoRol);
            const adicionales = objetivo.rolesAdicionales.filter((r) => r.rolId !== nuevoRol.rolId).map((r) => r.rol.nombre);
            validarCombinacionDeRoles([nuevoRol.nombre, ...adicionales]);
            if (!adicionales.includes(objetivo.rol.nombre)) await verificarPuedeQuitarRol(id, objetivo.rol.nombre);

            data.rol = { connect: { rolId: nuevoRol.rolId } };
            cambios.push(`rol ${objetivo.rol.nombre} → ${nuevoRol.nombre}`);
        }

        if (sedeId !== undefined && (sedeId ? Number(sedeId) : null) !== objetivo.sedeId) {
            if (esUnoMismo) throw new ReglaNegocioError('No puede cambiar su propia sede.', 403);
            if ((await sedeDelAlcance(req)) !== null) throw new ReglaNegocioError('Solo el Administrador General puede trasladar usuarios de sede.', 403);
            data.sede = sedeId ? { connect: { sedeId: Number(sedeId) } } : { disconnect: true };
            cambios.push('traslado de sede');
        }

        const actualizado = await prisma.$transaction(async (tx) => {
            await tx.usuario.update({ where: { usuarioId: id }, data });
            if (data.rol) {
                // Si el nuevo rol principal estaba como adicional, se quita de los adicionales
                await tx.usuarioRol.deleteMany({ where: { usuarioId: id, rolId: Number(rolId) } });
                const [nuevoRol] = await nombresDeRoles([Number(rolId)]);
                await asegurarRegistrosDeRol(tx, id, [nuevoRol.nombre], { especialidad });
            } else if (especialidad !== undefined) {
                await tx.catedratico.updateMany({ where: { catedraticoId: id }, data: { especialidad } });
            }
            return tx.usuario.findUnique({ where: { usuarioId: id }, include: incluirDetalle });
        });

        if (cambios.length > 0) await registrarBitacora(actorId(req), 'Modificación', 'Usuario', id, cambios.join('; '));

        return res.json({ status: 'success', data: sinPassword(actualizado!) });
    } catch (error) {
        return responderError(res, error, `Error al actualizar el usuario con ID ${req.params.id}.`);
    }
};

// PUT /api/usuarios/:id/roles  { rolesAdicionales: number[] }
// Ej.: un catedratico que tambien es padre de familia recibe el rol Encargado adicional
export const setRolesAdicionales = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = leerId(req.params.id);
        const objetivo = await verificarPuedeGestionar(req, id);
        if (id === actorId(req)) throw new ReglaNegocioError('No puede cambiar sus propios roles.', 403);

        const pedidos = Array.isArray(req.body.rolesAdicionales) ? req.body.rolesAdicionales.map(Number) : [];
        const nuevos = (await nombresDeRoles(pedidos)).filter((r) => r.rolId !== objetivo.rolId);
        validarCombinacionDeRoles([objetivo.rol.nombre, ...nuevos.map((r) => r.nombre)]);

        const actuales = objetivo.rolesAdicionales.map((r) => r.rol);
        const agregados = nuevos.filter((n) => !actuales.some((a) => a.rolId === n.rolId));
        const quitados = actuales.filter((a) => !nuevos.some((n) => n.rolId === a.rolId));

        for (const rol of agregados) await verificarPuedeAsignarRol(req, rol);
        for (const rol of quitados) {
            await verificarPuedeAsignarRol(req, rol);
            await verificarPuedeQuitarRol(id, rol.nombre);
        }

        const sedeNecesaria = agregados.find((r) => requiereSede(r.nombre));
        if (sedeNecesaria && !objetivo.sedeId) {
            throw new ReglaNegocioError(`Para darle el rol "${sedeNecesaria.nombre}" el usuario necesita una sede.`, 400);
        }

        await prisma.$transaction(async (tx) => {
            await tx.usuarioRol.deleteMany({ where: { usuarioId: id, rolId: { in: quitados.map((r) => r.rolId) } } });
            await tx.usuarioRol.createMany({ data: agregados.map((r) => ({ usuarioId: id, rolId: r.rolId })), skipDuplicates: true });
            await asegurarRegistrosDeRol(tx, id, agregados.map((r) => r.nombre), {});
        });

        const detalle = [
            agregados.length ? `agregados: ${agregados.map((r) => r.nombre).join(', ')}` : '',
            quitados.length ? `quitados: ${quitados.map((r) => r.nombre).join(', ')}` : '',
        ].filter(Boolean).join('; ');
        if (detalle) await registrarBitacora(actorId(req), 'Roles adicionales', 'Usuario', id, detalle);

        const actualizado = await prisma.usuario.findUnique({ where: { usuarioId: id }, include: incluirDetalle });
        return res.json({ status: 'success', data: sinPassword(actualizado!) });
    } catch (error) {
        return responderError(res, error, 'Error al actualizar los roles del usuario.');
    }
};

// Valida que la cuenta se pueda dar de baja sin dejar cursos o alumnos sin responsable
const verificarPuedeDarDeBaja = async (req: AuthenticatedRequest, id: number) => {
    if (id === actorId(req)) throw new ReglaNegocioError('No puede dar de baja su propia cuenta.', 403);
    await verificarNoEsUltimoAdminGeneral(id);

    const dep = await dependenciasDe(id);
    if (dep.cursosAsignados > 0) {
        throw new ReglaNegocioError(`Tiene ${dep.cursosAsignados} curso(s) asignado(s). Reasígnelos a otro catedrático antes de darlo de baja.`);
    }
    if (dep.alumnosACargo.length > 0) await verificarPuedeDejarDeSerEncargado(id);
};

// PATCH /api/usuarios/:id/estado  { activo: boolean, motivo }
export const cambiarEstadoUsuario = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const id = leerId(req.params.id);
        const objetivo = await verificarPuedeGestionar(req, id);
        const activar = Boolean(req.body.activo);
        const motivo = typeof req.body.motivo === 'string' ? req.body.motivo.trim() : '';
        if (motivo.length < 5) throw new ReglaNegocioError('Indique el motivo (mínimo 5 caracteres).', 400);

        if (activar === (objetivo.deletedAt === null)) {
            return res.status(409).json({ status: 'error', message: `La cuenta ya está ${activar ? 'activa' : 'dada de baja'}.` });
        }

        if (!activar) {
            await verificarPuedeDarDeBaja(req, id);
            // Si era encargado, sus vinculos quedan terminados (se conserva el historial)
            await prisma.alumnoEncargado.updateMany({
                where: { encargadoId: id, activo: true },
                data: { activo: false, esPrincipal: false, responsableFinanciero: false },
            });
        }

        await prisma.usuario.update({ where: { usuarioId: id }, data: { deletedAt: activar ? null : new Date() } });
        await registrarBitacora(actorId(req), activar ? 'Reactivación' : 'Baja', 'Usuario', id, motivo);

        return res.json({ status: 'success', message: activar ? 'Cuenta reactivada.' : 'Cuenta dada de baja. Ya no puede iniciar sesión.' });
    } catch (error) {
        return responderError(res, error, 'Error al cambiar el estado del usuario.');
    }
};

// DELETE /api/usuarios/:id  — baja logica (equivale a PATCH estado con activo=false)
export const deleteUserById = async (req: AuthenticatedRequest, res: Response) => {
    req.body = { activo: false, motivo: req.body?.motivo || 'Baja desde la administración' };
    return cambiarEstadoUsuario(req, res);
};

export const verificarEmailExistente = async (req: AuthenticatedRequest, res: Response) => {
    const { email } = req.query;

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ status: "Error", message: "El email es requerido"})
    }

    try{
        const usr = await prisma.usuario.findUnique({
            where: { 
                email: email.trim().toLowerCase(),
                deletedAt: null
            },
            select: {
                usuarioId: true
            }
        })

        console.log("»USER-CTRL: Verificacion de correo exitosa")
        return res.json({ status: "success", exists: Boolean(usr) })
    } catch (error) {
        console.log("»USER-CTRL: Verificacion de correo fallida")
        return res.status(500).json({ status: "Error", message: "No se pudo corroborar si existe el correo", error})
    }
}
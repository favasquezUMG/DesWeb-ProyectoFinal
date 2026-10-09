import type { Response } from 'express';
import bcrypt from 'bcryptjs';
import type { AlumnoEncargado, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { hoyUTC } from '../lib/fechas.js';
import { ReglaNegocioError } from '../lib/errores.js';
import type { AuthenticatedRequest } from '../middlewares/auth.middleware.js';
import { ROL, obtenerNombreRol, puedeOperarSede, sedeDelAlcance } from '../middlewares/role.middleware.js';
import { registrarBitacora, obtenerBitacora } from '../services/bitacora.service.js';
import { MAX_ENCARGADOS_ACTIVOS, PARENTESCOS, filtroVinculo, validarVinculos } from '../services/vinculos.service.js';
import { asegurarRegistrosDeRol, correoEnUso, generarPasswordTemporal, normalizarEmail } from '../services/usuarios.service.js';

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) {
        return res.status(error.status).json({ status: 'error', message: error.message });
    }
    return res.status(500).json({ status: 'error', message: mensaje, error: error instanceof Error ? error.message : error });
};

const leerId = (valor: unknown, campo = 'ID'): number => {
    if (typeof valor !== 'string' || !/^\d+$/.test(valor)) throw new ReglaNegocioError(`El ${campo}: ${valor} no es un número válido`, 400);
    return Number(valor);
};

const nombreDe = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

// GET /api/alumnos/all  ?seccionId ?q
// El personal ve los de su sede; el catedratico solo los de las secciones donde imparte.
export const getAlumnos = async (req: AuthenticatedRequest, res: Response) => {
    const { seccionId, q } = req.query;

    try {
        const where: Prisma.AlumnoWhereInput = { usuario: { deletedAt: null } };
        if (seccionId) where.seccionId = Number(seccionId);
        if (typeof q === 'string' && q.trim()) {
            where.usuario = {
                deletedAt: null,
                OR: [
                    { nombres: { contains: q.trim(), mode: 'insensitive' } },
                    { apellidos: { contains: q.trim(), mode: 'insensitive' } },
                ],
            };
        }

        const rol = await obtenerNombreRol(req);
        if (rol === ROL.CATEDRATICO) {
            where.seccion = { cursosSeccion: { some: { catedraticoId: Number(req.user?.id) } } };
        } else {
            const sedeId = await sedeDelAlcance(req);
            if (sedeId !== null) where.seccion = { sedeId };
        }

        const alumnos = await prisma.alumno.findMany({
            where,
            select: {
                alumnoId: true,
                seccionId: true,
                fechaNacimiento: true,
                usuario: { select: { nombres: true, apellidos: true, email: true } },
                seccion: { select: { seccionId: true, nombre: true, sedeId: true, grado: { select: { nombre: true } } } },
                encargados: {
                    where: { activo: true },
                    select: {
                        esPrincipal: true,
                        restringido: true,
                        vigenteHasta: true,
                        encargado: { select: { usuario: { select: { nombres: true, apellidos: true } } } },
                    },
                },
            },
            orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
        });

        const hoy = hoyUTC();
        const data = alumnos.map(({ encargados, ...a }) => {
            const vigentes = encargados.filter((e) => !e.restringido && (!e.vigenteHasta || e.vigenteHasta >= hoy));
            const principal = vigentes.find((e) => e.esPrincipal);
            return {
                ...a,
                encargadosActivos: vigentes.length,
                contactoPrincipal: principal ? nombreDe(principal.encargado.usuario) : null,
                tieneRestriccion: encargados.some((e) => e.restringido),
            };
        });

        return res.json({ status: 'success', data });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los alumnos.');
    }
};

// ===========================================================================
// Encargados de un alumno
// ===========================================================================

const verificarAlumnoDeMiSede = async (req: AuthenticatedRequest, alumnoId: number) => {
    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId },
        include: { usuario: { select: { nombres: true, apellidos: true } }, seccion: { include: { grado: true } } },
    });
    if (!alumno) throw new ReglaNegocioError(`Alumno con ID: ${alumnoId} no encontrado.`, 404);
    if (!(await puedeOperarSede(req, alumno.seccion.sedeId))) {
        throw new ReglaNegocioError('No puede administrar alumnos de otra sede.', 403);
    }
    return alumno;
};

const incluirEncargado = {
    encargado: {
        select: {
            encargadoId: true,
            usuario: { select: { usuarioId: true, nombres: true, apellidos: true, email: true, deletedAt: true } },
        },
    },
} as const;

// Banderas editables de un vinculo
interface DatosVinculo {
    parentesco?: string | null;
    esPrincipal?: boolean;
    responsableFinanciero?: boolean;
    tieneCustodia?: boolean;
    autorizadoRecoger?: boolean;
    puedeVerNotas?: boolean;
    puedeVerPagos?: boolean;
    recibeNotificaciones?: boolean;
    restringido?: boolean;
    motivoRestriccion?: string | null;
    vigenteHasta?: Date | null;
    observaciones?: string | null;
}

const BANDERAS = ['esPrincipal', 'responsableFinanciero', 'tieneCustodia', 'autorizadoRecoger', 'puedeVerNotas', 'puedeVerPagos', 'recibeNotificaciones', 'restringido'] as const;

const leerDatosVinculo = (body: any): DatosVinculo => {
    const datos: DatosVinculo = {};
    for (const campo of BANDERAS) {
        if (body[campo] !== undefined) datos[campo] = Boolean(body[campo]);
    }
    if (body.parentesco !== undefined) {
        if (body.parentesco && !PARENTESCOS.includes(body.parentesco)) {
            throw new ReglaNegocioError(`Parentesco no válido. Use: ${PARENTESCOS.join(', ')}.`, 400);
        }
        datos.parentesco = body.parentesco || null;
    }
    if (body.vigenteHasta !== undefined) {
        if (body.vigenteHasta) {
            const fecha = new Date(body.vigenteHasta);
            if (isNaN(fecha.getTime())) throw new ReglaNegocioError('La fecha de vigencia no es válida.', 400);
            if (fecha < hoyUTC()) throw new ReglaNegocioError('La vigencia no puede terminar en una fecha pasada.', 400);
            datos.vigenteHasta = fecha;
        } else {
            datos.vigenteHasta = null;
        }
    }
    if (body.observaciones !== undefined) datos.observaciones = body.observaciones ? String(body.observaciones).slice(0, 255) : null;
    if (body.motivoRestriccion !== undefined) datos.motivoRestriccion = body.motivoRestriccion ? String(body.motivoRestriccion).trim().slice(0, 500) : null;

    // Una restriccion judicial corta todo acceso y exige el motivo
    if (datos.restringido) {
        if (!datos.motivoRestriccion || datos.motivoRestriccion.length < 10) {
            throw new ReglaNegocioError('Indique el motivo de la restricción (ej. número de orden judicial), mínimo 10 caracteres.', 400);
        }
        Object.assign(datos, {
            esPrincipal: false,
            responsableFinanciero: false,
            autorizadoRecoger: false,
            puedeVerNotas: false,
            puedeVerPagos: false,
            recibeNotificaciones: false,
            tieneCustodia: false,
        });
    }
    return datos;
};

// Describe en lenguaje claro lo que se cambio (para la bitacora)
const ETIQUETA: Record<string, [string, string]> = {
    esPrincipal: ['contacto principal', 'deja de ser contacto principal'],
    responsableFinanciero: ['responsable de pagos', 'deja de ser responsable de pagos'],
    tieneCustodia: ['con custodia', 'sin custodia'],
    autorizadoRecoger: ['autorizado a recoger al alumno', 'NO autorizado a recoger al alumno'],
    puedeVerNotas: ['puede ver notas', 'sin acceso a notas'],
    puedeVerPagos: ['puede ver pagos', 'sin acceso a pagos'],
    recibeNotificaciones: ['recibe notificaciones', 'no recibe notificaciones'],
    restringido: ['RESTRINGIDO', 'restricción levantada'],
};

const describirCambios = (antes: Partial<AlumnoEncargado> | null, despues: DatosVinculo) => {
    const partes: string[] = [];
    for (const campo of BANDERAS) {
        const nuevo = despues[campo];
        if (nuevo === undefined) continue;
        if (antes && antes[campo] === nuevo) continue;
        if (!antes && !nuevo && campo !== 'autorizadoRecoger' && campo !== 'tieneCustodia') continue;
        partes.push(ETIQUETA[campo][nuevo ? 0 : 1]);
    }
    if (despues.parentesco !== undefined && despues.parentesco !== antes?.parentesco) partes.push(`parentesco: ${despues.parentesco ?? 'sin indicar'}`);
    if (despues.vigenteHasta !== undefined && String(despues.vigenteHasta) !== String(antes?.vigenteHasta ?? null)) {
        partes.push(despues.vigenteHasta ? `vigente hasta ${despues.vigenteHasta.toISOString().slice(0, 10)}` : 'sin fecha de fin');
    }
    if (despues.restringido && despues.motivoRestriccion) partes.push(`motivo: ${despues.motivoRestriccion}`);
    return partes.join(', ');
};

// Aplica el cambio en memoria a todos los vinculos del alumno, valida las reglas y guarda.
// Si el vinculo pasa a ser principal, los demas dejan de serlo.
const guardarVinculo = async (alumnoId: number, encargadoId: number, datos: DatosVinculo & { activo?: boolean }, crear: boolean) => {
    const actuales = await prisma.alumnoEncargado.findMany({ where: { alumnoId } });
    const hoy = hoyUTC();

    const base = actuales.find((v) => v.encargadoId === encargadoId);
    const propuesto = {
        encargadoId,
        activo: datos.activo ?? base?.activo ?? true,
        restringido: datos.restringido ?? base?.restringido ?? false,
        esPrincipal: datos.esPrincipal ?? base?.esPrincipal ?? false,
        responsableFinanciero: datos.responsableFinanciero ?? base?.responsableFinanciero ?? false,
        vigenteDesde: base && base.activo ? base.vigenteDesde : hoy,
        vigenteHasta: datos.vigenteHasta !== undefined ? datos.vigenteHasta : base?.vigenteHasta ?? null,
    };

    const resultado = [
        ...actuales
            .filter((v) => v.encargadoId !== encargadoId)
            .map((v) => ({ ...v, esPrincipal: propuesto.esPrincipal ? false : v.esPrincipal })),
        propuesto,
    ];
    validarVinculos(resultado);

    const data = { ...datos, vigenteDesde: propuesto.vigenteDesde, activo: propuesto.activo };
    await prisma.$transaction([
        ...(propuesto.esPrincipal
            ? [prisma.alumnoEncargado.updateMany({ where: { alumnoId, encargadoId: { not: encargadoId } }, data: { esPrincipal: false } })]
            : []),
        crear && !base
            ? prisma.alumnoEncargado.create({ data: { alumnoId, encargadoId, ...data } })
            : prisma.alumnoEncargado.update({ where: { alumnoId_encargadoId: { alumnoId, encargadoId } }, data }),
    ]);

    return base ?? null;
};

// GET /api/alumnos/:id/encargados
export const getEncargadosDeAlumno = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.id);
        const alumno = await verificarAlumnoDeMiSede(req, alumnoId);

        const [vinculos, bitacora] = await Promise.all([
            prisma.alumnoEncargado.findMany({
                where: { alumnoId },
                include: incluirEncargado,
                orderBy: [{ activo: 'desc' }, { esPrincipal: 'desc' }, { createdAt: 'asc' }],
            }),
            obtenerBitacora('Alumno', alumnoId, 40),
        ]);

        const vigentes = await prisma.alumnoEncargado.findMany({ where: { alumnoId, ...filtroVinculo() }, select: { encargadoId: true } });
        const idsVigentes = new Set(vigentes.map((v) => v.encargadoId));

        return res.json({
            status: 'success',
            data: {
                alumno: {
                    alumnoId,
                    nombre: nombreDe(alumno.usuario),
                    grado: `${alumno.seccion.grado.nombre} "${alumno.seccion.nombre}"`,
                },
                vinculos: vinculos.map((v) => ({ ...v, vigente: idsVigentes.has(v.encargadoId) })),
                bitacora,
                parentescos: PARENTESCOS,
                maximo: MAX_ENCARGADOS_ACTIVOS,
            },
        });
    } catch (error) {
        return responderError(res, error, 'Error al obtener los encargados del alumno.');
    }
};

// GET /api/alumnos/encargados/buscar?q=  — encargados existentes (o cualquier usuario por correo)
export const buscarEncargados = async (req: AuthenticatedRequest, res: Response) => {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (q.length < 3) return res.json({ status: 'success', data: [] });

    try {
        const usuarios = await prisma.usuario.findMany({
            where: {
                deletedAt: null,
                rol: { nombre: { not: ROL.ALUMNO } },
                OR: [
                    { email: { contains: q, mode: 'insensitive' } },
                    { nombres: { contains: q, mode: 'insensitive' } },
                    { apellidos: { contains: q, mode: 'insensitive' } },
                ],
            },
            select: {
                usuarioId: true,
                nombres: true,
                apellidos: true,
                email: true,
                rol: { select: { nombre: true } },
                encargado: { select: { _count: { select: { alumnosEncargado: { where: { activo: true } } } } } },
            },
            take: 10,
        });

        return res.json({
            status: 'success',
            data: usuarios.map((u) => ({
                usuarioId: u.usuarioId,
                nombre: nombreDe(u),
                email: u.email,
                rol: u.rol.nombre,
                esEncargado: u.encargado !== null,
                alumnosACargo: u.encargado?._count.alumnosEncargado ?? 0,
            })),
        });
    } catch (error) {
        return responderError(res, error, 'Error al buscar encargados.');
    }
};

// POST /api/alumnos/:id/encargados
// { usuarioId } para vincular a alguien que ya tiene cuenta, o { nuevo: { nombres, apellidos, email } }
// para crear la cuenta del encargado. Mas las banderas del vinculo.
// Si la persona ya tiene cuenta con otro rol (ej. es catedratico del colegio) se le agrega el rol Encargado.
export const agregarEncargado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.id);
        const alumno = await verificarAlumnoDeMiSede(req, alumnoId);
        const datos = leerDatosVinculo(req.body);
        if (datos.restringido) {
            throw new ReglaNegocioError('Primero agregue al encargado y luego registre la restricción desde su ficha.', 400);
        }

        const rolEncargado = await prisma.rol.findUnique({ where: { nombre: ROL.ENCARGADO } });
        if (!rolEncargado) throw new ReglaNegocioError('No existe el rol Encargado en el sistema.', 500);

        let usuarioId: number;
        let passwordTemporal: string | null = null;
        let nota = '';

        if (req.body.usuarioId) {
            const existente = await prisma.usuario.findFirst({
                where: { usuarioId: Number(req.body.usuarioId), deletedAt: null },
                include: { rol: true, rolesAdicionales: true },
            });
            if (!existente) throw new ReglaNegocioError('El usuario no existe o está dado de baja.', 404);
            if (existente.rol.nombre === ROL.ALUMNO) throw new ReglaNegocioError('Un alumno no puede ser encargado de otro alumno.', 400);
            if (existente.usuarioId === alumnoId) throw new ReglaNegocioError('El alumno no puede ser su propio encargado.', 400);
            usuarioId = existente.usuarioId;

            const yaEsEncargado = existente.rolId === rolEncargado.rolId || existente.rolesAdicionales.some((r) => r.rolId === rolEncargado.rolId);
            if (!yaEsEncargado) {
                await prisma.$transaction(async (tx) => {
                    await tx.usuarioRol.create({ data: { usuarioId, rolId: rolEncargado.rolId } });
                    await asegurarRegistrosDeRol(tx, usuarioId, [ROL.ENCARGADO], { parentesco: datos.parentesco ?? null });
                });
                nota = ` Se le agregó el rol Encargado a su cuenta de ${existente.rol.nombre}.`;
                await registrarBitacora(Number(req.user?.id), 'Roles adicionales', 'Usuario', usuarioId, `agregado: Encargado (de ${nombreDe(alumno.usuario)})`);
            } else {
                await prisma.encargado.upsert({ where: { encargadoId: usuarioId }, update: {}, create: { encargadoId: usuarioId } });
            }
        } else {
            const nuevo = req.body.nuevo ?? {};
            if (!nuevo.nombres?.trim() || !nuevo.apellidos?.trim()) {
                throw new ReglaNegocioError('Indique nombres, apellidos y correo del nuevo encargado.', 400);
            }
            const email = normalizarEmail(nuevo.email);
            if (await correoEnUso(email)) {
                throw new ReglaNegocioError(`El correo ${email} ya tiene cuenta. Búsquelo y vincúlelo en lugar de crear otra.`);
            }
            passwordTemporal = generarPasswordTemporal();
            const passwordHash = await bcrypt.hash(passwordTemporal, 10);
            const creado = await prisma.$transaction(async (tx) => {
                const u = await tx.usuario.create({
                    data: { nombres: nuevo.nombres.trim(), apellidos: nuevo.apellidos.trim(), email, passwordHash, rolId: rolEncargado.rolId },
                });
                await asegurarRegistrosDeRol(tx, u.usuarioId, [ROL.ENCARGADO], { parentesco: datos.parentesco ?? null });
                return u;
            });
            usuarioId = creado.usuarioId;
            await registrarBitacora(Number(req.user?.id), 'Creación', 'Usuario', usuarioId, `Cuenta de encargado creada para ${nombreDe(alumno.usuario)}.`);
        }

        const existente = await prisma.alumnoEncargado.findUnique({ where: { alumnoId_encargadoId: { alumnoId, encargadoId: usuarioId } } });
        if (existente?.activo) throw new ReglaNegocioError('Esa persona ya es encargado de este alumno.');

        // El primer encargado del alumno es, por fuerza, el contacto principal y quien paga
        const hayOtros = (await prisma.alumnoEncargado.count({ where: { alumnoId, activo: true, encargadoId: { not: usuarioId } } })) > 0;
        if (!hayOtros) Object.assign(datos, { esPrincipal: true, responsableFinanciero: true });

        await guardarVinculo(alumnoId, usuarioId, { ...datos, activo: true, restringido: false, motivoRestriccion: null }, true);

        const usuario = await prisma.usuario.findUnique({ where: { usuarioId }, select: { nombres: true, apellidos: true } });
        await registrarBitacora(
            Number(req.user?.id),
            existente ? 'Encargado reactivado' : 'Encargado agregado',
            'Alumno',
            alumnoId,
            `${nombreDe(usuario!)}${datos.parentesco ? ` (${datos.parentesco})` : ''}: ${describirCambios(null, datos) || 'permisos estándar'}.`,
        );

        return res.status(201).json({
            status: 'success',
            message: `Encargado vinculado.${nota}${passwordTemporal ? ' Entregue la contraseña temporal al encargado.' : ''}`,
            data: { usuarioId, passwordTemporal },
        });
    } catch (error) {
        return responderError(res, error, 'Error al agregar el encargado.');
    }
};

// PUT /api/alumnos/:id/encargados/:encargadoId  — permisos, custodia, restriccion, vigencia
export const actualizarVinculo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.id);
        const encargadoId = leerId(req.params.encargadoId, 'encargadoId');
        await verificarAlumnoDeMiSede(req, alumnoId);

        const vinculo = await prisma.alumnoEncargado.findUnique({
            where: { alumnoId_encargadoId: { alumnoId, encargadoId } },
            include: incluirEncargado,
        });
        if (!vinculo || !vinculo.activo) throw new ReglaNegocioError('Ese encargado no está vinculado a este alumno.', 404);

        const datos = leerDatosVinculo(req.body);
        if (datos.restringido === false && vinculo.restringido) datos.motivoRestriccion = null;
        const antes = await guardarVinculo(alumnoId, encargadoId, datos, false);

        const detalle = describirCambios(antes, datos);
        if (detalle) {
            await registrarBitacora(Number(req.user?.id), datos.restringido ? 'Restricción' : 'Vínculo modificado', 'Alumno', alumnoId,
                `${nombreDe(vinculo.encargado.usuario)}: ${detalle}.`);
        }

        return res.json({ status: 'success', message: 'Vínculo actualizado.' });
    } catch (error) {
        return responderError(res, error, 'Error al actualizar el vínculo.');
    }
};

// DELETE /api/alumnos/:id/encargados/:encargadoId  { motivo }
// El vinculo se termina (no se borra) para conservar el historial
export const quitarEncargado = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.id);
        const encargadoId = leerId(req.params.encargadoId, 'encargadoId');
        await verificarAlumnoDeMiSede(req, alumnoId);

        const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo.trim() : '';
        if (motivo.length < 5) throw new ReglaNegocioError('Indique el motivo (mínimo 5 caracteres).', 400);

        const vinculo = await prisma.alumnoEncargado.findUnique({
            where: { alumnoId_encargadoId: { alumnoId, encargadoId } },
            include: incluirEncargado,
        });
        if (!vinculo || !vinculo.activo) throw new ReglaNegocioError('Ese encargado no está vinculado a este alumno.', 404);

        await guardarVinculo(alumnoId, encargadoId, {
            activo: false,
            esPrincipal: false,
            responsableFinanciero: false,
            vigenteHasta: hoyUTC(),
        }, false);

        await registrarBitacora(Number(req.user?.id), 'Encargado retirado', 'Alumno', alumnoId, `${nombreDe(vinculo.encargado.usuario)}: ${motivo}`);
        return res.json({ status: 'success', message: 'El encargado ya no tiene acceso a la información del alumno.' });
    } catch (error) {
        return responderError(res, error, 'Error al quitar el encargado.');
    }
};

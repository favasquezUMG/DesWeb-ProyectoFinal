import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ROL, obtenerNombreRol } from "../middlewares/role.middleware.js";
import { puedeGestionarCursoSeccion, puedeVerAlumno } from "../services/acceso.service.js";
import { MENSAJE_SIN_ACCESO, tieneAccesoPortal } from "../services/accesoPortal.service.js";
import { hijosDe } from "../services/vinculos.service.js";
import {
    MAX_ARCHIVOS, borrarDeCloudinary, carpetaEntrega, carpetaMaterial, firmarSubida, urlTemporal, verificarSubida,
    type SubidaCloudinary,
} from "../services/archivos.service.js";
import {
    avisarRevision, cargarTarea, entregaTarde, estadoTarea, exigirAlumnoDeLaSeccion, exigirGestion, exigirVerAlumno,
    incluirCursoSeccion, motivoNoEditable, puedeEntregarPor, type TareaCargada,
} from "../services/tareas.service.js";

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) {
        return res.status(error.status).json({ status: "error", message: error.message });
    }
    return res.status(500).json({ status: "error", message: mensaje, error: error instanceof Error ? error.message : error });
};

const leerId = (valor: unknown, campo = "ID"): number => {
    if (typeof valor !== "string" || !/^\d+$/.test(valor)) throw new ReglaNegocioError(`El ${campo}: ${valor} no es un número válido`, 400);
    return Number(valor);
};

const leerTexto = (valor: unknown, max: number): string | null => {
    if (valor === undefined || valor === null) return null;
    const texto = String(valor).trim();
    if (texto.length > max) throw new ReglaNegocioError(`El texto puede tener como máximo ${max} caracteres.`, 400);
    return texto || null;
};

const leerSubidas = (valor: unknown): SubidaCloudinary[] => {
    if (valor === undefined) return [];
    if (!Array.isArray(valor)) throw new ReglaNegocioError("archivos debe ser una lista.", 400);
    return valor as SubidaCloudinary[];
};

const archivoDto = (a: { archivoId: number; nombre: string; bytes: number; formato: string | null; fechaSubida: Date }) => ({
    archivoId: a.archivoId,
    nombre: a.nombre,
    bytes: a.bytes,
    formato: a.formato,
    fechaSubida: a.fechaSubida.toISOString(),
});

const seleccionArchivo = { archivoId: true, nombre: true, bytes: true, formato: true, fechaSubida: true } as const;

const tareaDto = (t: TareaCargada) => ({
    actividadId: t.actividadId,
    nombre: t.nombre,
    tipo: t.tipo,
    puntosMaximos: Number(t.puntosMaximos),
    fecha: t.fecha ? t.fecha.toISOString().slice(0, 10) : null,
    unidad: t.unidad.numero,
    curso: t.unidad.cursoSeccion.curso.nombre,
    cursoSeccionId: t.unidad.cursoSeccionId,
    aceptaEntregas: t.aceptaEntregas,
    instrucciones: t.instrucciones,
    fechaLimite: t.fechaLimite?.toISOString() ?? null,
    permiteAtrasadas: t.permiteAtrasadas,
});

const entregaDto = (
    tarea: { fechaLimite: Date | null },
    e: {
        entregaId: number; estado: string; enClase: boolean; comentario: string | null; fechaEntrega: Date;
        retroalimentacion: string | null; fechaRevision: Date | null;
        entregadoPor: { nombres: string; apellidos: string } | null;
        archivos: Parameters<typeof archivoDto>[0][];
    },
) => ({
    entregaId: e.entregaId,
    estado: e.estado,
    enClase: e.enClase,
    comentario: e.comentario,
    fechaEntrega: e.fechaEntrega.toISOString(),
    tarde: entregaTarde(tarea, e),
    retroalimentacion: e.retroalimentacion,
    fechaRevision: e.fechaRevision?.toISOString() ?? null,
    entregadoPor: e.entregadoPor ? `${e.entregadoPor.nombres} ${e.entregadoPor.apellidos}` : null,
    archivos: e.archivos.map(archivoDto),
});

const incluirEntrega = {
    entregadoPor: { select: { nombres: true, apellidos: true } },
    archivos: { select: seleccionArchivo, orderBy: { archivoId: "asc" } },
} as const;

// ---------------------------------------------------------------------------
// Catedratico
// ---------------------------------------------------------------------------

// GET /api/tareas/:actividadId/entregas — bandeja: cada alumno de la seccion con su entrega y su nota
export const getEntregasTarea = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tarea = await cargarTarea(leerId(req.params.actividadId));
        await exigirGestion(req, tarea);

        const [material, alumnos, entregas, notas] = await Promise.all([
            prisma.archivoTarea.findMany({ where: { actividadId: tarea.actividadId }, select: seleccionArchivo, orderBy: { archivoId: "asc" } }),
            prisma.alumno.findMany({
                where: { seccionId: tarea.unidad.cursoSeccion.seccionId, usuario: { deletedAt: null } },
                select: { alumnoId: true, accesoPortal: true, usuario: { select: { nombres: true, apellidos: true } }, seccion: { select: { grado: { select: { nivel: true } } } } },
                orderBy: [{ usuario: { apellidos: "asc" } }, { usuario: { nombres: "asc" } }],
            }),
            prisma.entrega.findMany({ where: { actividadId: tarea.actividadId }, include: incluirEntrega }),
            prisma.nota.findMany({ where: { actividadId: tarea.actividadId }, select: { alumnoId: true, valor: true } }),
        ]);

        const entregaDe = new Map(entregas.map((e) => [e.alumnoId, e]));
        const notaDe = new Map(notas.map((n) => [n.alumnoId, Number(n.valor)]));

        return res.json({
            status: "success",
            data: {
                tarea: tareaDto(tarea),
                material: material.map(archivoDto),
                alumnos: alumnos.map((a) => {
                    const e = entregaDe.get(a.alumnoId);
                    return {
                        alumnoId: a.alumnoId,
                        nombres: a.usuario.nombres,
                        apellidos: a.usuario.apellidos,
                        entregaPorEncargado: !tieneAccesoPortal({ accesoPortal: a.accesoPortal, nivel: a.seccion.grado.nivel }),
                        estado: estadoTarea(tarea, e ?? null),
                        entrega: e ? entregaDto(tarea, e) : null,
                        nota: notaDe.get(a.alumnoId) ?? null,
                    };
                }),
            },
        });
    } catch (error) {
        return responderError(res, error, "Error al obtener las entregas de la tarea.");
    }
};

// POST /api/tareas/:actividadId/material — registra archivos del catedratico ya subidos a Cloudinary
export const agregarMaterial = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tarea = await cargarTarea(leerId(req.params.actividadId));
        await exigirGestion(req, tarea);

        const nuevos = leerSubidas(req.body.archivos).map((s) => verificarSubida(s, carpetaMaterial(tarea.actividadId)));
        const actuales = await prisma.archivoTarea.count({ where: { actividadId: tarea.actividadId } });
        if (actuales + nuevos.length > MAX_ARCHIVOS) throw new ReglaNegocioError(`Una tarea puede tener como máximo ${MAX_ARCHIVOS} archivos.`, 400);

        await prisma.archivoTarea.createMany({
            data: nuevos.map((a) => ({ ...a, actividadId: tarea.actividadId, subidoPorId: Number(req.user?.id) })),
            skipDuplicates: true,
        });
        const material = await prisma.archivoTarea.findMany({ where: { actividadId: tarea.actividadId }, select: seleccionArchivo, orderBy: { archivoId: "asc" } });
        return res.status(201).json({ status: "success", data: material.map(archivoDto) });
    } catch (error) {
        return responderError(res, error, "Error al guardar el material de la tarea.");
    }
};

// DELETE /api/tareas/material/:archivoId
export const quitarMaterial = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const archivo = await prisma.archivoTarea.findUnique({ where: { archivoId: leerId(req.params.archivoId) } });
        if (!archivo?.actividadId) throw new ReglaNegocioError("No se encontró el archivo.", 404);
        await exigirGestion(req, await cargarTarea(archivo.actividadId));

        await prisma.archivoTarea.delete({ where: { archivoId: archivo.archivoId } });
        await borrarDeCloudinary([archivo]);
        return res.json({ status: "success", message: "Archivo eliminado." });
    } catch (error) {
        return responderError(res, error, "Error al eliminar el archivo.");
    }
};

const cargarParaRevision = async (req: AuthenticatedRequest) => {
    const tarea = await cargarTarea(leerId(req.params.actividadId));
    await exigirGestion(req, tarea);
    const alumnoId = leerId(req.params.alumnoId, "alumno");
    await exigirAlumnoDeLaSeccion(tarea, alumnoId);
    const entrega = await prisma.entrega.findUnique({ where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } }, include: { archivos: true } });
    return { tarea, alumnoId, entrega };
};

// POST /api/tareas/:actividadId/alumnos/:alumnoId/calificar  { valor, retroalimentacion }
// La nota se guarda en Nota, asi que aparece en la libreta, el boletin y los reportes.
export const calificarEntrega = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { tarea, alumnoId, entrega } = await cargarParaRevision(req);
        if (!entrega) throw new ReglaNegocioError("El alumno no ha entregado esta tarea. Si quiere ponerle nota, hágalo desde la libreta.", 404);

        const puntos = Number(tarea.puntosMaximos);
        const valor = Number(req.body.valor);
        if (req.body.valor === "" || req.body.valor === null || isNaN(valor) || valor < 0 || valor > puntos) {
            throw new ReglaNegocioError(`La nota debe estar entre 0 y ${puntos}.`, 400);
        }
        const retroalimentacion = leerTexto(req.body.retroalimentacion, 2000);

        await prisma.$transaction([
            prisma.nota.upsert({
                where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } },
                update: { valor },
                create: { actividadId: tarea.actividadId, alumnoId, valor },
            }),
            prisma.entrega.update({
                where: { entregaId: entrega.entregaId },
                data: { estado: "Calificada", retroalimentacion, fechaRevision: new Date() },
            }),
        ]);
        await avisarRevision(alumnoId, tarea, tarea.unidad.cursoSeccion.curso.nombre, true, valor, puntos);

        return res.json({ status: "success", message: "Entrega calificada." });
    } catch (error) {
        return responderError(res, error, "Error al calificar la entrega.");
    }
};

// POST /api/tareas/:actividadId/alumnos/:alumnoId/devolver  { retroalimentacion }
// La entrega vuelve a quedar abierta para que el alumno la corrija (la nota, si tenia, se conserva).
export const devolverEntrega = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { tarea, alumnoId, entrega } = await cargarParaRevision(req);
        if (!entrega) throw new ReglaNegocioError("El alumno no ha entregado esta tarea.", 404);
        if (entrega.enClase) throw new ReglaNegocioError("Una entrega hecha en clase no se puede devolver en línea.", 409);
        const retroalimentacion = leerTexto(req.body.retroalimentacion, 2000);
        if (!retroalimentacion) throw new ReglaNegocioError("Escriba qué debe corregir el alumno.", 400);

        await prisma.entrega.update({
            where: { entregaId: entrega.entregaId },
            data: { estado: "Devuelta", retroalimentacion, fechaRevision: new Date() },
        });
        await avisarRevision(alumnoId, tarea, tarea.unidad.cursoSeccion.curso.nombre, false);

        return res.json({ status: "success", message: "Entrega devuelta al alumno." });
    } catch (error) {
        return responderError(res, error, "Error al devolver la entrega.");
    }
};

// POST /api/tareas/:actividadId/alumnos/:alumnoId/en-clase — el alumno la entregó en físico
export const marcarEnClase = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { tarea, alumnoId, entrega } = await cargarParaRevision(req);
        if (entrega) throw new ReglaNegocioError("El alumno ya tiene una entrega en esta tarea.", 409);
        await prisma.entrega.create({ data: { actividadId: tarea.actividadId, alumnoId, enClase: true } });
        return res.status(201).json({ status: "success", message: "Marcada como entregada en clase." });
    } catch (error) {
        return responderError(res, error, "Error al marcar la entrega.");
    }
};

// DELETE /api/tareas/:actividadId/alumnos/:alumnoId/en-clase — deshace la marca (si aún no se calificó)
export const desmarcarEnClase = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { entrega } = await cargarParaRevision(req);
        if (!entrega?.enClase) throw new ReglaNegocioError("Esta entrega no fue marcada en clase.", 409);
        if (entrega.estado === "Calificada") throw new ReglaNegocioError("La entrega ya fue calificada; quite la nota desde la libreta primero.", 409);
        await prisma.entrega.delete({ where: { entregaId: entrega.entregaId } });
        return res.json({ status: "success", message: "Marca quitada." });
    } catch (error) {
        return responderError(res, error, "Error al quitar la marca.");
    }
};

// ---------------------------------------------------------------------------
// Alumno y encargado
// ---------------------------------------------------------------------------

const cargarAlumnoTablero = async (req: AuthenticatedRequest, alumnoId: number) => {
    await exigirVerAlumno(req, alumnoId);
    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId },
        select: { seccionId: true, accesoPortal: true, usuario: { select: { nombres: true, apellidos: true } }, seccion: { select: { grado: { select: { nivel: true } } } } },
    });
    if (!alumno) throw new ReglaNegocioError("Alumno no encontrado.", 404);
    const accesoPortal = tieneAccesoPortal({ accesoPortal: alumno.accesoPortal, nivel: alumno.seccion.grado.nivel });
    if ((await obtenerNombreRol(req)) === ROL.ALUMNO && !accesoPortal) throw new ReglaNegocioError(MENSAJE_SIN_ACCESO, 403);
    return { ...alumno, accesoPortal, puedeEntregar: await puedeEntregarPor(req, alumnoId, accesoPortal) };
};

// GET /api/tareas/alumno/:alumnoId — tablero: todas las tareas en línea de los cursos del alumno
export const getTablero = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.alumnoId, "alumno");
        const alumno = await cargarAlumnoTablero(req, alumnoId);

        const tareas = await prisma.actividad.findMany({
            where: { aceptaEntregas: true, unidad: { cursoSeccion: { seccionId: alumno.seccionId } } },
            include: {
                unidad: { select: { numero: true, cursoSeccion: { select: { cursoSeccionId: true, curso: { select: { nombre: true } }, catedratico: { select: { usuario: { select: { nombres: true, apellidos: true } } } } } } } },
                entregas: { where: { alumnoId }, select: { estado: true, fechaEntrega: true, enClase: true } },
                notas: { where: { alumnoId }, select: { valor: true } },
            },
            orderBy: [{ fechaLimite: { sort: "asc", nulls: "last" } }, { actividadId: "asc" }],
        });

        return res.json({
            status: "success",
            data: {
                alumnoId,
                alumno: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                puedeEntregar: alumno.puedeEntregar,
                tareas: tareas.map((t) => {
                    const e = t.entregas[0] ?? null;
                    const cs = t.unidad.cursoSeccion;
                    return {
                        actividadId: t.actividadId,
                        nombre: t.nombre,
                        curso: cs.curso.nombre,
                        cursoSeccionId: cs.cursoSeccionId,
                        catedratico: `${cs.catedratico.usuario.nombres} ${cs.catedratico.usuario.apellidos}`,
                        unidad: t.unidad.numero,
                        tipo: t.tipo,
                        puntosMaximos: Number(t.puntosMaximos),
                        fechaLimite: t.fechaLimite?.toISOString() ?? null,
                        permiteAtrasadas: t.permiteAtrasadas,
                        estado: estadoTarea(t, e),
                        tarde: e ? entregaTarde(t, e) : false,
                        fechaEntrega: e?.fechaEntrega.toISOString() ?? null,
                        nota: t.notas[0] ? Number(t.notas[0].valor) : null,
                    };
                }),
            },
        });
    } catch (error) {
        return responderError(res, error, "Error al obtener las tareas.");
    }
};

// GET /api/tareas/alumno/:alumnoId/:actividadId — instrucciones, material y la entrega del alumno
export const getTareaAlumno = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alumnoId = leerId(req.params.alumnoId, "alumno");
        const alumno = await cargarAlumnoTablero(req, alumnoId);
        const tarea = await cargarTarea(leerId(req.params.actividadId));
        if (!tarea.aceptaEntregas || tarea.unidad.cursoSeccion.seccionId !== alumno.seccionId) {
            throw new ReglaNegocioError("No se encontró la tarea.", 404);
        }

        const [material, entrega, nota] = await Promise.all([
            prisma.archivoTarea.findMany({ where: { actividadId: tarea.actividadId }, select: seleccionArchivo, orderBy: { archivoId: "asc" } }),
            prisma.entrega.findUnique({ where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } }, include: incluirEntrega }),
            prisma.nota.findUnique({ where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } }, select: { valor: true } }),
        ]);
        const motivo = motivoNoEditable(tarea, entrega);

        return res.json({
            status: "success",
            data: {
                tarea: tareaDto(tarea),
                material: material.map(archivoDto),
                estado: estadoTarea(tarea, entrega),
                entrega: entrega ? entregaDto(tarea, entrega) : null,
                nota: nota ? Number(nota.valor) : null,
                puedeEntregar: alumno.puedeEntregar && !motivo && !entrega?.enClase,
                motivoNoEditable: alumno.puedeEntregar ? (entrega?.enClase ? "La tarea se entregó en clase." : motivo) : null,
            },
        });
    } catch (error) {
        return responderError(res, error, "Error al obtener la tarea.");
    }
};

// PUT /api/tareas/:actividadId/alumnos/:alumnoId/entrega  { comentario, archivos: [subidas], quitar: [archivoId] }
// Crea la entrega o la reemplaza (agregar o quitar archivos, cambiar el comentario). Vuelve a quedar "Entregada".
export const guardarEntrega = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tarea = await cargarTarea(leerId(req.params.actividadId));
        const alumnoId = leerId(req.params.alumnoId, "alumno");
        const { accesoPortal } = await exigirAlumnoDeLaSeccion(tarea, alumnoId);
        if (!(await puedeEntregarPor(req, alumnoId, accesoPortal))) {
            throw new ReglaNegocioError(accesoPortal ? "Esta tarea la entrega el alumno desde su portal." : "No puede entregar tareas de este alumno.", 403);
        }

        const existente = await prisma.entrega.findUnique({
            where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } },
            include: { archivos: true },
        });
        if (existente?.enClase) throw new ReglaNegocioError("La tarea ya se entregó en clase.", 409);
        const motivo = motivoNoEditable(tarea, existente);
        if (motivo) throw new ReglaNegocioError(motivo, 409);

        const comentario = leerTexto(req.body.comentario, 2000);
        const nuevos = leerSubidas(req.body.archivos).map((s) => verificarSubida(s, carpetaEntrega(tarea.actividadId, alumnoId)));
        const quitarIds = new Set<number>(Array.isArray(req.body.quitar) ? req.body.quitar.map(Number) : []);
        const quitados = (existente?.archivos ?? []).filter((a) => quitarIds.has(a.archivoId));
        const quedan = (existente?.archivos.length ?? 0) - quitados.length + nuevos.length;

        if (quedan > MAX_ARCHIVOS) throw new ReglaNegocioError(`Puede adjuntar como máximo ${MAX_ARCHIVOS} archivos.`, 400);
        if (quedan === 0 && !comentario) throw new ReglaNegocioError("Adjunte al menos un archivo o escriba un comentario.", 400);

        const usuarioId = Number(req.user?.id);
        await prisma.$transaction(async (tx) => {
            const entrega = await tx.entrega.upsert({
                where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } },
                update: { estado: "Entregada", comentario, fechaEntrega: new Date(), entregadoPorId: usuarioId },
                create: { actividadId: tarea.actividadId, alumnoId, comentario, entregadoPorId: usuarioId },
            });
            if (quitados.length > 0) await tx.archivoTarea.deleteMany({ where: { archivoId: { in: quitados.map((a) => a.archivoId) } } });
            if (nuevos.length > 0) {
                await tx.archivoTarea.createMany({
                    data: nuevos.map((a) => ({ ...a, entregaId: entrega.entregaId, subidoPorId: usuarioId })),
                    skipDuplicates: true,
                });
            }
        });
        await borrarDeCloudinary(quitados);

        return res.json({ status: "success", message: existente ? "Entrega actualizada." : "Tarea entregada." });
    } catch (error) {
        return responderError(res, error, "Error al guardar la entrega.");
    }
};

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

// POST /api/tareas/:actividadId/firma  { alumnoId? } — firma para subir directo a Cloudinary.
// Con alumnoId es para una entrega; sin él, para el material del catedratico.
export const firmarArchivo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const tarea = await cargarTarea(leerId(req.params.actividadId));
        if (req.body.alumnoId === undefined || req.body.alumnoId === null) {
            await exigirGestion(req, tarea);
            return res.json({ status: "success", data: firmarSubida(carpetaMaterial(tarea.actividadId)) });
        }

        const alumnoId = leerId(String(req.body.alumnoId), "alumno");
        const { accesoPortal } = await exigirAlumnoDeLaSeccion(tarea, alumnoId);
        if (!(await puedeEntregarPor(req, alumnoId, accesoPortal))) throw new ReglaNegocioError("No puede entregar tareas de este alumno.", 403);
        const entrega = await prisma.entrega.findUnique({ where: { actividadId_alumnoId: { actividadId: tarea.actividadId, alumnoId } }, select: { estado: true } });
        const motivo = motivoNoEditable(tarea, entrega);
        if (motivo) throw new ReglaNegocioError(motivo, 409);

        return res.json({ status: "success", data: firmarSubida(carpetaEntrega(tarea.actividadId, alumnoId)) });
    } catch (error) {
        return responderError(res, error, "Error al preparar la subida.");
    }
};

// ¿Puede ver el material de la tarea? El curso (catedratico, personal), los alumnos de la
// seccion y los encargados de esos alumnos.
const puedeVerMaterial = async (req: AuthenticatedRequest, tarea: TareaCargada) => {
    const cursoSeccion = tarea.unidad.cursoSeccion;
    if (await puedeGestionarCursoSeccion(req, cursoSeccion)) return true;
    const usuarioId = Number(req.user?.id);
    const rol = await obtenerNombreRol(req);
    if (rol === ROL.ALUMNO) return (await prisma.alumno.count({ where: { alumnoId: usuarioId, seccionId: cursoSeccion.seccionId } })) > 0;
    if (rol === ROL.ENCARGADO) return (await prisma.alumno.count({ where: { ...hijosDe(usuarioId, "notas"), seccionId: cursoSeccion.seccionId } })) > 0;
    return false;
};

// GET /api/tareas/archivos/:archivoId/url — URL temporal (5 minutos) para abrir el archivo
export const getUrlArchivo = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const archivo = await prisma.archivoTarea.findUnique({
            where: { archivoId: leerId(req.params.archivoId) },
            include: { entrega: { include: { actividad: { include: incluirCursoSeccion } } } },
        });
        if (!archivo) throw new ReglaNegocioError("No se encontró el archivo.", 404);

        let permitido: boolean;
        if (archivo.entrega) {
            permitido = (await puedeGestionarCursoSeccion(req, archivo.entrega.actividad.unidad.cursoSeccion))
                || (await puedeVerAlumno(req, archivo.entrega.alumnoId, "notas", "notas"));
        } else {
            permitido = await puedeVerMaterial(req, await cargarTarea(archivo.actividadId!));
        }
        if (!permitido) throw new ReglaNegocioError("No tiene permisos para ver este archivo.", 403);

        return res.json({ status: "success", data: { url: urlTemporal(archivo), nombre: archivo.nombre } });
    } catch (error) {
        return responderError(res, error, "Error al obtener el archivo.");
    }
};

import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import { ReglaNegocioError } from "../lib/errores.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { puedeOperarSede, sedeDelAlcance } from "../middlewares/role.middleware.js";

// Grados (fijos, del CNB) y las secciones que cada sede abre por ciclo escolar.

const responderError = (res: Response, error: unknown, mensaje: string) => {
    if (error instanceof ReglaNegocioError) return res.status(error.status).json({ status: "error", message: error.message });
    console.error(mensaje, error);
    return res.status(500).json({ status: "error", message: mensaje });
};

const NOMBRE_SECCION = /^[A-Za-zÁÉÍÓÚÑáéíóúñ0-9 ]{1,10}$/;

// La sede sobre la que se trabaja: la propia, o la elegida si es administrador general
const sedeObjetivo = async (req: AuthenticatedRequest, pedida: unknown): Promise<number> => {
    const alcance = await sedeDelAlcance(req);
    if (alcance !== null) {
        if (alcance === -1) throw new ReglaNegocioError("Su usuario no tiene una sede asignada.", 403);
        return alcance;
    }
    const sedeId = Number(pedida);
    if (!sedeId) throw new ReglaNegocioError("Indique la sede.", 400);
    return sedeId;
};

// GET /api/grados — grados con su malla curricular
export const getGrados = async (_req: AuthenticatedRequest, res: Response) => {
    try {
        const grados = await prisma.grado.findMany({
            include: { mallas: { include: { curso: { select: { cursoId: true, nombre: true } } } } },
            orderBy: { orden: "asc" },
        });
        return res.json({
            status: "success",
            data: grados.map((g) => ({
                gradoId: g.gradoId,
                nombre: g.nombre,
                nivel: g.nivel,
                orden: g.orden,
                cursos: g.mallas.map((m) => m.curso).sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
            })),
        });
    } catch (error) {
        return responderError(res, error, "Error al obtener los grados.");
    }
};

// GET /api/grados/secciones?anioLectivo=2026&sedeId=1
export const getSecciones = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alcance = await sedeDelAlcance(req);
        const sedeId = alcance ?? (req.query.sedeId ? Number(req.query.sedeId) : undefined);
        const anioLectivo = req.query.anioLectivo ? Number(req.query.anioLectivo) : undefined;

        const secciones = await prisma.seccion.findMany({
            where: { deletedAt: null, ...(sedeId !== undefined ? { sedeId } : {}), ...(anioLectivo ? { anioLectivo } : {}) },
            include: {
                grado: true,
                sede: { select: { sedeId: true, nombre: true } },
                _count: { select: { alumnos: true, cursosSeccion: true, matriculas: true } },
            },
            orderBy: [{ anioLectivo: "desc" }, { sedeId: "asc" }, { grado: { orden: "asc" } }, { nombre: "asc" }],
        });

        // Ciclos que existen, para el selector
        const ciclos = await prisma.seccion.findMany({
            where: { deletedAt: null, ...(sedeId !== undefined ? { sedeId } : {}) },
            select: { anioLectivo: true },
            distinct: ["anioLectivo"],
            orderBy: { anioLectivo: "desc" },
        });

        return res.json({
            status: "success",
            data: {
                ciclos: ciclos.map((c) => c.anioLectivo),
                secciones: secciones.map((s) => ({
                    seccionId: s.seccionId,
                    nombre: s.nombre,
                    anioLectivo: s.anioLectivo,
                    grado: { gradoId: s.grado.gradoId, nombre: s.grado.nombre, nivel: s.grado.nivel, orden: s.grado.orden },
                    sede: s.sede,
                    alumnos: s._count.alumnos,
                    cursos: s._count.cursosSeccion,
                    matriculas: s._count.matriculas,
                })),
            },
        });
    } catch (error) {
        return responderError(res, error, "Error al obtener las secciones.");
    }
};

// POST /api/grados/secciones { gradoId, nombre, anioLectivo, sedeId? }
export const createSeccion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { gradoId, anioLectivo } = req.body ?? {};
        const nombre = String(req.body?.nombre ?? "").trim().toUpperCase();
        if (!gradoId || !anioLectivo) throw new ReglaNegocioError("Indique el grado y el ciclo escolar.", 400);
        if (!NOMBRE_SECCION.test(nombre)) throw new ReglaNegocioError("El nombre de la sección debe tener de 1 a 10 letras o números (ej. A, B, Matutina).", 400);
        if (Number(anioLectivo) < new Date().getFullYear()) throw new ReglaNegocioError("No se pueden abrir secciones en ciclos que ya terminaron.", 400);

        const sedeId = await sedeObjetivo(req, req.body?.sedeId);
        const grado = await prisma.grado.findUnique({ where: { gradoId: Number(gradoId) } });
        if (!grado) throw new ReglaNegocioError("Grado no encontrado.", 404);

        const existente = await prisma.seccion.findUnique({
            where: { gradoId_sedeId_nombre_anioLectivo: { gradoId: grado.gradoId, sedeId, nombre, anioLectivo: Number(anioLectivo) } },
        });
        if (existente && !existente.deletedAt) throw new ReglaNegocioError(`Ya existe ${grado.nombre} sección ${nombre} en ${anioLectivo}.`, 409);

        // Si se había eliminado, se reactiva (la combinación es única en la base)
        const seccion = existente
            ? await prisma.seccion.update({ where: { seccionId: existente.seccionId }, data: { deletedAt: null } })
            : await prisma.seccion.create({ data: { gradoId: grado.gradoId, sedeId, nombre, anioLectivo: Number(anioLectivo) } });

        return res.status(201).json({ status: "success", message: `Sección ${grado.nombre} ${nombre} creada para ${anioLectivo}.`, data: seccion });
    } catch (error) {
        return responderError(res, error, "Error al crear la sección.");
    }
};

const verificarSeccion = async (req: AuthenticatedRequest, seccionId: number) => {
    const seccion = await prisma.seccion.findUnique({
        where: { seccionId },
        include: { grado: true, _count: { select: { alumnos: true, matriculas: true, cursosSeccion: true } } },
    });
    if (!seccion || seccion.deletedAt) throw new ReglaNegocioError("Sección no encontrada.", 404);
    if (!(await puedeOperarSede(req, seccion.sedeId))) throw new ReglaNegocioError("La sección pertenece a otra sede.", 403);
    return seccion;
};

// PUT /api/grados/secciones/:id { nombre }
export const updateSeccion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const seccion = await verificarSeccion(req, Number(req.params.id));
        const nombre = String(req.body?.nombre ?? "").trim().toUpperCase();
        if (!NOMBRE_SECCION.test(nombre)) throw new ReglaNegocioError("El nombre de la sección debe tener de 1 a 10 letras o números.", 400);

        const choque = await prisma.seccion.findFirst({
            where: { gradoId: seccion.gradoId, sedeId: seccion.sedeId, anioLectivo: seccion.anioLectivo, nombre, seccionId: { not: seccion.seccionId } },
        });
        if (choque) throw new ReglaNegocioError(`Ya existe la sección ${nombre} en ese grado y ciclo.`, 409);

        const actualizada = await prisma.seccion.update({ where: { seccionId: seccion.seccionId }, data: { nombre } });
        return res.json({ status: "success", message: "Sección actualizada.", data: actualizada });
    } catch (error) {
        return responderError(res, error, "Error al actualizar la sección.");
    }
};

// DELETE /api/grados/secciones/:id — solo si está vacía (sin alumnos, matrículas ni cursos)
export const deleteSeccion = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const seccion = await verificarSeccion(req, Number(req.params.id));
        const { alumnos, matriculas, cursosSeccion } = seccion._count;
        if (alumnos || matriculas || cursosSeccion) {
            throw new ReglaNegocioError(
                `No se puede eliminar: tiene ${alumnos} alumno(s), ${matriculas} matrícula(s) y ${cursosSeccion} curso(s) asignados. Traslade a los alumnos y quite los cursos primero.`,
                409,
            );
        }
        await prisma.seccion.update({ where: { seccionId: seccion.seccionId }, data: { deletedAt: new Date() } });
        return res.json({ status: "success", message: `Sección ${seccion.grado.nombre} ${seccion.nombre} eliminada.` });
    } catch (error) {
        return responderError(res, error, "Error al eliminar la sección.");
    }
};

// POST /api/grados/secciones/copiar { desde, hasta, sedeId? }
// Prepara el siguiente ciclo: abre las mismas secciones (sin alumnos) para que los padres puedan reinscribir
export const copiarSecciones = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const desde = Number(req.body?.desde);
        const hasta = Number(req.body?.hasta);
        if (!desde || !hasta || hasta <= desde) throw new ReglaNegocioError("El ciclo destino debe ser posterior al de origen.", 400);

        const sedeId = await sedeObjetivo(req, req.body?.sedeId);
        const origen = await prisma.seccion.findMany({ where: { sedeId, anioLectivo: desde, deletedAt: null } });
        if (origen.length === 0) throw new ReglaNegocioError(`La sede no tiene secciones en ${desde}.`, 404);

        const existentes = await prisma.seccion.findMany({ where: { sedeId, anioLectivo: hasta } });
        let creadas = 0;
        for (const s of origen) {
            const ya = existentes.find((e) => e.gradoId === s.gradoId && e.nombre === s.nombre);
            if (ya && !ya.deletedAt) continue;
            if (ya) await prisma.seccion.update({ where: { seccionId: ya.seccionId }, data: { deletedAt: null } });
            else await prisma.seccion.create({ data: { gradoId: s.gradoId, sedeId, nombre: s.nombre, anioLectivo: hasta } });
            creadas++;
        }

        return res.status(201).json({
            status: "success",
            message: creadas ? `Se abrieron ${creadas} secciones para el ciclo ${hasta}.` : `Todas las secciones de ${desde} ya existían en ${hasta}.`,
        });
    } catch (error) {
        return responderError(res, error, "Error al copiar las secciones.");
    }
};

import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { renderPdfFromHtml } from "../services/pdf.service.js";
import {
    plantillaReporteNotasPorCatedratico,
    plantillaReporteAlumnosPorRango,
} from "../templates/reporte.templates.js";

// Incluye lo necesario para calcular, por alumno, la nota de cada unidad
// (suma de las notas de sus actividades) de un curso-sección específico.
const incluirNotas = {
    curso: true,
    seccion: { include: { sede: true, grado: true } },
    unidades: {
        orderBy: { numero: "asc" as const },
        include: {
            actividades: { include: { notas: true } },
        },
    },
};

/**
 * Calcula, para un curso-sección, la nota de cada unidad de cada alumno
 * (suma de las notas de las actividades de esa unidad) y el total del curso.
 */
const calcularNotasCursoSeccion = async (cursoSeccionId: number) => {
    const cursoSeccion = await prisma.cursoSeccion.findUnique({
        where: { cursoSeccionId },
        include: incluirNotas,
    });

    if (!cursoSeccion) return null;

    const alumnos = await prisma.alumno.findMany({
        where: { seccionId: cursoSeccion.seccionId },
        include: { usuario: { select: { nombres: true, apellidos: true } } },
        orderBy: [{ usuario: { apellidos: "asc" } }, { usuario: { nombres: "asc" } }],
    });

    const filas = alumnos.map((alumno) => {
        const unidades = cursoSeccion.unidades.map((unidad) => {
            const nota = unidad.actividades.reduce((sumaUnidad, actividad) => {
                const notaAlumno = actividad.notas.find((n) => n.alumnoId === alumno.alumnoId);
                return sumaUnidad + (notaAlumno ? Number(notaAlumno.valor) : 0);
            }, 0);
            return { numero: unidad.numero, nota };
        });

        const total = unidades.reduce((acc, u) => acc + u.nota, 0);

        return {
            alumnoId: alumno.alumnoId,
            nombre: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
            unidades,
            total,
        };
    });

    return { cursoSeccion, alumnos: filas };
};

type ResultadoCursoSeccion = NonNullable<Awaited<ReturnType<typeof calcularNotasCursoSeccion>>>;

// GET /api/reportes/notas-por-catedratico/:catedraticoId?formato=json|pdf
export const getReporteNotasPorCatedratico = async (req: Request, res: Response) => {
    const { catedraticoId } = req.params;
    const { formato } = req.query;

    try {
        const catedratico = await prisma.catedratico.findUnique({
            where: { catedraticoId: Number(catedraticoId) },
            include: { usuario: { include: { sede: true } } },
        });

        if (!catedratico) {
            return res.status(404).json({ status: "error", message: `Catedrático con ID: ${catedraticoId} no encontrado` });
        }

        const cursosSeccion = await prisma.cursoSeccion.findMany({
            where: { catedraticoId: Number(catedraticoId) },
            select: { cursoSeccionId: true },
        });

        const cursos: ResultadoCursoSeccion[] = [];
        for (const { cursoSeccionId } of cursosSeccion) {
            const resultado = await calcularNotasCursoSeccion(cursoSeccionId);
            if (resultado) cursos.push(resultado);
        }

        const ciclosEscolares = [...new Set(cursos.map((c) => c.cursoSeccion.seccion.anioLectivo))];

        const reporte = {
            catedratico: {
                catedraticoId: catedratico.catedraticoId,
                nombre: `${catedratico.usuario.nombres} ${catedratico.usuario.apellidos}`,
                especialidad: catedratico.especialidad,
            },
            sede: catedratico.usuario.sede?.nombre ?? "N/A",
            cicloEscolar: ciclosEscolares.length ? ciclosEscolares.join(", ") : String(new Date().getFullYear()),
            cursos: cursos.map((c) => ({
                cursoSeccionId: c.cursoSeccion.cursoSeccionId,
                curso: c.cursoSeccion.curso.nombre,
                seccion: `${c.cursoSeccion.seccion.grado?.nombre ?? ""} "${c.cursoSeccion.seccion.nombre}"`,
                alumnos: c.alumnos,
            })),
        };

        if (formato === "json") {
            return res.json({ status: "success", data: reporte });
        }

        const html = plantillaReporteNotasPorCatedratico(reporte);
        const pdfBuffer = await renderPdfFromHtml(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="notas-catedratico-${catedraticoId}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Error al generar el reporte de notas del catedrático con ID: ${catedraticoId}.`,
            error,
        });
    }
};

// GET /api/reportes/alumnos-por-rango?seccionId=X&formato=json|pdf
export const getReporteAlumnosPorRango = async (req: Request, res: Response) => {
    const { seccionId, formato } = req.query;

    if (!seccionId) {
        return res.status(400).json({ status: "error", message: "El parámetro seccionId es obligatorio." });
    }

    try {
        const seccion = await prisma.seccion.findUnique({
            where: { seccionId: Number(seccionId) },
            include: { sede: true, grado: true },
        });

        if (!seccion) {
            return res.status(404).json({ status: "error", message: `Sección con ID: ${seccionId} no encontrada` });
        }

        const cursosSeccion = await prisma.cursoSeccion.findMany({
            where: { seccionId: Number(seccionId) },
            select: { cursoSeccionId: true },
        });

        const resultadosPorCurso: ResultadoCursoSeccion[] = [];
        for (const { cursoSeccionId } of cursosSeccion) {
            const resultado = await calcularNotasCursoSeccion(cursoSeccionId);
            if (resultado) resultadosPorCurso.push(resultado);
        }

        const alumnos = await prisma.alumno.findMany({
            where: { seccionId: Number(seccionId) },
            include: { usuario: { select: { nombres: true, apellidos: true } } },
            orderBy: [{ usuario: { apellidos: "asc" } }, { usuario: { nombres: "asc" } }],
        });

        // El promedio general del alumno es el promedio de los totales de cada curso-sección
        const filas = alumnos.map((alumno) => {
            const totales = resultadosPorCurso.map(
                (c) => c.alumnos.find((a) => a.alumnoId === alumno.alumnoId)?.total ?? 0
            );
            const promedio = totales.length ? totales.reduce((a, b) => a + b, 0) / totales.length : 0;

            return {
                alumnoId: alumno.alumnoId,
                nombre: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
                promedio: Number(promedio.toFixed(2)),
            };
        });

        const reprobados = filas.filter((a) => a.promedio >= 0 && a.promedio <= 60);
        const aprobados = filas.filter((a) => a.promedio > 60 && a.promedio <= 100);

        const reporte = {
            sede: seccion.sede?.nombre ?? "N/A",
            cicloEscolar: String(seccion.anioLectivo),
            seccion: `${seccion.grado?.nombre ?? ""} "${seccion.nombre}"`,
            reprobados,
            aprobados,
        };

        if (formato === "json") {
            return res.json({ status: "success", data: reporte });
        }

        const html = plantillaReporteAlumnosPorRango(reporte);
        const pdfBuffer = await renderPdfFromHtml(html);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `inline; filename="alumnos-rango-seccion-${seccionId}.pdf"`);
        return res.send(pdfBuffer);
    } catch (error) {
        return res.status(500).json({
            status: "error",
            message: `Error al generar el reporte de alumnos por rango de la sección con ID: ${seccionId}.`,
            error,
        });
    }
};

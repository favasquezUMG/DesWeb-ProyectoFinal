import type { Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// GET /api/sedes
export const get = async (_req: Request, res: Response) => {
    try {
        const sedes = await prisma.sede.findMany({
        where: { activo: true, deletedAt: null },
        select: {
            sedeId: true,
            nombre: true,
            direccion: true,
            telefono: true,
        },
        orderBy: { nombre: "asc" },
        });

        return res.json({ status: "success", data: sedes });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Error al obtener las sedes.", error });
    }
};

// POST /api/sedes
export const crearSede = async (req: Request, res: Response) => {
  const { nombre, direccion, telefono } = req.body ?? {};

  if (!nombre || typeof nombre !== "string" || !nombre.trim()) {
    return res.status(400).json({
      status: "error",
      message: "El nombre de la sede es obligatorio.",
    });
  }

  try {
    const nuevaSede = await prisma.sede.create({
      data: {
        nombre: nombre.trim(),
        direccion: direccion?.trim() || null,
        telefono: telefono?.trim() || null,
      },
    });

    return res.status(201).json({
      status: "success",
      data: nuevaSede,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error al crear la sede.",
      error,
    });
  }
};

// PUT /api/sedes/:id
export const actualizarSede = async (req: Request, res: Response) => {
  const idParam = req.params.id || req.params.sedeId;
  const sedeId = Number(idParam);

  if (isNaN(sedeId)) {
    return res.status(400).json({
      status: "error",
      message: "El ID de la sede no es válido.",
    });
  }

  const { nombre, direccion, telefono } = req.body ?? {};

  try {
    const sedeExistente = await prisma.sede.findUnique({
      where: { sedeId },
    });

    if (!sedeExistente) {
      return res.status(404).json({
        status: "error",
        message: "La sede especificada no existe.",
      });
    }

    const sedeActualizada = await prisma.sede.update({
      where: { sedeId },
      data: {
        ...(nombre && { nombre: nombre.trim() }),
        ...(direccion !== undefined && { direccion: direccion?.trim() || null }),
        ...(telefono !== undefined && { telefono: telefono?.trim() || null }),
      },
    });

    return res.json({
      status: "success",
      data: sedeActualizada,
    });
  } catch (error) {
    return res.status(500).json({
      status: "error",
      message: "Error al actualizar la sede.",
      error,
    });
  }
};


// GET /api/sedes/metricas — Métricas consolidadas por sede para gráficos y dashboards
// Todo sale en 4 consultas en paralelo (no 3 por sede): la BD está lejos y cada viaje cuesta.
export const getSedesMetricas = async (_req: Request, res: Response) => {
  try {
    const anioActual = new Date().getFullYear();

    const [sedes, alumnosPorSede, totalesUnidad, moraPorSede] = await Promise.all([
      prisma.sede.findMany({
        where: { activo: true, deletedAt: null },
        select: { sedeId: true, nombre: true },
      }),
      // Alumnos activos por sede
      prisma.usuario.groupBy({
        by: ["sedeId"],
        where: { rol: { nombre: "Alumno" }, deletedAt: null },
        _count: { _all: true },
      }),
      // Total de cada unidad (suma de sus actividades) por alumno, en el año actual
      prisma.$queryRaw<{ sedeId: number; alumnoId: number; total: number }[]>`
        SELECT us."sedeId", n."alumnoId", SUM(n.valor)::float AS total
        FROM "Nota" n
        JOIN "Usuario" us ON us."usuarioId" = n."alumnoId" AND us."deletedAt" IS NULL
        JOIN "Actividad" a ON a."actividadId" = n."actividadId"
        JOIN "Unidad" u ON u."unidadId" = a."unidadId"
        JOIN "CursoSeccion" cs ON cs."cursoSeccionId" = u."cursoSeccionId"
        JOIN "Seccion" s ON s."seccionId" = cs."seccionId"
        WHERE s."anioLectivo" = ${anioActual} AND us."sedeId" IS NOT NULL
        GROUP BY us."sedeId", n."alumnoId", a."unidadId"`,
      // Pagos pendientes del año actual por sede
      prisma.$queryRaw<{ sedeId: number; pendientes: number }[]>`
        SELECT us."sedeId", COUNT(*)::int AS pendientes
        FROM "Pago" p
        JOIN "Usuario" us ON us."usuarioId" = p."alumnoId"
        WHERE p."anioLectivo" = ${anioActual} AND p.estado = 'Pendiente' AND us."sedeId" IS NOT NULL
        GROUP BY us."sedeId"`,
    ]);

    const alumnosDe = new Map(alumnosPorSede.map((g) => [g.sedeId, g._count._all]));
    const moraDe = new Map(moraPorSede.map((m) => [m.sedeId, m.pendientes]));

    // Totales de unidad agrupados por sede y alumno
    const unidadesDe = new Map<number, Map<number, number[]>>();
    for (const t of totalesUnidad) {
      const porAlumno = unidadesDe.get(t.sedeId) ?? new Map<number, number[]>();
      porAlumno.set(t.alumnoId, [...(porAlumno.get(t.alumnoId) ?? []), t.total]);
      unidadesDe.set(t.sedeId, porAlumno);
    }

    const resultado = sedes.map((sede) => {
      const totalAlumnos = alumnosDe.get(sede.sedeId) ?? 0;
      if (totalAlumnos === 0) {
        return { sedeId: sede.sedeId, nombre: sede.nombre, alumnos: 0, aprobacion: 0, mora: 0 };
      }

      // Criterio de aprobación: Nota Final promedio (de sus unidades) >= 61
      const promedios = [...(unidadesDe.get(sede.sedeId)?.values() ?? [])]
        .map((unidades) => unidades.reduce((acc, curr) => acc + curr, 0) / unidades.length);
      const aprobados = promedios.filter((p) => p >= 61).length;

      return {
        sedeId: sede.sedeId,
        nombre: sede.nombre,
        alumnos: totalAlumnos,
        aprobacion: promedios.length > 0 ? Math.round((aprobados / promedios.length) * 100) : 0,
        mora: Math.round(((moraDe.get(sede.sedeId) ?? 0) / totalAlumnos) * 100),
      };
    });

    return res.json({ status: "success", data: resultado });
  } catch (error) {
    console.error("Error al obtener métricas de sedes:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al generar métricas de las sedes.",
    });
  }
};

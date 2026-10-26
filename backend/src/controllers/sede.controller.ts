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

// Todo lo que cuelga de una sede. Mientras tenga algo, solo se puede desactivar, nunca borrar
// (se perderia el historial de alumnos, notas, pagos...).
const conteoRelacionados = {
  usuarios: true,
  secciones: true,
  eventos: true,
  comunicados: true,
  programasBeca: true,
  politicasBeca: true,
  solicitudes: true,
} as const;

const ETIQUETAS: Record<keyof typeof conteoRelacionados, string> = {
  usuarios: "usuario(s)",
  secciones: "sección(es)",
  eventos: "evento(s)",
  comunicados: "comunicado(s)",
  programasBeca: "programa(s) de beca",
  politicasBeca: "política(s) de beca",
  solicitudes: "solicitud(es) de inscripción",
};

// "3 usuario(s), 2 sección(es)": lo que impide borrar la sede
const resumirRelacionados = (conteo: Record<keyof typeof conteoRelacionados, number>) =>
  (Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[])
    .filter((k) => conteo[k] > 0)
    .map((k) => `${conteo[k]} ${ETIQUETAS[k]}`)
    .join(", ");

const alumnosActivosDe = (sedeId: number) =>
  prisma.usuario.count({ where: { sedeId, deletedAt: null, rol: { nombre: "Alumno" } } });

// GET /api/sedes/admin — todas las sedes (activas y desactivadas) con lo que tienen registrado
export const getSedesAdmin = async (_req: Request, res: Response) => {
  try {
    const sedes = await prisma.sede.findMany({
      where: { deletedAt: null },
      include: { _count: { select: conteoRelacionados } },
      orderBy: { nombre: "asc" },
    });
    const alumnos = await prisma.usuario.groupBy({
      by: ["sedeId"],
      where: { deletedAt: null, rol: { nombre: "Alumno" }, sedeId: { in: sedes.map((s) => s.sedeId) } },
      _count: { _all: true },
    });
    const alumnosDe = new Map(alumnos.map((a) => [a.sedeId, a._count._all]));

    return res.json({
      status: "success",
      data: sedes.map(({ _count, ...sede }) => {
        const relacionados = resumirRelacionados(_count);
        return {
          sedeId: sede.sedeId,
          nombre: sede.nombre,
          direccion: sede.direccion,
          telefono: sede.telefono,
          activo: sede.activo,
          alumnosActivos: alumnosDe.get(sede.sedeId) ?? 0,
          // Se puede borrar solo si esta desactivada y no tiene nada registrado
          puedeEliminar: !sede.activo && relacionados === "",
          relacionados,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Error al obtener las sedes.", error });
  }
};

// PATCH /api/sedes/:id/activo  { activo: boolean }
// Una sede desactivada deja de aparecer en la inscripción en línea y en las listas de sedes.
// No se puede desactivar mientras tenga alumnos activos: primero hay que trasladarlos o darlos de baja.
export const cambiarEstadoSede = async (req: Request, res: Response) => {
  const sedeId = Number(req.params.id);
  const { activo } = req.body ?? {};

  if (isNaN(sedeId)) {
    return res.status(400).json({ status: "error", message: "El ID de la sede no es válido." });
  }
  if (typeof activo !== "boolean") {
    return res.status(400).json({ status: "error", message: "Indique si la sede queda activa (true) o desactivada (false)." });
  }

  try {
    const sede = await prisma.sede.findUnique({ where: { sedeId } });
    if (!sede || sede.deletedAt) {
      return res.status(404).json({ status: "error", message: "La sede especificada no existe." });
    }

    if (!activo) {
      const alumnos = await alumnosActivosDe(sedeId);
      if (alumnos > 0) {
        return res.status(409).json({
          status: "error",
          message: `${sede.nombre} tiene ${alumnos} alumno(s) activo(s). Trasládelos a otra sede o délos de baja antes de desactivarla.`,
        });
      }
    }

    await prisma.sede.update({ where: { sedeId }, data: { activo } });
    return res.json({
      status: "success",
      message: activo ? `${sede.nombre} quedó activa.` : `${sede.nombre} quedó desactivada.`,
    });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Error al cambiar el estado de la sede.", error });
  }
};

// DELETE /api/sedes/:id — solo una sede desactivada y sin nada registrado (una sede creada por error)
export const eliminarSede = async (req: Request, res: Response) => {
  const sedeId = Number(req.params.id);
  if (isNaN(sedeId)) {
    return res.status(400).json({ status: "error", message: "El ID de la sede no es válido." });
  }

  try {
    const sede = await prisma.sede.findUnique({
      where: { sedeId },
      include: { _count: { select: conteoRelacionados } },
    });
    if (!sede || sede.deletedAt) {
      return res.status(404).json({ status: "error", message: "La sede especificada no existe." });
    }
    if (sede.activo) {
      return res.status(409).json({ status: "error", message: "Primero desactive la sede; solo se puede eliminar una sede desactivada." });
    }
    const relacionados = resumirRelacionados(sede._count);
    if (relacionados) {
      return res.status(409).json({
        status: "error",
        message: `No se puede eliminar ${sede.nombre} porque tiene ${relacionados}. Puede dejarla desactivada.`,
      });
    }

    await prisma.sede.delete({ where: { sedeId } });
    return res.json({ status: "success", message: `${sede.nombre} se eliminó.` });
  } catch (error) {
    return res.status(500).json({ status: "error", message: "Error al eliminar la sede.", error });
  }
};

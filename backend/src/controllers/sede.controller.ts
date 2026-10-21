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
export const getSedesMetricas = async (_req: Request, res: Response) => {
  try {
    const anioActual = new Date().getFullYear();

    // 1. Obtenemos las sedes activas
    const sedes = await prisma.sede.findMany({
      where: {
        activo: true,
        deletedAt: null,
      },
      select: {
        sedeId: true,
        nombre: true,
      },
    });

    const rolAlumno = await prisma.rol.findFirst({
      where: { nombre: "Alumno" },
    });

    if (!rolAlumno) {
      return res.status(400).json({ status: "error", message: "No se encontró el rol Alumno." });
    }

    // 2. Procesamos las métricas por cada sede
    const resultado = await Promise.all(
      sedes.map(async (sede) => {
        // a) Total de alumnos activos en esta sede
        const totalAlumnos = await prisma.usuario.count({
          where: {
            sedeId: sede.sedeId,
            rolId: rolAlumno.rolId,
            deletedAt: null,
          },
        });

        if (totalAlumnos === 0) {
          return {
            sedeId: sede.sedeId,
            nombre: sede.nombre,
            alumnos: 0,
            aprobacion: 0,
            mora: 0,
          };
        }

        // b) Obtener todas las notas registradas en esta sede para el año actual
        const notasDetalle = await prisma.nota.findMany({
          where: {
            alumno: {
              usuario: {
                sedeId: sede.sedeId,
                deletedAt: null,
              },
            },
            actividad: {
              unidad: {
                cursoSeccion: {
                  seccion: {
                    anioLectivo: anioActual,
                  },
                },
              },
            },
          },
          select: {
            alumnoId: true,
            valor: true,
            actividad: {
              select: {
                unidadId: true,
              },
            },
          },
        });

        // c) Agrupar y sumar notas por (alumnoId + unidadId) -> Total Unidad
        const sumaUnidades: Record<string, number> = {}; // Clave: `${alumnoId}_${unidadId}`

        notasDetalle.forEach((n) => {
          const key = `${n.alumnoId}_${n.actividad.unidadId}`;
          sumaUnidades[key] = (sumaUnidades[key] || 0) + Number(n.valor);
        });

        // d) Agrupar los Totales de Unidad por Alumno
        const promediosAlumnosSede: Record<number, number[]> = {};

        Object.entries(sumaUnidades).forEach(([key, totalUnidad]) => {
          const [alumnoIdStr] = key.split("_");
          const alumnoId = Number(alumnoIdStr);

          if (!promediosAlumnosSede[alumnoId]) {
            promediosAlumnosSede[alumnoId] = [];
          }
          promediosAlumnosSede[alumnoId].push(totalUnidad);
        });

        // e) Calcular tasa de aprobación real de la sede
        const alumnosEvaluadosSede = Object.keys(promediosAlumnosSede).length;
        let aprobadosSede = 0;

        Object.values(promediosAlumnosSede).forEach((totalesUnidad) => {
          const promedioAlumno =
            totalesUnidad.reduce((acc, curr) => acc + curr, 0) / totalesUnidad.length;

          // Criterio de aprobación: Nota Final promedio >= 61
          if (promedioAlumno >= 61) {
            aprobadosSede++;
          }
        });

        const tasaAprobacionSede = alumnosEvaluadosSede > 0
          ? Math.round((aprobadosSede / alumnosEvaluadosSede) * 100)
          : 0;

        // f) Métrica de mora de la sede (pagos pendientes del año actual)
        const pagosPendientes = await prisma.pago.count({
          where: {
            anioLectivo: anioActual,
            estado: "Pendiente",
            alumno: {
              usuario: {
                sedeId: sede.sedeId,
              },
            },
          },
        });

        const porcentajeMora = totalAlumnos > 0
          ? Math.round((pagosPendientes / totalAlumnos) * 100)
          : 0;

        return {
          sedeId: sede.sedeId,
          nombre: sede.nombre,
          alumnos: totalAlumnos,
          aprobacion: tasaAprobacionSede,
          mora: porcentajeMora,
        };
      })
    );

    return res.json({ status: "success", data: resultado });
  } catch (error) {
    console.error("Error al obtener métricas de sedes:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al generar métricas de las sedes.",
    });
  }
};
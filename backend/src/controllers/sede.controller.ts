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
  const { nombre, direccion, municipio, departamento, telefono } = req.body ?? {};

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
        municipio: municipio?.trim() || null,
        departamento: departamento?.trim() || null,
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

  const { nombre, direccion, municipio, departamento, telefono } = req.body ?? {};

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
        ...(municipio !== undefined && { municipio: municipio?.trim() || null }),
        ...(departamento !== undefined && { departamento: departamento?.trim() || null }),
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
    // 1. Buscamos el rol 'Alumno' en la base de datos
    const rolAlumno = await prisma.rol.findFirst({
      where: { nombre: "Alumno" },
    });

    if (!rolAlumno) {
      return res.status(400).json({
        status: "error",
        message: "No se encontró el rol 'Alumno' en la base de datos.",
      });
    }

    // 2. Obtenemos las sedes activas
    const sedes = await prisma.sede.findMany({
      where: { activo: true, deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        sedeId: true,
        nombre: true,
      },
    });

    // 3. Calculamos métricas reales por sede
    const data = await Promise.all(
      sedes.map(async (sede) => {
        // Alumnos (usuarios) pertenecientes a esta sede
        const alumnosSede = await prisma.usuario.findMany({
          where: {
            sedeId: sede.sedeId,
            rolId: rolAlumno.rolId,
            deletedAt: null,
          },
          select: { usuarioId: true },
        });

        const totalAlumnos = alumnosSede.length;
        const alumnoIds = alumnosSede.map((a) => a.usuarioId);

        // Si la sede no tiene alumnos registrados, devolvemos 0 en todo
        if (totalAlumnos === 0) {
          return {
            sedeId: sede.sedeId,
            nombre: sede.nombre,
            alumnos: 0,
            aprobacion: 0,
            mora: 0,
          };
        }

        // --- 1. TASA DE APROBACIÓN REAL ---
        const totalNotas = await prisma.nota.count({
          where: {
            alumnoId: { in: alumnoIds },
          },
        });

        const notasAprobadas = await prisma.nota.count({
          where: {
            alumnoId: { in: alumnoIds },
            valor: { gte: 60 },
          },
        });

        const aprobacion = totalNotas > 0
          ? Math.round((notasAprobadas / totalNotas) * 100)
          : 0;

        // --- 2. PORCENTAJE EN MORA REAL ---
        // Agrupamos por `alumnoId` (en la tabla pago) buscando pagos en estado 'Pendiente'
        const alumnosEnMora = await prisma.pago.groupBy({
          by: ["alumnoId"],
          where: {
            alumnoId: { in: alumnoIds },
            OR: [
              { estado: "Pendiente" },
              { estado: "PENDIENTE" },
            ],
          },
        });

        const mora = Math.round((alumnosEnMora.length / totalAlumnos) * 100);

        return {
          sedeId: sede.sedeId,
          nombre: sede.nombre,
          alumnos: totalAlumnos,
          aprobacion,
          mora,
        };
      })
    );

    return res.json({ status: "success", data });
  } catch (error) {
    console.error("Error en getSedesMetricas:", error);
    return res.status(500).json({
      status: "error",
      message: "Error al generar las métricas de las sedes.",
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
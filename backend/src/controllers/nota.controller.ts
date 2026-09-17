import type { Response, Request } from "express";
import { prisma } from "../lib/prisma.js";

//Get All
export const getNotas = async (_req: Request, res: Response) => {
  try {
    const grades = await prisma.nota.findMany({
      include: {
        actividad: {
          select: { nombre: true }
        },
        alumno: {
          select: {
            usuario: {
              select: { usuarioId: true , nombres: true }
            }
          },
        }
      }
    })

    return res.json({ status: 'success', data: grades });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'No se pudo obtener las notas', error})
  }
}

//Get By ActivityId
export const getNotasByActivity = async (req: Request, res: Response) => {
    const { activityId } = req.params;

    try{
        const notasByActivity = await prisma.nota.findMany({
            where:{ actividadId: Number(activityId) },
            select: {
                notaId: true,
                actividadId: true,
                alumnoId: true,
                valor: true,
                fechaRegistro: true,
                actividad: {
                    select: {
                        nombre: true,
                        puntosMaximos: true,
                        unidad: {
                            select: {
                                numero: true
                            }
                        }
                    }
                },
                alumno: {
                    select: {
                        usuario: {
                            select: {
                                nombres: true,
                                apellidos: true
                            }
                        }
                    }
                }
            }
        });

        return res.json({ status: 'success', data: notasByActivity });
    } catch (error) {
        return res.status(500).json({ 
            status: 'error',
            message: `Error al obtener las notas de la actividad con ID: ${activityId}.`,
            error
        })
    }
}

//Get By StudentId
export const getNotasByStudent = async (req: Request, res: Response) => {
    const { studentId } = req.params;

    try {
        const studentNotas = await prisma.nota.findMany({
        where: { alumnoId: Number(studentId) },
        select: {
            notaId: true,
            valor: true,
            fechaRegistro: true,
            actividad: {
                select: {
                    actividadId: true,
                    nombre: true,
                    puntosMaximos: true,
                    unidad: { select: { numero: true } }
                }
            }
        }
        });

        return res.json({ status: 'success', data: studentNotas });
    } catch (error) {
        return res.status(500).json({ 
            status: 'error',
            message: `Error al obtener notas del alumno con ID: ${studentId}`,
            error
        });
    }
};

//Post registrar o actualizar una nota
export const upsertNota = async (req: Request, res: Response) => {
  const { actividadId, alumnoId, valor } = req.body;

  if (actividadId === undefined || alumnoId === undefined || valor === undefined) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios' });
  }

  try {
    const nota = await prisma.nota.upsert({
      where: {
        actividadId_alumnoId: {
          actividadId: Number(actividadId),
          alumnoId: Number(alumnoId)
        }
      },
      update: { valor: Number(valor) },
      create: {
        actividadId: Number(actividadId),
        alumnoId: Number(alumnoId),
        valor: Number(valor)
      }
    });

    return res.json({ status: 'success', data: nota });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al guardar la nota', error });
  }
};

//Post registrar o editar varias notas
export const bulkUpsertNotas = async (req: Request, res: Response) => {
  const { actividadId, notas } = req.body; // notas es un array: [{ alumnoId: 1, valor: 85 }, ...]

  if (!actividadId || !Array.isArray(notas)) {
    return res.status(400).json({ status: 'error', message: 'Se requiere actividadId y un arreglo de notas' });
  }

  try {
    const transacciones = notas.map((n) =>
      prisma.nota.upsert({
        where: {
          actividadId_alumnoId: {
            actividadId: Number(actividadId),
            alumnoId: Number(n.alumnoId)
          }
        },
        update: { valor: Number(n.valor) },
        create: {
          actividadId: Number(actividadId),
          alumnoId: Number(n.alumnoId),
          valor: Number(n.valor)
        }
      })
    );

    const resultados = await prisma.$transaction(transacciones);

    return res.json({ status: 'success', data: resultados });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al guardar el listado de notas', error });
  }
};
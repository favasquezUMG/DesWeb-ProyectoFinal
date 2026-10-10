import type { Response, Request } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { ROL, obtenerNombreRol, puedeOperarSede } from "../middlewares/role.middleware.js";
import { calcularNotasCursoSeccion, type ResultadoCursoSeccion } from "../services/notas.service.js";
import { encargadosDeAlumno, enviarADestinatarios, enviarEnSegundoPlano } from "../services/notificacion.service.js";
import { plantillaBoletaNotas } from "../templates/mail.templates.js";
import { puedeGestionarCursoSeccion, puedeVerAlumno } from "../services/acceso.service.js";

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
export const getNotasByStudent = async (req: AuthenticatedRequest, res: Response) => {
    const { studentId } = req.params;

    try {
        // Un padre sin permiso de ver notas (o con restriccion judicial) no las ve
        if (!(await puedeVerAlumno(req, Number(studentId), "notas", "notas"))) {
            return res.status(403).json({ status: "error", message: "No tiene permisos para ver las notas de este alumno." });
        }

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
                    tipo: true,
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

// Valida que la actividad exista, que quien guarda pueda gestionar su curso y que
// los alumnos pertenezcan a la seccion. Devuelve el error listo o el punteo de la actividad.
const validarCargaNotas = async (req: AuthenticatedRequest, actividadId: number, alumnoIds: number[]) => {
  const actividad = await prisma.actividad.findUnique({
    where: { actividadId },
    include: { unidad: { include: { cursoSeccion: { include: { seccion: { select: { sedeId: true } } } } } } },
  });
  if (!actividad) return { ok: false as const, codigo: 404, error: `No se encontró la actividad con ID: ${actividadId}.` };

  const cursoSeccion = actividad.unidad.cursoSeccion;
  if (!(await puedeGestionarCursoSeccion(req, cursoSeccion))) {
    return { ok: false as const, codigo: 403, error: 'No tiene permisos para registrar notas en este curso.' };
  }

  const ids = new Set(alumnoIds);
  const validos = await prisma.alumno.count({
    where: { alumnoId: { in: [...ids] }, seccionId: cursoSeccion.seccionId },
  });
  if (validos !== ids.size) {
    return { ok: false as const, codigo: 400, error: 'Hay alumnos que no pertenecen a la sección de este curso.' };
  }

  return { ok: true as const, puntosMaximos: Number(actividad.puntosMaximos) };
};

const esValorVacio = (valor: unknown) => valor === null || valor === '';

//Post registrar o actualizar una nota
export const upsertNota = async (req: AuthenticatedRequest, res: Response) => {
  const { actividadId, alumnoId, valor } = req.body;

  if (actividadId === undefined || alumnoId === undefined || valor === undefined) {
    return res.status(400).json({ status: 'error', message: 'Faltan campos obligatorios' });
  }

  try {
    const validacion = await validarCargaNotas(req, Number(actividadId), [Number(alumnoId)]);
    if (!validacion.ok) {
      return res.status(validacion.codigo).json({ status: 'error', message: validacion.error });
    }

    const num = Number(valor);
    if (isNaN(num) || num < 0 || num > validacion.puntosMaximos) {
      return res.status(400).json({ status: 'error', message: `La nota debe estar entre 0 y ${validacion.puntosMaximos}.` });
    }

    const nota = await prisma.nota.upsert({
      where: {
        actividadId_alumnoId: {
          actividadId: Number(actividadId),
          alumnoId: Number(alumnoId)
        }
      },
      update: { valor: num },
      create: {
        actividadId: Number(actividadId),
        alumnoId: Number(alumnoId),
        valor: num
      }
    });

    return res.json({ status: 'success', data: nota });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al guardar la nota', error });
  }
};

//Post registrar o editar varias notas de una actividad.
// Una nota con valor null o "" se borra (el catedratico limpio la casilla).
export const bulkUpsertNotas = async (req: AuthenticatedRequest, res: Response) => {
  const { actividadId, notas } = req.body; // notas es un array: [{ alumnoId: 1, valor: 85 }, ...]

  if (!actividadId || !Array.isArray(notas)) {
    return res.status(400).json({ status: 'error', message: 'Se requiere actividadId y un arreglo de notas' });
  }

  if (notas.some((n: any) => !n?.alumnoId || n.valor === undefined)) {
    return res.status(400).json({ status: 'error', message: 'Cada nota debe traer alumnoId y valor' });
  }

  try {
    const validacion = await validarCargaNotas(req, Number(actividadId), notas.map((n: any) => Number(n.alumnoId)));
    if (!validacion.ok) {
      return res.status(validacion.codigo).json({ status: 'error', message: validacion.error });
    }

    const { puntosMaximos } = validacion;
    const invalida = notas.some((n: any) => {
      if (esValorVacio(n.valor)) return false;
      const num = Number(n.valor);
      return isNaN(num) || num < 0 || num > puntosMaximos;
    });
    if (invalida) {
      return res.status(400).json({ status: 'error', message: `Las notas de esta actividad deben estar entre 0 y ${puntosMaximos}.` });
    }

    const transacciones = notas.map((n: any) =>
      esValorVacio(n.valor)
        ? prisma.nota.deleteMany({ where: { actividadId: Number(actividadId), alumnoId: Number(n.alumnoId) } })
        : prisma.nota.upsert({
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

    await prisma.$transaction(transacciones);

    return res.json({ status: 'success', message: 'Notas guardadas correctamente.' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al guardar el listado de notas', error });
  }
};

// GET /api/notas/curso-seccion/:cursoSeccionId
// Libreta del curso: unidades con sus actividades, alumnos de la seccion y las notas registradas
export const getLibretaCursoSeccion = async (req: AuthenticatedRequest, res: Response) => {
  const { cursoSeccionId } = req.params;

  try {
    const cursoSeccion = await prisma.cursoSeccion.findUnique({
      where: { cursoSeccionId: Number(cursoSeccionId) },
      include: {
        curso: true,
        seccion: { include: { grado: true } },
        unidades: {
          orderBy: { numero: 'asc' },
          include: { actividades: { orderBy: [{ fecha: 'asc' }, { actividadId: 'asc' }] } },
        },
      },
    });

    if (!cursoSeccion) {
      return res.status(404).json({ status: 'error', message: `Asignación curso-sección con ID: ${cursoSeccionId} no encontrada` });
    }

    if (!(await puedeGestionarCursoSeccion(req, cursoSeccion))) {
      return res.status(403).json({ status: 'error', message: 'No tiene permisos para ver la libreta de este curso.' });
    }

    const alumnos = await prisma.alumno.findMany({
      where: { seccionId: cursoSeccion.seccionId, usuario: { deletedAt: null } },
      select: { alumnoId: true, usuario: { select: { nombres: true, apellidos: true } } },
      orderBy: [{ usuario: { apellidos: 'asc' } }, { usuario: { nombres: 'asc' } }],
    });

    const notas = await prisma.nota.findMany({
      where: { actividad: { unidad: { cursoSeccionId: cursoSeccion.cursoSeccionId } } },
      select: { actividadId: true, alumnoId: true, valor: true },
    });

    return res.json({
      status: 'success',
      data: {
        cursoSeccionId: cursoSeccion.cursoSeccionId,
        curso: cursoSeccion.curso.nombre,
        grado: cursoSeccion.seccion.grado.nombre,
        seccion: cursoSeccion.seccion.nombre,
        unidades: cursoSeccion.unidades.map((u) => ({
          unidadId: u.unidadId,
          numero: u.numero,
          actividades: u.actividades.map((a) => ({
            actividadId: a.actividadId,
            nombre: a.nombre,
            puntosMaximos: Number(a.puntosMaximos),
            tipo: a.tipo,
            fecha: a.fecha ? a.fecha.toISOString().slice(0, 10) : null,
          })),
        })),
        alumnos: alumnos.map((a) => ({ alumnoId: a.alumnoId, nombres: a.usuario.nombres, apellidos: a.usuario.apellidos })),
        notas: notas.map((n) => ({ actividadId: n.actividadId, alumnoId: n.alumnoId, valor: Number(n.valor) })),
      },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al obtener la libreta del curso.', error });
  }
};

// POST /api/notas/enviar-encargados  { cursoSeccionId? , seccionId?, alumnoId? }
// Con cursoSeccionId envia solo las notas de ese curso (lo usa el catedratico).
// Con seccionId envia la boleta completa de la seccion (solo administradores).
// alumnoId limita el envio a un solo alumno.
export const enviarNotasAEncargados = async (req: AuthenticatedRequest, res: Response) => {
  const { cursoSeccionId, seccionId, alumnoId } = req.body;

  if (!cursoSeccionId && !seccionId) {
    return res.status(400).json({ status: 'error', message: 'Debe indicar cursoSeccionId o seccionId.' });
  }

  try {
    const rol = await obtenerNombreRol(req);
    let idsCursoSeccion: number[];

    if (cursoSeccionId) {
      const cursoSeccion = await prisma.cursoSeccion.findUnique({
        where: { cursoSeccionId: Number(cursoSeccionId) },
        include: { seccion: true },
      });
      if (!cursoSeccion) {
        return res.status(404).json({ status: 'error', message: `Asignación con ID: ${cursoSeccionId} no encontrada` });
      }
      if (rol === ROL.CATEDRATICO && cursoSeccion.catedraticoId !== Number(req.user?.id)) {
        return res.status(403).json({ status: 'error', message: 'Solo puede enviar las notas de sus propios cursos.' });
      }
      if (rol !== ROL.CATEDRATICO && !(await puedeOperarSede(req, cursoSeccion.seccion.sedeId))) {
        return res.status(403).json({ status: 'error', message: 'No puede enviar notas de otra sede.' });
      }
      idsCursoSeccion = [cursoSeccion.cursoSeccionId];
    } else {
      if (rol === ROL.CATEDRATICO) {
        return res.status(403).json({ status: 'error', message: 'El catedrático debe indicar el cursoSeccionId de su curso.' });
      }
      const seccion = await prisma.seccion.findUnique({ where: { seccionId: Number(seccionId) } });
      if (!seccion) {
        return res.status(404).json({ status: 'error', message: `Sección con ID: ${seccionId} no encontrada` });
      }
      if (!(await puedeOperarSede(req, seccion.sedeId))) {
        return res.status(403).json({ status: 'error', message: 'No puede enviar notas de otra sede.' });
      }
      const asignaciones = await prisma.cursoSeccion.findMany({
        where: { seccionId: seccion.seccionId },
        select: { cursoSeccionId: true },
      });
      idsCursoSeccion = asignaciones.map((a) => a.cursoSeccionId);
    }

    const cursos: ResultadoCursoSeccion[] = [];
    for (const id of idsCursoSeccion) {
      const resultado = await calcularNotasCursoSeccion(id);
      if (resultado) cursos.push(resultado);
    }

    if (cursos.length === 0) {
      return res.status(400).json({ status: 'error', message: 'La sección no tiene cursos asignados.' });
    }

    const { seccion } = cursos[0].cursoSeccion;
    const nombreSeccion = `${seccion.grado?.nombre ?? ''} "${seccion.nombre}"`;
    const alumnos = cursos[0].alumnos.filter((a) => !alumnoId || a.alumnoId === Number(alumnoId));

    // Se arma la boleta de cada alumno y se buscan sus encargados antes de responder,
    // para poder decir a cuantos se va a enviar; el envio en si corre en segundo plano.
    const envios = await Promise.all(
      alumnos.map(async (alumno) => ({
        alumno,
        encargados: await encargadosDeAlumno(alumno.alumnoId, "notas"),
        boleta: cursos.map((c) => {
          const fila = c.alumnos.find((a) => a.alumnoId === alumno.alumnoId);
          return { curso: c.cursoSeccion.curso.nombre, unidades: fila?.unidades ?? [], total: fila?.total ?? 0 };
        }),
      }))
    );

    const totalEncargados = envios.reduce((acc, e) => acc + e.encargados.length, 0);
    const sinEncargado = envios.filter((e) => e.encargados.length === 0).map((e) => e.alumno.nombre);

    if (totalEncargados === 0) {
      return res.status(400).json({ status: 'error', message: 'Ninguno de los alumnos tiene encargados registrados.' });
    }

    enviarEnSegundoPlano(`Boletas de notas ${nombreSeccion}`, async () => {
      let enviados = 0;
      let fallidos = 0;
      for (const { alumno, encargados, boleta } of envios) {
        const resultado = await enviarADestinatarios(
          encargados,
          (d) => ({
            ...plantillaBoletaNotas({ nombreDestinatario: d.nombre, nombreAlumno: alumno.nombre, seccion: nombreSeccion, cursos: boleta }),
            mensaje: `Se enviaron las calificaciones de ${alumno.nombre} (${nombreSeccion}).`,
          }),
          'Notas'
        );
        enviados += resultado.enviados;
        fallidos += resultado.fallidos;
      }
      return { enviados, fallidos };
    });

    return res.json({
      status: 'success',
      message: `Enviando las notas de ${envios.length} alumno(s) a ${totalEncargados} encargado(s).`,
      data: { alumnos: envios.length, encargados: totalEncargados, alumnosSinEncargado: sinEncargado },
    });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: 'Error al enviar las notas a los encargados.', error });
  }
};

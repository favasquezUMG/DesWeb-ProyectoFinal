import { prisma } from "../lib/prisma.js";
import { formatFecha } from "../lib/fechas.js";
import { formatHora } from "../lib/horas.js";

// Información del día a día del alumno que comparten su portal y la vista del encargado.

// Clases de la sección actual del alumno, por día y hora
export const clasesDeAlumno = async (alumnoId: number) => {
    const alumno = await prisma.alumno.findUnique({ where: { alumnoId }, select: { seccionId: true } });
    if (!alumno) return null;

    const horarios = await prisma.horario.findMany({
        where: { cursoSeccion: { seccionId: alumno.seccionId } },
        include: {
            cursoSeccion: {
                include: {
                    curso: { select: { nombre: true } },
                    catedratico: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
                },
            },
        },
        orderBy: [{ diaSemana: "asc" }, { horaInicio: "asc" }],
    });

    return horarios.map((h) => ({
        horarioId: h.horarioId,
        cursoSeccionId: h.cursoSeccionId,
        diaSemana: h.diaSemana,
        horaInicio: formatHora(h.horaInicio),
        horaFin: formatHora(h.horaFin),
        curso: h.cursoSeccion.curso.nombre,
        catedratico: `${h.cursoSeccion.catedratico.usuario.nombres} ${h.cursoSeccion.catedratico.usuario.apellidos}`,
    }));
};

// Resumen de asistencia y días con tarde, ausencia o justificación (del más reciente al más antiguo)
export const asistenciaDeAlumno = async (alumnoId: number) => {
    const asistencias = await prisma.asistencia.findMany({
        where: { alumnoId },
        include: { cursoSeccion: { select: { curso: { select: { nombre: true } } } } },
        orderBy: { fecha: "desc" },
    });

    const cuenta = (estado: string) => asistencias.filter((a) => a.estado === estado).length;
    const resumen = {
        presentes: cuenta("Presente"),
        tardes: cuenta("Tarde"),
        ausentes: cuenta("Ausente"),
        justificados: cuenta("Justificado"),
        total: asistencias.length,
        porcentaje: 100,
    };
    const computables = resumen.total - resumen.justificados;
    if (computables > 0) {
        resumen.porcentaje = Number((((resumen.presentes + resumen.tardes) / computables) * 100).toFixed(2));
    }

    const dias = new Map<string, { curso: string; estado: string }[]>();
    for (const a of asistencias) {
        if (a.estado === "Presente") continue;
        const k = formatFecha(a.fecha);
        dias.set(k, [...(dias.get(k) ?? []), { curso: a.cursoSeccion.curso.nombre, estado: a.estado }]);
    }

    return { resumen, dias: [...dias.entries()].map(([fecha, clases]) => ({ fecha, clases })) };
};

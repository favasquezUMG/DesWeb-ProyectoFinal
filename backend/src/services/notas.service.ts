import { prisma } from "../lib/prisma.js";

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

// Cada unidad vale 100 puntos (zona + examen) y la nota final es el promedio de las unidades.
// Por unidad se devuelve la zona, el examen y la nota (suma de ambos); total es el promedio.
export const calcularNotasCursoSeccion = async (cursoSeccionId: number) => {
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
            let zona = 0;
            let examen = 0;
            for (const actividad of unidad.actividades) {
                const notaAlumno = actividad.notas.find((n) => n.alumnoId === alumno.alumnoId);
                if (!notaAlumno) continue;
                if (actividad.tipo === "Examen") examen += Number(notaAlumno.valor);
                else zona += Number(notaAlumno.valor);
            }
            return { numero: unidad.numero, zona, examen, nota: zona + examen };
        });

        const total = unidades.length ? unidades.reduce((acc, u) => acc + u.nota, 0) / unidades.length : 0;

        return {
            alumnoId: alumno.alumnoId,
            nombre: `${alumno.usuario.nombres} ${alumno.usuario.apellidos}`,
            unidades,
            total,
        };
    });

    return { cursoSeccion, alumnos: filas };
};

export type ResultadoCursoSeccion = NonNullable<Awaited<ReturnType<typeof calcularNotasCursoSeccion>>>;

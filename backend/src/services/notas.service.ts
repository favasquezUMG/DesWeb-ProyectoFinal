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

// Suma de los punteos por unidad y total de cada alumno de la seccion en un curso
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

export type ResultadoCursoSeccion = NonNullable<Awaited<ReturnType<typeof calcularNotasCursoSeccion>>>;

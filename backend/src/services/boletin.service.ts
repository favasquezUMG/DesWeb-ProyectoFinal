import { prisma } from "../lib/prisma.js";

// Boletín del ciclo actual de un alumno (lo ven el encargado y el propio alumno).
// Cada unidad vale 100 puntos (zona + examen); una unidad sin notas registradas queda en null
// y el promedio se calcula solo con las unidades ya evaluadas.

export const NOTA_APROBACION = 61;
const UNIDADES_CICLO = 4;

const redondear = (n: number) => Math.round(n * 100) / 100;
const promedio = (valores: number[]) => (valores.length ? redondear(valores.reduce((a, b) => a + b, 0) / valores.length) : null);
const nombreCompleto = (u: { nombres: string; apellidos: string }) => `${u.nombres} ${u.apellidos}`;

export const construirBoletin = async (alumnoId: number) => {
    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId },
        include: {
            usuario: { select: { nombres: true, apellidos: true } },
            seccion: { include: { grado: true, sede: { select: { nombre: true } } } },
        },
    });
    if (!alumno) return null;

    // Si lo trasladaron de sección en este ciclo, sus notas quedaron en los cursos de la
    // sección anterior: se incluyen marcados para que no "desaparezcan" del boletín
    const cursos = await prisma.cursoSeccion.findMany({
        where: {
            OR: [
                { seccionId: alumno.seccionId },
                {
                    seccionId: { not: alumno.seccionId },
                    seccion: { anioLectivo: alumno.seccion.anioLectivo },
                    unidades: { some: { actividades: { some: { notas: { some: { alumnoId } } } } } },
                },
            ],
        },
        include: {
            curso: { select: { nombre: true } },
            seccion: { select: { nombre: true, grado: { select: { nombre: true } } } },
            catedratico: { include: { usuario: { select: { nombres: true, apellidos: true } } } },
            unidades: {
                orderBy: { numero: "asc" },
                include: { actividades: { include: { notas: { where: { alumnoId } } } } },
            },
        },
        orderBy: { curso: { nombre: "asc" } },
    });

    const filas = cursos.map((cs) => {
        const unidades = Array.from({ length: UNIDADES_CICLO }, (_, i) => {
            const unidad = cs.unidades.find((u) => u.numero === i + 1);
            let zona = 0;
            let examen = 0;
            let calificadas = 0;
            for (const actividad of unidad?.actividades ?? []) {
                const nota = actividad.notas[0];
                if (!nota) continue;
                calificadas++;
                if (actividad.tipo === "Examen") examen += Number(nota.valor);
                else zona += Number(nota.valor);
            }
            return {
                numero: i + 1,
                zona: calificadas ? zona : null,
                examen: calificadas ? examen : null,
                nota: calificadas ? redondear(zona + examen) : null,
            };
        });

        const prom = promedio(unidades.filter((u) => u.nota !== null).map((u) => u.nota as number));

        return {
            cursoSeccionId: cs.cursoSeccionId,
            curso: cs.curso.nombre,
            catedratico: nombreCompleto(cs.catedratico.usuario),
            /** null = sección actual; si no, la sección de la que fue trasladado */
            seccionAnterior: cs.seccionId === alumno.seccionId ? null : `${cs.seccion.grado.nombre} ${cs.seccion.nombre}`,
            unidades,
            promedio: prom,
            aprobado: prom === null ? null : prom >= NOTA_APROBACION,
        };
    });

    // Los totales cuentan solo la sección actual (un curso trasladado no se cuenta dos veces)
    const actuales = filas.filter((f) => !f.seccionAnterior);
    const conPromedio = actuales.filter((f) => f.promedio !== null).map((f) => f.promedio as number);

    return {
        alumnoId,
        nombre: nombreCompleto(alumno.usuario),
        grado: alumno.seccion.grado.nombre,
        seccion: alumno.seccion.nombre,
        sede: alumno.seccion.sede.nombre,
        anioLectivo: alumno.seccion.anioLectivo,
        notaAprobacion: NOTA_APROBACION,
        promedioGeneral: promedio(conPromedio),
        cursosAprobados: actuales.filter((f) => f.aprobado === true).length,
        cursosEvaluados: conPromedio.length,
        // Primero los cursos de la sección actual
        cursos: [...actuales, ...filas.filter((f) => f.seccionAnterior)],
    };
};

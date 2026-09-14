import { prisma } from './prisma.js';
import { formatHora, DIAS_SEMANA } from './horas.js';

export interface RangoHorario {
    diaSemana: number;
    horaInicio: Date;
    horaFin: Date;
}

export interface Choque {
    tipo: 'catedratico' | 'seccion';
    mensaje: string;
}

/**
 * Dos rangos se traslapan si: nuevo.inicio < existente.fin Y nuevo.fin > existente.inicio.
 * Se usa < y > (no <= ni >=) a propósito, para que un curso que termina a las
 * 08:00 y otro que empieza a las 08:00 NO se consideren choque.
 */
const filtroTraslape = (rango: RangoHorario) => ({
    diaSemana: rango.diaSemana,
    horaInicio: { lt: rango.horaFin },
    horaFin: { gt: rango.horaInicio },
});

/**
 * Regla de negocio DERCAS:
 * "Un catedrático no puede tener dos asignaciones curso-sección con horario
 *  traslapado, dentro de su sede."
 *
 * Se valida además que la sección no tenga dos cursos distintos a la misma
 * hora, porque los alumnos de una sección no pueden estar en dos aulas a la vez.
 *
 * @param cursoSeccionId  Asignación a la que se le quiere poner el horario.
 * @param rango           Día y horas propuestas.
 * @param excluirHorarioId ID a ignorar al comparar (necesario al editar un horario).
 * @returns null si no hay choque, o el detalle del primero encontrado.
 */
export const detectarChoque = async (
    cursoSeccionId: number,
    rango: RangoHorario,
    excluirHorarioId?: number,
): Promise<Choque | null> => {
    const cursoSeccion = await prisma.cursoSeccion.findUnique({
        where: { cursoSeccionId },
        include: { seccion: true },
    });

    if (!cursoSeccion) return null;

    const excluir = excluirHorarioId ? { horarioId: { not: excluirHorarioId } } : {};
    const dia = DIAS_SEMANA[rango.diaSemana] ?? `día ${rango.diaSemana}`;
    const franja = `${formatHora(rango.horaInicio)} - ${formatHora(rango.horaFin)}`;

    // 1. Choque del catedrático, restringido a su misma sede
    const choqueCatedratico = await prisma.horario.findFirst({
        where: {
            ...filtroTraslape(rango),
            ...excluir,
            cursoSeccion: {
                catedraticoId: cursoSeccion.catedraticoId,
                seccion: { sedeId: cursoSeccion.seccion.sedeId },
            },
        },
        include: {
            cursoSeccion: {
                include: {
                    curso: true,
                    seccion: { include: { grado: true } },
                },
            },
        },
    });

    if (choqueCatedratico) {
        const ocupado = choqueCatedratico.cursoSeccion;
        return {
            tipo: 'catedratico',
            mensaje:
                `El catedrático ya imparte ${ocupado.curso.nombre} ` +
                `(${ocupado.seccion.grado.nombre} sección ${ocupado.seccion.nombre}) ` +
                `el ${dia} de ${formatHora(choqueCatedratico.horaInicio)} a ${formatHora(choqueCatedratico.horaFin)}. ` +
                `No se puede asignar la franja ${franja}.`,
        };
    }

    // 2. Choque de la sección: dos cursos distintos a la misma hora
    const choqueSeccion = await prisma.horario.findFirst({
        where: {
            ...filtroTraslape(rango),
            ...excluir,
            cursoSeccion: {
                seccionId: cursoSeccion.seccionId,
                cursoSeccionId: { not: cursoSeccionId },
            },
        },
        include: { cursoSeccion: { include: { curso: true } } },
    });

    if (choqueSeccion) {
        return {
            tipo: 'seccion',
            mensaje:
                `La sección ya tiene el curso ${choqueSeccion.cursoSeccion.curso.nombre} ` +
                `el ${dia} de ${formatHora(choqueSeccion.horaInicio)} a ${formatHora(choqueSeccion.horaFin)}. ` +
                `No se puede asignar la franja ${franja}.`,
        };
    }

    return null;
};
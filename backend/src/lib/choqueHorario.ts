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

const filtroTraslape = (rango: RangoHorario) => ({
    diaSemana: rango.diaSemana,
    horaInicio: { lt: rango.horaFin },
    horaFin: { gt: rango.horaInicio },
});

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
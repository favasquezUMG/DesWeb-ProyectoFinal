import type { ProgramaBeca } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { hoyUTC } from "../lib/fechas.js";
import { filtroVinculo } from "./vinculos.service.js";
import { COLEGIATURA_MENSUAL } from "../config/stripe.config.js";
import { encargadosDeAlumno, enviarADestinatarios, enviarEnSegundoPlano } from "./notificacion.service.js";
import { plantillaBeca } from "../templates/mail.templates.js";

export const ESTADO_BECA = {
    SOLICITADA: "Solicitada",
    ACTIVA: "Activa",
    RECHAZADA: "Rechazada",
    SUSPENDIDA: "Suspendida",
    REVOCADA: "Revocada",
    FINALIZADA: "Finalizada",
} as const;

export type EstadoBeca = (typeof ESTADO_BECA)[keyof typeof ESTADO_BECA];

export const ESTADOS_BECA = Object.values(ESTADO_BECA);

// Una beca Activa o Suspendida sigue ocupando su cupo e impide asignarle otra al alumno
export const ESTADOS_VIGENTES: EstadoBeca[] = [ESTADO_BECA.ACTIVA, ESTADO_BECA.SUSPENDIDA];

export const TIPOS_PROGRAMA = ["Merito", "Socioeconomica", "Deportiva", "Convenio", "Otro"];

// Cambios de estado permitidos. Rechazada, Revocada y Finalizada son definitivos.
const TRANSICIONES: Record<EstadoBeca, EstadoBeca[]> = {
    Solicitada: [ESTADO_BECA.ACTIVA, ESTADO_BECA.RECHAZADA],
    Activa: [ESTADO_BECA.SUSPENDIDA, ESTADO_BECA.REVOCADA, ESTADO_BECA.FINALIZADA],
    Suspendida: [ESTADO_BECA.ACTIVA, ESTADO_BECA.REVOCADA],
    Rechazada: [],
    Revocada: [],
    Finalizada: [],
};

// Error de regla de negocio: el controlador lo convierte en una respuesta 4xx con su mensaje
export class ReglaBecaError extends Error {
    constructor(message: string, public status = 409) {
        super(message);
    }
}

const redondear = (n: number) => Number(n.toFixed(2));

export const inicioDeCiclo = (anio: number) => new Date(Date.UTC(anio, 0, 1));
export const finDeCiclo = (anio: number) => new Date(Date.UTC(anio, 11, 31));

export { hoyUTC };

export const montoMensualDeBeca = (porcentaje: number) => redondear((COLEGIATURA_MENSUAL * porcentaje) / 100);

// ---------------------------------------------------------------------------
// Consultas de apoyo
// ---------------------------------------------------------------------------

export interface Politica {
    presupuestoMensual: number | null;
    descuentoHermanos: number;
    descuentoMaximo: number;
    configurada: boolean;
}

export const obtenerPolitica = async (sedeId: number, anioLectivo: number): Promise<Politica> => {
    const politica = await prisma.politicaBeca.findUnique({
        where: { sedeId_anioLectivo: { sedeId, anioLectivo } },
    });

    return {
        presupuestoMensual: politica?.presupuestoMensual != null ? Number(politica.presupuestoMensual) : null,
        descuentoHermanos: politica ? Number(politica.descuentoHermanos) : 0,
        descuentoMaximo: politica ? Number(politica.descuentoMaximo) : 100,
        configurada: politica !== null,
    };
};

export const cuposUsados = (programaId: number, excluirBecaId?: number) =>
    prisma.beca.count({
        where: {
            programaId,
            estado: { in: ESTADOS_VIGENTES },
            ...(excluirBecaId ? { becaId: { not: excluirBecaId } } : {}),
        },
    });

// Lo que la sede deja de cobrar al mes por las becas activas (sin contar descuento por hermanos)
// sedeId null = todas las sedes
export const presupuestoUsado = async (sedeId: number | null, anioLectivo: number, excluirBecaId?: number) => {
    const becas = await prisma.beca.findMany({
        where: {
            anioLectivo,
            estado: ESTADO_BECA.ACTIVA,
            ...(sedeId ? { alumno: { seccion: { sedeId } } } : {}),
            ...(excluirBecaId ? { becaId: { not: excluirBecaId } } : {}),
        },
        select: { porcentaje: true },
    });
    return redondear(becas.reduce((suma, b) => suma + montoMensualDeBeca(Number(b.porcentaje)), 0));
};

// Promedio del alumno hasta la fecha (0-100). Por curso se divide lo obtenido entre los
// puntos de las actividades ya calificadas, asi no se castiga a mitad de ciclo por las
// unidades que aun no se han evaluado. null = todavia no tiene notas.
export const promedioAlumno = async (alumnoId: number): Promise<number | null> => {
    const alumno = await prisma.alumno.findUnique({ where: { alumnoId }, select: { seccionId: true } });
    if (!alumno) return null;

    const cursos = await prisma.cursoSeccion.findMany({
        where: { seccionId: alumno.seccionId },
        select: {
            unidades: {
                select: {
                    actividades: {
                        select: { puntosMaximos: true, notas: { select: { alumnoId: true, valor: true } } },
                    },
                },
            },
        },
    });

    const porCurso: number[] = [];
    for (const curso of cursos) {
        let obtenido = 0;
        let posible = 0;
        for (const unidad of curso.unidades) {
            for (const actividad of unidad.actividades) {
                if (actividad.notas.length === 0) continue; // actividad aun sin calificar
                posible += Number(actividad.puntosMaximos);
                const nota = actividad.notas.find((n) => n.alumnoId === alumnoId);
                obtenido += nota ? Number(nota.valor) : 0;
            }
        }
        if (posible > 0) porCurso.push((obtenido / posible) * 100);
    }

    if (porCurso.length === 0) return null;
    return redondear(porCurso.reduce((a, b) => a + b, 0) / porCurso.length);
};

const tieneConductaGrave = async (alumnoId: number, desde: Date) =>
    (await prisma.reporteConducta.count({ where: { alumnoId, tipo: "Grave", fecha: { gte: desde } } })) > 0;

// ---------------------------------------------------------------------------
// Validaciones
// ---------------------------------------------------------------------------

export const validarPorcentaje = (valor: unknown): number => {
    const porcentaje = Number(valor);
    if (isNaN(porcentaje) || porcentaje <= 0 || porcentaje > 100) {
        throw new ReglaBecaError("El porcentaje debe ser mayor que 0 y como máximo 100.", 400);
    }
    return porcentaje;
};

// Revisa que una beca pueda quedar Activa: programa vigente, un solo beneficio por alumno,
// cupos, requisitos academicos y de conducta, y presupuesto de la sede.
export const validarActivacion = async (datos: {
    alumnoId: number;
    programa: ProgramaBeca | null;
    porcentaje: number;
    anioLectivo: number;
    excluirBecaId?: number;
}) => {
    const { alumnoId, programa, porcentaje, anioLectivo, excluirBecaId } = datos;

    const alumno = await prisma.alumno.findUnique({
        where: { alumnoId },
        include: { seccion: true, usuario: { select: { deletedAt: true } } },
    });
    if (!alumno || alumno.usuario.deletedAt) {
        throw new ReglaBecaError(`Alumno con ID: ${alumnoId} no encontrado.`, 404);
    }
    const sedeId = alumno.seccion.sedeId;

    if (programa) {
        if (!programa.activo) throw new ReglaBecaError(`El programa "${programa.nombre}" está cerrado.`);
        if (programa.anioLectivo !== anioLectivo) {
            throw new ReglaBecaError(`El programa "${programa.nombre}" es del ciclo ${programa.anioLectivo}.`);
        }
        if (programa.sedeId !== sedeId) {
            throw new ReglaBecaError("El programa pertenece a otra sede distinta a la del alumno.");
        }
    }

    const otraVigente = await prisma.beca.findFirst({
        where: {
            alumnoId,
            anioLectivo,
            estado: { in: ESTADOS_VIGENTES },
            ...(excluirBecaId ? { becaId: { not: excluirBecaId } } : {}),
        },
        include: { programa: { select: { nombre: true } } },
    });
    if (otraVigente) {
        throw new ReglaBecaError(
            `El alumno ya tiene una beca ${otraVigente.estado.toLowerCase()} en el ciclo ${anioLectivo}` +
                (otraVigente.programa ? ` (${otraVigente.programa.nombre})` : "") +
                ". Las becas no son acumulables: revoque la anterior primero.",
        );
    }

    if (programa?.cupos != null) {
        const usados = await cuposUsados(programa.programaId, excluirBecaId);
        if (usados >= programa.cupos) {
            throw new ReglaBecaError(`El programa "${programa.nombre}" ya no tiene cupos (${usados}/${programa.cupos}).`);
        }
    }

    if (programa?.promedioMinimo != null) {
        const minimo = Number(programa.promedioMinimo);
        const promedio = await promedioAlumno(alumnoId);
        if (promedio !== null && promedio < minimo) {
            throw new ReglaBecaError(`El alumno tiene promedio ${promedio} y el programa exige al menos ${minimo}.`);
        }
    }

    if (programa?.pierdePorConductaGrave && (await tieneConductaGrave(alumnoId, inicioDeCiclo(anioLectivo)))) {
        throw new ReglaBecaError("El alumno tiene un reporte de conducta grave en este ciclo y el programa no lo permite.");
    }

    await validarPresupuesto(sedeId, anioLectivo, porcentaje, excluirBecaId);
};

export const validarPresupuesto = async (sedeId: number, anioLectivo: number, porcentaje: number, excluirBecaId?: number) => {
    const politica = await obtenerPolitica(sedeId, anioLectivo);
    if (politica.presupuestoMensual === null) return;

    const usado = await presupuestoUsado(sedeId, anioLectivo, excluirBecaId);
    const nuevo = montoMensualDeBeca(porcentaje);
    if (usado + nuevo > politica.presupuestoMensual) {
        const disponible = redondear(Math.max(politica.presupuestoMensual - usado, 0));
        throw new ReglaBecaError(
            `La beca representa Q${nuevo.toFixed(2)} al mes y solo quedan Q${disponible.toFixed(2)} del presupuesto mensual de becas de la sede.`,
        );
    }
};

// ---------------------------------------------------------------------------
// Cambios de estado
// ---------------------------------------------------------------------------

export const registrarHistorial = (
    becaId: number,
    estadoAnterior: string | null,
    estadoNuevo: string,
    motivo: string,
    usuarioId: number | null,
) =>
    prisma.becaHistorial.create({
        data: { becaId, estadoAnterior, estadoNuevo, motivo: motivo.slice(0, 500), usuarioId },
    });

export const cambiarEstado = async (becaId: number, nuevoEstado: string, motivo: string, usuarioId: number | null) => {
    const beca = await prisma.beca.findUnique({ where: { becaId }, include: { programa: true } });
    if (!beca) throw new ReglaBecaError(`Beca con ID: ${becaId} no encontrada.`, 404);

    if (!ESTADOS_BECA.includes(nuevoEstado as EstadoBeca)) {
        throw new ReglaBecaError(`Estado no válido. Use uno de: ${ESTADOS_BECA.join(", ")}.`, 400);
    }

    const permitidos = TRANSICIONES[beca.estado as EstadoBeca] ?? [];
    if (!permitidos.includes(nuevoEstado as EstadoBeca)) {
        throw new ReglaBecaError(
            permitidos.length === 0
                ? `La beca está ${beca.estado.toLowerCase()} y ya no se puede modificar.`
                : `Una beca ${beca.estado.toLowerCase()} solo puede pasar a: ${permitidos.join(", ")}.`,
        );
    }

    if (nuevoEstado === ESTADO_BECA.ACTIVA) {
        if (beca.fechaFin < hoyUTC()) {
            throw new ReglaBecaError("La vigencia de esta beca ya terminó; renuévela para el nuevo ciclo.");
        }
        await validarActivacion({
            alumnoId: beca.alumnoId,
            programa: beca.programa,
            porcentaje: Number(beca.porcentaje),
            anioLectivo: beca.anioLectivo,
            excluirBecaId: beca.becaId,
        });
    }

    // Una solicitud aprobada empieza a aplicar desde el dia de la aprobacion
    const inicioPorAprobacion =
        beca.estado === ESTADO_BECA.SOLICITADA && nuevoEstado === ESTADO_BECA.ACTIVA
            ? new Date(Math.max(hoyUTC().getTime(), inicioDeCiclo(beca.anioLectivo).getTime()))
            : undefined;

    const [actualizada] = await prisma.$transaction([
        prisma.beca.update({
            where: { becaId },
            data: { estado: nuevoEstado, ...(inicioPorAprobacion ? { fechaInicio: inicioPorAprobacion } : {}) },
        }),
        prisma.becaHistorial.create({
            data: { becaId, estadoAnterior: beca.estado, estadoNuevo: nuevoEstado, motivo: motivo.slice(0, 500), usuarioId },
        }),
    ]);

    return { anterior: beca.estado, beca: actualizada };
};

// Cierra las becas cuyo ciclo ya termino y las solicitudes que nadie resolvio a tiempo
export const finalizarVencidas = async () => {
    const hoy = hoyUTC();
    const vencidas = await prisma.beca.findMany({
        where: {
            fechaFin: { lt: hoy },
            estado: { in: [...ESTADOS_VIGENTES, ESTADO_BECA.SOLICITADA] },
        },
        select: { becaId: true, estado: true },
    });

    for (const beca of vencidas) {
        const nuevo = beca.estado === ESTADO_BECA.SOLICITADA ? ESTADO_BECA.RECHAZADA : ESTADO_BECA.FINALIZADA;
        const motivo =
            nuevo === ESTADO_BECA.RECHAZADA
                ? "La solicitud venció sin resolverse dentro del ciclo."
                : "Terminó la vigencia de la beca.";
        await prisma.$transaction([
            prisma.beca.update({ where: { becaId: beca.becaId }, data: { estado: nuevo } }),
            prisma.becaHistorial.create({
                data: { becaId: beca.becaId, estadoAnterior: beca.estado, estadoNuevo: nuevo, motivo },
            }),
        ]);
    }

    return vencidas.length;
};

// ---------------------------------------------------------------------------
// Requisitos para mantener la beca
// ---------------------------------------------------------------------------

export interface ResultadoEvaluacion {
    becaId: number;
    alumno: string;
    programa: string;
    motivo: string;
}

// Revisa las becas activas de la sede (o de todas) y suspende las que ya no cumplen
export const evaluarRequisitos = async (sedeId: number | null, anioLectivo: number, usuarioId: number | null) => {
    await finalizarVencidas();

    const becas = await prisma.beca.findMany({
        where: {
            anioLectivo,
            estado: ESTADO_BECA.ACTIVA,
            programaId: { not: null },
            ...(sedeId ? { alumno: { seccion: { sedeId } } } : {}),
        },
        include: { programa: true, alumno: { include: { usuario: { select: { nombres: true, apellidos: true } } } } },
    });

    const suspendidas: ResultadoEvaluacion[] = [];

    for (const beca of becas) {
        const programa = beca.programa!;
        let motivo: string | null = null;

        if (programa.promedioMinimo != null) {
            const minimo = Number(programa.promedioMinimo);
            const promedio = await promedioAlumno(beca.alumnoId);
            if (promedio !== null && promedio < minimo) {
                motivo = `Promedio de ${promedio}, por debajo del mínimo de ${minimo} que exige el programa.`;
            }
        }

        if (!motivo && programa.pierdePorConductaGrave && (await tieneConductaGrave(beca.alumnoId, beca.fechaInicio))) {
            motivo = "Tiene un reporte de conducta grave desde que se otorgó la beca.";
        }

        if (!motivo) continue;

        await cambiarEstado(beca.becaId, ESTADO_BECA.SUSPENDIDA, motivo, usuarioId);
        const alumno = `${beca.alumno.usuario.nombres} ${beca.alumno.usuario.apellidos}`;
        suspendidas.push({ becaId: beca.becaId, alumno, programa: programa.nombre, motivo });
        notificarEncargados(beca.alumnoId, "Beca suspendida", `La beca "${programa.nombre}" de ${alumno} fue suspendida. Motivo: ${motivo}`);
    }

    return { revisadas: becas.length, suspendidas };
};

// Se llama al registrar un reporte de conducta Grave
export const suspenderPorConductaGrave = async (alumnoId: number, tituloReporte: string, usuarioId: number | null) => {
    const becas = await prisma.beca.findMany({
        where: { alumnoId, estado: ESTADO_BECA.ACTIVA, programa: { pierdePorConductaGrave: true } },
        include: { programa: true },
    });

    for (const beca of becas) {
        const motivo = `Reporte de conducta grave: ${tituloReporte}`;
        await cambiarEstado(beca.becaId, ESTADO_BECA.SUSPENDIDA, motivo, usuarioId);
        notificarEncargados(alumnoId, "Beca suspendida", `La beca "${beca.programa!.nombre}" fue suspendida.\nMotivo: ${motivo}`);
    }

    return becas.length;
};

// ---------------------------------------------------------------------------
// Descuento que se aplica al cobrar la colegiatura
// ---------------------------------------------------------------------------

export interface DescuentoColegiatura {
    beca: number;
    hermanos: number;
    total: number;
    programa: string | null;
    topeAplicado: boolean;
}

// El 2do hijo en adelante del mismo responsable de pagos recibe el descuento por hermanos
// de la sede; el hijo mayor paga completo. Se usa el responsable de pagos (no cualquier
// encargado) para que, por ejemplo, con padres divorciados no se mezclen los hijos de
// distintos hogares.
const aplicaDescuentoHermanos = async (alumnoId: number): Promise<boolean> => {
    const vinculos = await prisma.alumnoEncargado.findMany({
        where: { alumnoId, responsableFinanciero: true, ...filtroVinculo() },
        select: { encargadoId: true },
    });
    if (vinculos.length === 0) return false;

    const hermanos = await prisma.alumno.findMany({
        where: {
            usuario: { deletedAt: null },
            encargados: {
                some: { encargadoId: { in: vinculos.map((v) => v.encargadoId) }, responsableFinanciero: true, ...filtroVinculo() },
            },
        },
        select: { alumnoId: true, fechaNacimiento: true },
    });
    if (hermanos.length < 2) return false;

    hermanos.sort((a, b) => {
        const fa = a.fechaNacimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const fb = b.fechaNacimiento?.getTime() ?? Number.MAX_SAFE_INTEGER;
        return fa - fb || a.alumnoId - b.alumnoId;
    });
    return hermanos[0].alumnoId !== alumnoId;
};

export const descuentoColegiatura = async (alumnoId: number, fecha: Date): Promise<DescuentoColegiatura> => {
    const beca = await prisma.beca.findFirst({
        where: {
            alumnoId,
            estado: ESTADO_BECA.ACTIVA,
            fechaInicio: { lte: fecha },
            fechaFin: { gte: fecha },
        },
        include: { programa: { select: { nombre: true } } },
    });

    const alumno = await prisma.alumno.findUnique({ where: { alumnoId }, include: { seccion: true } });
    const politica = alumno
        ? await obtenerPolitica(alumno.seccion.sedeId, fecha.getUTCFullYear())
        : { descuentoHermanos: 0, descuentoMaximo: 100 };

    const porcentajeBeca = beca ? Number(beca.porcentaje) : 0;
    const porcentajeHermanos =
        politica.descuentoHermanos > 0 && (await aplicaDescuentoHermanos(alumnoId)) ? politica.descuentoHermanos : 0;

    // El tope limita la combinacion, pero nunca reduce una beca por debajo de lo otorgado
    const suma = porcentajeBeca + porcentajeHermanos;
    const tope = Math.max(politica.descuentoMaximo, porcentajeBeca);
    const total = Math.min(suma, tope, 100);

    return {
        beca: porcentajeBeca,
        hermanos: porcentajeHermanos,
        total,
        programa: beca?.programa?.nombre ?? beca?.descripcion ?? null,
        topeAplicado: total < suma,
    };
};

// ---------------------------------------------------------------------------
// Avisos
// ---------------------------------------------------------------------------

// Avisa a los encargados del alumno (correo + notificacion en el sistema) sin bloquear la respuesta
export const notificarEncargados = (alumnoId: number, titulo: string, mensaje: string) => {
    enviarEnSegundoPlano(`Aviso de beca (${titulo})`, async () => {
        const encargados = await encargadosDeAlumno(alumnoId, "pagos");
        return enviarADestinatarios(
            encargados,
            (d) => ({ ...plantillaBeca({ nombreDestinatario: d.nombre, titulo, mensaje }), mensaje }),
            "Beca",
        );
    });
};

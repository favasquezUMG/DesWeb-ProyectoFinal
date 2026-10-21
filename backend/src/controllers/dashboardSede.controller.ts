import type { Response } from "express";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { sedeDelAlcance } from "../middlewares/role.middleware.js";
import { NOTA_APROBACION } from "../services/boletin.service.js";
import { filtroVinculo } from "../services/vinculos.service.js";
import { hoyUTC } from "../lib/fechas.js";

// Meses de colegiatura del ciclo (enero a octubre), igual que el estado de cuenta
const MESES_COLEGIATURA = 10;

const promedio = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

// GET /api/sedes/dashboard?sedeId=N — métricas reales de la sede del usuario (o la elegida
// por el administrador general; sin sedeId, todas las sedes)
export const getDashboardSede = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const alcance = await sedeDelAlcance(req);
        const sedeId = alcance ?? (req.query.sedeId ? Number(req.query.sedeId) : undefined);
        const filtroSede = sedeId !== undefined ? { sedeId } : {};

        // Ciclo: el año actual, o el último que tenga secciones
        const anioActual = new Date().getFullYear();
        const ultimo = await prisma.seccion.findFirst({
            where: { deletedAt: null, ...filtroSede, anioLectivo: { lte: anioActual } },
            orderBy: { anioLectivo: "desc" },
            select: { anioLectivo: true },
        });
        const anioLectivo = ultimo?.anioLectivo ?? anioActual;

        const [sede, alumnos] = await Promise.all([
            sedeId !== undefined ? prisma.sede.findUnique({ where: { sedeId }, select: { nombre: true } }) : null,
            prisma.alumno.findMany({
                where: { usuario: { deletedAt: null }, seccion: { ...filtroSede, anioLectivo, deletedAt: null } },
                select: {
                    alumnoId: true,
                    usuario: { select: { nombres: true, apellidos: true } },
                    seccion: { select: { nombre: true, grado: { select: { gradoId: true, nombre: true, orden: true } } } },
                    encargados: { where: filtroVinculo(), select: { encargadoId: true } },
                    becas: { where: { estado: "Activa", anioLectivo }, select: { porcentaje: true } },
                },
            }),
        ]);
        const ids = alumnos.map((a) => a.alumnoId);

        const [notas, pagos, solicitudesPendientes, justificacionesPendientes, eventos, alumnosAnteriores] = await Promise.all([
            prisma.nota.findMany({
                where: { alumnoId: { in: ids }, actividad: { unidad: { cursoSeccion: { seccion: { anioLectivo } } } } },
                select: { alumnoId: true, valor: true, actividad: { select: { unidad: { select: { numero: true, cursoSeccionId: true } } } } },
            }),
            prisma.pago.findMany({
                where: { alumnoId: { in: ids }, anioLectivo, estado: { in: ["Pagado", "Exonerado"] } },
                select: { alumnoId: true, mes: true },
            }),
            prisma.solicitud.count({
                where: { estado: { in: ["PENDIENTE", "REVISION"] }, ...(sedeId !== undefined ? { OR: [{ sedeId }, { sedeId: null }] } : {}) },
            }),
            prisma.justificacionAusencia.count({ where: { estado: "Pendiente", alumnoId: { in: ids } } }),
            prisma.evento.findMany({
                where: { fecha: { gte: hoyUTC() }, ...(sedeId !== undefined ? { OR: [{ sedeId }, { sedeId: null }] } : {}) },
                orderBy: { fecha: "asc" },
                take: 3,
                select: { eventoId: true, nombre: true, fecha: true, tipoEvento: true },
            }),
            prisma.alumno.count({
                where: { usuario: { deletedAt: null }, seccion: { ...filtroSede, anioLectivo: anioLectivo - 1 } },
            }),
        ]);

        // Notas: unidad = suma de sus actividades; curso = promedio de unidades evaluadas;
        // alumno = promedio de sus cursos
        const porUnidad = new Map<string, number>();
        for (const n of notas) {
            const k = `${n.alumnoId}|${n.actividad.unidad.cursoSeccionId}|${n.actividad.unidad.numero}`;
            porUnidad.set(k, (porUnidad.get(k) ?? 0) + Number(n.valor));
        }
        const porCurso = new Map<string, number[]>();
        for (const [k, v] of porUnidad) {
            const [alumnoId, cs] = k.split("|");
            const kc = `${alumnoId}|${cs}`;
            porCurso.set(kc, [...(porCurso.get(kc) ?? []), v]);
        }
        const cursosDe = new Map<number, number[]>();
        for (const [k, unidades] of porCurso) {
            const alumnoId = Number(k.split("|")[0]);
            cursosDe.set(alumnoId, [...(cursosDe.get(alumnoId) ?? []), promedio(unidades)!]);
        }

        // Pagos: un mes vencido es uno ya pasado sin pago ni exoneración (beca del 100% cubre todo)
        const mesesVencidos = Math.min(new Date().getMonth(), MESES_COLEGIATURA); // meses anteriores al actual
        const pagados = new Set(pagos.map((p) => `${p.alumnoId}|${p.mes}`));
        const enMora = anioLectivo < anioActual || mesesVencidos > 0
            ? alumnos.filter((a) => {
                if (a.becas.some((b) => Number(b.porcentaje) >= 100)) return false;
                const hasta = anioLectivo < anioActual ? MESES_COLEGIATURA : mesesVencidos;
                for (let m = 1; m <= hasta; m++) if (!pagados.has(`${a.alumnoId}|${m}`)) return true;
                return false;
            }).length
            : 0;

        const filas = alumnos.map((a) => {
            const cursos = cursosDe.get(a.alumnoId) ?? [];
            const prom = promedio(cursos);
            return {
                alumnoId: a.alumnoId,
                nombre: `${a.usuario.nombres} ${a.usuario.apellidos}`,
                grado: a.seccion.grado,
                seccion: a.seccion.nombre,
                promedio: prom,
                cursosReprobados: cursos.filter((c) => c < NOTA_APROBACION).length,
                sinEncargado: a.encargados.length === 0,
            };
        });
        const evaluados = filas.filter((f) => f.promedio !== null);
        const aprobados = evaluados.filter((f) => (f.promedio as number) >= NOTA_APROBACION);

        const grados = new Map<number, { grado: string; orden: number; total: number; evaluados: number; aprobados: number }>();
        for (const f of filas) {
            const g = grados.get(f.grado.gradoId) ?? { grado: f.grado.nombre, orden: f.grado.orden, total: 0, evaluados: 0, aprobados: 0 };
            g.total++;
            if (f.promedio !== null) {
                g.evaluados++;
                if (f.promedio >= NOTA_APROBACION) g.aprobados++;
            }
            grados.set(f.grado.gradoId, g);
        }

        const becasActivas = alumnos.filter((a) => a.becas.length > 0).length;

        return res.json({
            status: "success",
            data: {
                sede: sede?.nombre ?? "Todas las sedes",
                anioLectivo,
                alumnos: { total: alumnos.length, anterior: alumnosAnteriores },
                aprobacion: {
                    porcentaje: evaluados.length ? Math.round((aprobados.length / evaluados.length) * 100) : null,
                    evaluados: evaluados.length,
                    promedio: evaluados.length ? Math.round(promedio(evaluados.map((f) => f.promedio as number))! * 10) / 10 : null,
                },
                mora: { alumnos: enMora, porcentaje: alumnos.length ? Math.round((enMora / alumnos.length) * 100) : 0 },
                becas: { activas: becasActivas, porcentaje: alumnos.length ? Math.round((becasActivas / alumnos.length) * 1000) / 10 : 0 },
                porGrado: [...grados.values()].sort((a, b) => a.orden - b.orden).map(({ orden: _o, ...g }) => g),
                pendientes: {
                    solicitudes: solicitudesPendientes,
                    justificaciones: justificacionesPendientes,
                    sinEncargado: filas.filter((f) => f.sinEncargado).length,
                },
                enRiesgo: evaluados
                    .filter((f) => (f.promedio as number) < NOTA_APROBACION || f.cursosReprobados > 0)
                    .sort((a, b) => (a.promedio as number) - (b.promedio as number))
                    .slice(0, 5)
                    .map((f) => ({ alumnoId: f.alumnoId, nombre: f.nombre, grado: `${f.grado.nombre} ${f.seccion}`, promedio: Math.round(f.promedio as number), cursosReprobados: f.cursosReprobados })),
                proximosEventos: eventos,
            },
        });
    } catch (error) {
        console.error("Error al calcular el dashboard de sede:", error);
        return res.status(500).json({ status: "error", message: "No se pudo calcular el resumen de la sede." });
    }
};

import type { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import type { AuthenticatedRequest } from "../middlewares/auth.middleware.js";
import { sedeDelAlcance } from "../middlewares/role.middleware.js";
import { NOTA_APROBACION } from "../services/boletin.service.js";
import { filtroVinculo } from "../services/vinculos.service.js";
import { ESTADO_NO_APLICA } from "../services/colegiaturas.service.js";
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

        // Dos rondas de consultas en paralelo (la BD está lejos y cada viaje cuesta):
        // 1) el ciclo y lo que no depende de él; 2) todo lo del ciclo
        const anioActual = new Date().getFullYear();
        const filtroEvento = sedeId !== undefined ? { OR: [{ sedeId }, { sedeId: null }] } : {};
        const [ultimo, sede, solicitudesPendientes, eventos] = await Promise.all([
            // Ciclo: el año actual, o el último que tenga secciones
            prisma.seccion.findFirst({
                where: { deletedAt: null, ...filtroSede, anioLectivo: { lte: anioActual } },
                orderBy: { anioLectivo: "desc" },
                select: { anioLectivo: true },
            }),
            sedeId !== undefined ? prisma.sede.findUnique({ where: { sedeId }, select: { nombre: true } }) : null,
            prisma.solicitud.count({
                where: { estado: { in: ["PENDIENTE", "REVISION"] }, ...filtroEvento },
            }),
            prisma.evento.findMany({
                where: { fecha: { gte: hoyUTC() }, ...filtroEvento },
                orderBy: { fecha: "asc" },
                take: 3,
                select: { eventoId: true, nombre: true, fecha: true, tipoEvento: true },
            }),
        ]);
        const anioLectivo = ultimo?.anioLectivo ?? anioActual;

        // Alumnos del ciclo (en la sede, si hay filtro)
        const filtroAlumnos = { usuario: { deletedAt: null }, seccion: { ...filtroSede, anioLectivo, deletedAt: null } };
        const [alumnos, totalesUnidad, pagos, justificacionesPendientes, alumnosAnteriores] = await Promise.all([
            prisma.alumno.findMany({
                where: filtroAlumnos,
                select: {
                    alumnoId: true,
                    usuario: { select: { nombres: true, apellidos: true } },
                    seccion: { select: { nombre: true, grado: { select: { gradoId: true, nombre: true, orden: true } } } },
                    encargados: { where: filtroVinculo(), select: { encargadoId: true } },
                    becas: { where: { estado: "Activa", anioLectivo }, select: { porcentaje: true } },
                },
            }),
            // Total de cada unidad (suma de sus actividades) por alumno y curso, ya sumado en la BD
            prisma.$queryRaw<{ alumnoId: number; cursoSeccionId: number; numero: number; total: number }[]>`
                SELECT n."alumnoId", u."cursoSeccionId", u.numero, SUM(n.valor)::float AS total
                FROM "Nota" n
                JOIN "Alumno" al ON al."alumnoId" = n."alumnoId"
                JOIN "Usuario" us ON us."usuarioId" = al."alumnoId" AND us."deletedAt" IS NULL
                JOIN "Seccion" sa ON sa."seccionId" = al."seccionId"
                    AND sa."anioLectivo" = ${anioLectivo} AND sa."deletedAt" IS NULL
                    ${sedeId !== undefined ? Prisma.sql`AND sa."sedeId" = ${sedeId}` : Prisma.empty}
                JOIN "Actividad" a ON a."actividadId" = n."actividadId"
                JOIN "Unidad" u ON u."unidadId" = a."unidadId"
                JOIN "CursoSeccion" cs ON cs."cursoSeccionId" = u."cursoSeccionId"
                JOIN "Seccion" s ON s."seccionId" = cs."seccionId" AND s."anioLectivo" = ${anioLectivo}
                GROUP BY n."alumnoId", u."cursoSeccionId", u.numero`,
            prisma.pago.findMany({
                where: { alumno: filtroAlumnos, anioLectivo, estado: { in: ["Pagado", "Exonerado", ESTADO_NO_APLICA] } },
                select: { alumnoId: true, mes: true },
            }),
            prisma.justificacionAusencia.count({ where: { estado: "Pendiente", alumno: filtroAlumnos } }),
            prisma.alumno.count({
                where: { usuario: { deletedAt: null }, seccion: { ...filtroSede, anioLectivo: anioLectivo - 1 } },
            }),
        ]);

        // Notas: unidad = suma de sus actividades; curso = promedio de unidades evaluadas;
        // alumno = promedio de sus cursos
        const porUnidad = new Map<string, number>(
            totalesUnidad.map((t) => [`${t.alumnoId}|${t.cursoSeccionId}|${t.numero}`, t.total]),
        );
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

        // Pagos: un mes vencido es uno ya pasado sin pago ni exoneración (beca del 100% cubre todo) y que sí se cobra
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

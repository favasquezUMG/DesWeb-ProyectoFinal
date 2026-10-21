import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, Clock } from "lucide-react";
import type { View } from "../../types";
import { Card, MetricCard, SectionHeader, Badge, AlertBanner, EmptyState } from "../../components/Ui";
import { getSession } from "../../lib/auth";
import { getLibreta, getListaAsistencia, type CursoSeccionDto, type LibretaDto } from "../../lib/api";
import { clasesDe, type ClaseHorario } from "./Horario";
import {
  Cargando, DIAS_SEMANA, calcularTotales, diaSemanaHoy, estadoAcademico, formatFechaCorta, hoyISO, nombreCurso, useMisCursos,
} from "./shared";

interface Pendiente {
  tipo: "warning" | "info";
  msg: string;
  // A dónde lleva al hacer clic: la libreta o el pase de lista de ese curso
  view: View;
  cursoSeccionId: number;
}

// Siguiente clase a partir de este momento, recorriendo la semana
function proximaClase(clases: ClaseHorario[]): { clase: ClaseHorario; esHoy: boolean } | null {
  if (clases.length === 0) return null;
  const hoy = diaSemanaHoy();
  const ahora = new Date();
  const horaActual = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;

  for (let i = 0; i < 7; i++) {
    const dia = ((hoy - 1 + i) % 7) + 1;
    const delDia = clases.filter((c) => c.diaSemana === dia && (i > 0 || c.horaInicio > horaActual));
    if (delDia.length > 0) return { clase: delDia[0], esHoy: i === 0 };
  }
  // Solo hay clases hoy y ya pasaron: la próxima es la primera de la otra semana
  return { clase: clases[0], esHoy: false };
}

function resumenHorario(c: CursoSeccionDto): string {
  const horarios = c.horarios ?? [];
  if (horarios.length === 0) return "Sin horario asignado";
  const dias = [...new Set(horarios.map((h) => DIAS_SEMANA[h.diaSemana]?.slice(0, 3)))].join("/");
  const horas = [...new Set(horarios.map((h) => `${h.horaInicio}–${h.horaFin}`))].join(", ");
  return `${dias} · ${horas}`;
}

export default function Dashboard({ onNavigate }: { onNavigate: (v: View) => void }) {
  const { cursos, setSeleccion, loading, error } = useMisCursos();
  const [libretas, setLibretas] = useState<Record<number, LibretaDto>>({});
  const [pendientes, setPendientes] = useState<Pendiente[] | null>(null);
  const nombre = getSession()?.user.name ?? "";

  useEffect(() => {
    if (cursos.length === 0) {
      setPendientes([]);
      return;
    }
    let cancelled = false;
    const hoy = hoyISO();
    const diaHoy = diaSemanaHoy();

    (async () => {
      const resultados = await Promise.allSettled(cursos.map((c) => getLibreta(c.cursoSeccionId)));
      const porCurso: Record<number, LibretaDto> = {};
      resultados.forEach((r, i) => { if (r.status === "fulfilled") porCurso[cursos[i].cursoSeccionId] = r.value; });

      const lista: Pendiente[] = [];

      // Actividades cuya fecha ya pasó y aún tienen alumnos sin calificar
      for (const c of cursos) {
        const lib = porCurso[c.cursoSeccionId];
        if (!lib || lib.alumnos.length === 0) continue;
        for (const u of lib.unidades) {
          for (const a of u.actividades) {
            if (!a.fecha || a.fecha > hoy) continue;
            const calificados = lib.notas.filter((n) => n.actividadId === a.actividadId).length;
            const faltan = lib.alumnos.length - calificados;
            if (faltan > 0) {
              lista.push({
                tipo: "warning",
                msg: `Ingresar notas de "${a.nombre}" (${formatFechaCorta(a.fecha)}) — ${nombreCurso(c)} · ${faltan} sin calificar`,
                view: "cat-notas",
                cursoSeccionId: c.cursoSeccionId,
              });
            }
          }
        }
      }

      // Cursos con clase hoy en los que todavía no se pasa lista
      const conClaseHoy = cursos.filter((c) => c.horarios?.some((h) => h.diaSemana === diaHoy));
      const listas = await Promise.allSettled(conClaseHoy.map((c) => getListaAsistencia(c.cursoSeccionId, hoy)));
      listas.forEach((r, i) => {
        if (r.status === "fulfilled" && !r.value.yaRegistrada && r.value.alumnos.length > 0) {
          lista.unshift({
            tipo: "info",
            msg: `Asistencia pendiente de hoy (${formatFechaCorta(hoy)}) — ${nombreCurso(conClaseHoy[i])}`,
            view: "cat-asistencia",
            cursoSeccionId: conClaseHoy[i].cursoSeccionId,
          });
        }
      });

      if (!cancelled) {
        setLibretas(porCurso);
        setPendientes(lista);
      }
    })();

    return () => { cancelled = true; };
  }, [cursos]);

  const hoyTexto = formatFechaCorta(hoyISO());

  if (loading) return <Cargando texto="Cargando su panel..." />;

  const clases = clasesDe(cursos);
  const proxima = proximaClase(clases);
  const totalPendientes = pendientes?.length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Mi Panel" subtitle={`Bienvenido, ${nombre} · ${hoyTexto}`} />
      {error && <AlertBanner type="error" message={error} />}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Mis cursos" value={cursos.length} sub={cursos[0]?.seccion.anioLectivo ? `Ciclo ${cursos[0].seccion.anioLectivo}` : undefined} icon={<BookOpen className="w-5 h-5" />} />
        <MetricCard
          label="Próxima clase"
          value={proxima ? proxima.clase.horaInicio : "—"}
          sub={proxima ? `${proxima.esHoy ? "Hoy" : DIAS_SEMANA[proxima.clase.diaSemana]} · ${proxima.clase.curso} ${proxima.clase.grupo}` : "Sin horario asignado"}
          icon={<Clock className="w-5 h-5" />}
        />
        <MetricCard
          label="Pendientes"
          value={totalPendientes ?? "…"}
          sub={totalPendientes === undefined ? "Calculando..." : totalPendientes === 0 ? "Todo al día" : "Notas y asistencia por registrar"}
          icon={<AlertCircle className="w-5 h-5" />}
          variant={totalPendientes ? "warning" : "success"}
        />
      </div>

      {cursos.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados" description="Cuando la sede le asigne cursos aparecerán aquí." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-5">
            <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Mis cursos</h3>
            <div className="space-y-3">
              {cursos.map((c) => {
                const lib = libretas[c.cursoSeccionId];
                const totales = lib ? [...calcularTotales(lib).values()] : [];
                const alumnos = lib?.alumnos.length ?? 0;
                const aprobados = totales.filter((t) => t.conNotas && estadoAcademico(t) === "aprobado").length;
                const enRiesgo = totales.filter((t) => t.conNotas && estadoAcademico(t) === "reprobado").length;
                return (
                  <div key={c.cursoSeccionId} className="p-4 bg-stone-50 border border-stone-100 rounded-xl">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-stone-900">{c.curso.nombre}</p>
                        <p className="text-xs text-stone-500">{c.seccion.grado.nombre} {c.seccion.nombre}</p>
                      </div>
                      {lib && <Badge variant="primary">{alumnos} alumnos</Badge>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-stone-500">
                      <Clock className="w-3.5 h-3.5" />{resumenHorario(c)}
                    </div>
                    {lib && alumnos > 0 && (
                      <>
                        <div className="w-full bg-stone-200 rounded-full h-1.5 mt-3">
                          <div className="bg-success-600 h-1.5 rounded-full" style={{ width: `${Math.round(aprobados / alumnos * 100)}%` }} />
                        </div>
                        <p className="text-[10px] text-stone-400 mt-1">
                          {aprobados} de {alumnos} ya aprobados ({Math.round(aprobados / alumnos * 100)}%)
                          {enRiesgo > 0 && <span className="text-danger-700"> · {enRiesgo} sin posibilidad de aprobar</span>}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-5">
            <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Pendientes</h3>
            {pendientes === null ? <Cargando /> : pendientes.length === 0 ? (
              <div className="flex items-center gap-2 p-3 rounded-lg border bg-success-50 border-success-200 text-success-800 text-xs">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />No tiene notas ni asistencias pendientes.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {pendientes.map((p, i) => {
                  const cls = p.tipo === "warning" ? "bg-warning-50 border-warning-200 text-warning-800" : "bg-info-50 border-info-200 text-info-800";
                  return (
                    <button key={i} onClick={() => { setSeleccion(p.cursoSeccionId); onNavigate(p.view); }}
                      className={`w-full flex items-start gap-2 p-3 rounded-lg border text-xs text-left cursor-pointer hover:brightness-95 transition ${cls}`}>
                      <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span className="flex-1">{p.msg}</span>
                      <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 opacity-60" />
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

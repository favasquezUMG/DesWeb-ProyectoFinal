import { useEffect, useState } from "react";
import { AlertCircle, BookOpen, CheckCircle2, ChevronRight, Clock } from "../../components/Iconos";
import type { View } from "../../types";
import { Card, SectionHeader, AlertBanner, EmptyState, CursoMarca, colorDeCurso } from "../../components/Ui";
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

  if (loading) return <Cargando texto="Cargando su panel…" />;

  const clases = clasesDe(cursos);
  const proxima = proximaClase(clases);
  const totalPendientes = pendientes?.length;

  return (
    <div className="space-y-6">
      <SectionHeader title={`Hola, ${nombre.split(" ")[0]}`} subtitle={`Su resumen del ${hoyTexto}`} />
      {error && <AlertBanner type="error" message={error} />}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {(() => {
          const col = proxima ? colorDeCurso(proxima.clase.curso) : null;
          return (
            <div className={`md:col-span-2 rounded-[20px] p-6 relative overflow-hidden textile-pattern ${col ? `${col.solid} ${col.fg}` : "bg-stone-400 text-white"}`}>
              <span className="absolute -right-4 -bottom-10 font-display font-extrabold text-[10rem] leading-none opacity-[0.14] select-none" aria-hidden="true">
                {proxima ? proxima.clase.curso.charAt(0) : ""}
              </span>
              <div className="relative flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
                <div>
                  <p className="text-sm font-semibold opacity-80 flex items-center gap-1.5"><Clock className="w-4 h-4" />
                    {proxima ? (proxima.esHoy ? "Su próxima clase, hoy" : `Su próxima clase, el ${DIAS_SEMANA[proxima.clase.diaSemana].toLowerCase()}`) : "Próxima clase"}
                  </p>
                  <p className="font-display font-bold text-6xl leading-none mt-3 tabular-nums">{proxima ? proxima.clase.horaInicio : "—"}</p>
                </div>
                <div className="pb-1">
                  <p className="font-display font-bold text-2xl leading-tight">{proxima ? proxima.clase.curso : "Sin horario asignado"}</p>
                  {proxima && <p className="opacity-85 text-sm mt-0.5">{proxima.clase.grupo}</p>}
                </div>
              </div>
            </div>
          );
        })()}
        <Card className="p-6 flex flex-col justify-between gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-stone-600">Pendientes</p>
            <span className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${totalPendientes ? "bg-warning-600" : "bg-success-600"} text-white`}><AlertCircle className="w-4 h-4" /></span>
          </div>
          <div>
            <p className={`font-display font-bold text-5xl leading-none tabular-nums ${totalPendientes ? "text-warning-700" : "text-stone-900"}`}>{totalPendientes ?? "…"}</p>
            <p className="text-[13px] text-stone-500 mt-2">{totalPendientes === undefined ? "Calculando…" : totalPendientes === 0 ? "Todo al día" : "Notas y asistencia por registrar"}</p>
          </div>
          <p className="text-[13px] text-stone-500 border-t border-stone-100 pt-3"><span className="font-bold text-stone-900">{cursos.length}</span> cursos{cursos[0]?.seccion.anioLectivo ? ` en el ciclo ${cursos[0].seccion.anioLectivo}` : ""}</p>
        </Card>
      </div>

      {cursos.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados" description="Cuando la sede le asigne cursos aparecerán aquí." />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <Card className="p-6 lg:col-span-3">
            <h3 className="font-display font-bold text-stone-900 text-lg mb-4">Mis cursos</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cursos.map((c) => {
                const lib = libretas[c.cursoSeccionId];
                const totales = lib ? [...calcularTotales(lib).values()] : [];
                const alumnos = lib?.alumnos.length ?? 0;
                const aprobados = totales.filter((t) => t.conNotas && estadoAcademico(t) === "aprobado").length;
                const enRiesgo = totales.filter((t) => t.conNotas && estadoAcademico(t) === "reprobado").length;
                return (
                  <div key={c.cursoSeccionId} className="p-4 rounded-2xl bg-sand-100">
                    <div className="flex items-start gap-3 mb-3">
                      <CursoMarca nombre={c.curso.nombre} />
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-[15px] text-stone-900 leading-tight">{c.curso.nombre}</p>
                        <p className="text-[13px] text-stone-600">{c.seccion.grado.nombre} {c.seccion.nombre}{lib ? `, ${alumnos} alumnos` : ""}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-stone-600">
                      <Clock className="w-3.5 h-3.5" />{resumenHorario(c)}
                    </div>
                    {lib && alumnos > 0 && (
                      <>
                        <div className="w-full bg-white/80 rounded-full h-2 mt-3">
                          <div className={`${colorDeCurso(c.curso.nombre).solid} h-2 rounded-full`} style={{ width: `${Math.round(aprobados / alumnos * 100)}%` }} />
                        </div>
                        <p className="text-xs text-stone-600 mt-1.5">
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

          <Card className="p-6 lg:col-span-2">
            <h3 className="font-display font-bold text-stone-900 text-lg mb-4">Por hacer</h3>
            {pendientes === null ? <Cargando /> : pendientes.length === 0 ? (
              <div className="flex flex-col items-center text-center gap-2 py-8 text-stone-600 text-sm">
                <CheckCircle2 className="w-9 h-9 text-success-600" />No tiene notas ni asistencias pendientes.
              </div>
            ) : (
              <div className="space-y-2.5 max-h-96 overflow-y-auto">
                {pendientes.map((p, i) => {
                  const cls = p.tipo === "warning" ? "bg-warning-600" : "bg-info-600";
                  return (
                    <button key={i} onClick={() => { setSeleccion(p.cursoSeccionId); onNavigate(p.view); }}
                      className="w-full flex items-start gap-3 px-3 py-3 rounded-2xl text-sm text-left text-stone-800 cursor-pointer hover:bg-sand-100 transition-colors">
                      <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${cls}`} aria-hidden="true" />
                      <span className="flex-1 leading-snug">{p.msg}</span>
                      <ChevronRight className="w-4 h-4 mt-0.5 shrink-0 text-stone-400" />
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

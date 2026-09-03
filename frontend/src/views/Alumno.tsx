import { useState } from "react";
import { BookOpen, Clock, Bell, CheckCircle2, AlertCircle, ChevronRight } from "lucide-react";
import type { View } from "../types";
import { NOTAS_ALUMNO, HORARIO_3A, DIAS, BLOQUES, EVENTOS } from "../data";
import { Card, MetricCard, SectionHeader, Badge, EstadoBadge, TH, TD } from "../components/Ui";

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardAlu() {
  const cursosConNotas = NOTAS_ALUMNO.filter(c => c.u1 !== null);
  const promedioGeneral = Math.round(
    cursosConNotas.reduce((acc, c) => {
      const vals = [c.u1, c.u2, c.u3].filter(v => v !== null) as number[];
      return acc + (vals.reduce((a, b) => a + b, 0) / vals.length);
    }, 0) / cursosConNotas.length
  );

  const aprobados = NOTAS_ALUMNO.filter(c => {
    const vals = [c.u1, c.u2, c.u3].filter(v => v !== null) as number[];
    const prom = vals.reduce((a, b) => a + b, 0) / vals.length;
    return prom >= 61;
  }).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Mi Panel" subtitle="María José Ajú Pac · 3ro Básico A · Ciclo 2025" />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <MetricCard label="Promedio general" value={promedioGeneral} sub="Promedio acumulado" icon={<BookOpen className="w-5 h-5" />} variant={promedioGeneral >= 61 ? "success" : "danger"} />
        <MetricCard label="Cursos aprobados" value={`${aprobados}/${NOTAS_ALUMNO.length}`} sub="Unidades evaluadas" icon={<CheckCircle2 className="w-5 h-5" />} variant="success" />
        <div className="col-span-2 sm:col-span-1">
          <MetricCard label="Próxima clase" value="07:00" sub="Lunes · Matemática" icon={<Clock className="w-5 h-5" />} />
        </div>
      </div>

      {/* Quick notes summary */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-stone-800 text-base">Mis cursos</h3>
          <button className="text-xs text-primary-700 hover:underline font-medium flex items-center gap-1">Ver notas completas <ChevronRight className="w-3.5 h-3.5" /></button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {NOTAS_ALUMNO.slice(0, 4).map(c => {
            const vals = [c.u1, c.u2, c.u3].filter(v => v !== null) as number[];
            const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
            return (
              <div key={c.curso} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <div>
                  <p className="font-medium text-stone-900 text-sm">{c.curso}</p>
                  <p className="text-xs text-stone-500">{c.catedratico}</p>
                </div>
                {prom !== null && (
                  <div className="text-right">
                    <p className={`font-mono-data font-bold text-xl ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</p>
                    <EstadoBadge aprobado={prom >= 61} label={prom >= 61 ? "✓" : "✗"} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Upcoming events */}
      <Card className="p-5">
        <h3 className="font-display font-semibold text-stone-800 text-base mb-3">Próximos eventos</h3>
        <div className="space-y-2">
          {EVENTOS.filter(e => e.tipo === "examen" || e.tipo === "actividad" || e.tipo === "asueto" || e.tipo === "institucional").slice(0, 4).map(e => {
            const colors: Record<string, string> = { examen: "bg-danger-50 text-danger-800 border-danger-200", actividad: "bg-info-50 text-info-800 border-info-200", asueto: "bg-warning-50 text-warning-800 border-warning-200", institucional: "bg-primary-50 text-primary-800 border-primary-200", festivo: "bg-success-50 text-success-800 border-success-200", descanso: "bg-stone-50 text-stone-600 border-stone-200", clases: "bg-stone-50 text-stone-600 border-stone-200" };
            return (
              <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${colors[e.tipo] ?? ""}`}>
                <span>{e.titulo}</span>
                <span className="font-mono-data shrink-0">{e.fecha.split("-").reverse().join("/")}</span>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Notifications */}
      <Card className="p-5">
        <h3 className="font-display font-semibold text-stone-800 text-base mb-3">Avisos recientes</h3>
        <div className="space-y-2.5">
          {[
            { msg: "Exámenes de Cuarta Unidad del 27 al 31 de octubre", fecha: "20/08/2025", tipo: "academico" },
            { msg: "Asueto por Día de la Independencia — 15 de septiembre", fecha: "10/08/2025", tipo: "asueto" },
            { msg: "Reunión de padres — viernes 22/08 a las 17:00 hrs", fecha: "05/08/2025", tipo: "institucional" },
          ].map((n, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <Bell className="w-3.5 h-3.5 text-primary-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm text-stone-700">{n.msg}</p>
                <p className="text-[10px] text-stone-400 mt-0.5">{n.fecha}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Mis Notas ────────────────────────────────────────────────────────────────

function MisNotas() {
  const unidades = ["I", "II", "III", "IV"];

  return (
    <div className="space-y-5">
      <SectionHeader title="Mis Notas" subtitle="Tercero Básico A · Ciclo escolar 2025" />

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {NOTAS_ALUMNO.map(c => {
          const vals = [c.u1, c.u2, c.u3, c.u4].filter(v => v !== null) as number[];
          const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
          return (
            <Card key={c.curso} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-display font-semibold text-stone-900">{c.curso}</p>
                  <p className="text-xs text-stone-500">{c.catedratico}</p>
                </div>
                {prom !== null && <EstadoBadge aprobado={prom >= 61} />}
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {[c.u1, c.u2, c.u3, c.u4].map((nota, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <span className="text-[10px] text-stone-400 mb-1">U{i + 1}</span>
                    {nota !== null ? (
                      <span className={`font-mono-data font-bold text-sm px-2 py-1 rounded-lg
                        ${nota >= 61 ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}>
                        {nota}
                      </span>
                    ) : (
                      <span className="text-stone-300 font-mono-data text-sm px-2 py-1">—</span>
                    )}
                  </div>
                ))}
              </div>
              {prom !== null && (
                <div className="mt-3 pt-2 border-t border-stone-100 flex justify-between text-sm">
                  <span className="text-stone-500">Promedio</span>
                  <span className={`font-mono-data font-bold text-base ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <TH>Curso</TH>
                <TH>Catedrático</TH>
                {unidades.map(u => <TH key={u} className="text-center">Unidad {u}</TH>)}
                <TH className="text-center">Promedio</TH>
                <TH className="text-center">Estado</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {NOTAS_ALUMNO.map(c => {
                const notaArr = [c.u1, c.u2, c.u3, c.u4];
                const vals = notaArr.filter(v => v !== null) as number[];
                const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                return (
                  <tr key={c.curso} className="hover:bg-stone-50 transition-colors">
                    <TD><span className="font-medium text-stone-900">{c.curso}</span></TD>
                    <TD><span className="text-stone-500 text-xs">{c.catedratico}</span></TD>
                    {notaArr.map((nota, i) => (
                      <TD key={i} className="text-center">
                        {nota !== null ? (
                          <span className={`inline-block font-mono-data font-semibold text-sm px-2 py-0.5 rounded-md
                            ${nota >= 61 ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}
                            aria-label={nota >= 61 ? `${nota} — aprobado` : `${nota} — reprobado`}>
                            {nota}
                          </span>
                        ) : (
                          <span className="text-stone-300 font-mono-data">—</span>
                        )}
                      </TD>
                    ))}
                    <TD className="text-center">
                      {prom !== null ? (
                        <span className={`font-mono-data font-bold text-base ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>
                      ) : "—"}
                    </TD>
                    <TD className="text-center">
                      {prom !== null ? <EstadoBadge aprobado={prom >= 61} /> : <span className="text-xs text-stone-400">Pendiente</span>}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-stone-400 text-center">Escala de 0 a 100 · 61 o más puntos = aprobado · La cuarta unidad está en curso.</p>
    </div>
  );
}

// ─── Mi Horario ───────────────────────────────────────────────────────────────

function MiHorarioAlu() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Mi Horario" subtitle="Tercero Básico A — Ciclo 2025" />

      {/* Mobile: list per day */}
      <div className="md:hidden space-y-4">
        {DIAS.map(dia => {
          const clases = Object.entries(HORARIO_3A[dia] ?? {});
          if (clases.length === 0) return null;
          return (
            <Card key={dia} className="p-4">
              <h3 className="font-semibold text-stone-800 mb-3">{dia}</h3>
              <div className="space-y-2">
                {clases.map(([hora, celda]) => (
                  <div key={hora} className={`flex items-center gap-3 p-2 rounded-lg border ${celda.color}`}>
                    <span className="font-mono-data text-xs font-semibold whitespace-nowrap">{hora}</span>
                    <div>
                      <p className="font-semibold text-xs">{celda.curso}</p>
                      <p className="text-[10px] opacity-70">{celda.catedratico} · {celda.salon}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: grid */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-medium w-28">Hora</th>
                {DIAS.map(d => <th key={d} className="px-4 py-3 text-left font-medium">{d}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {BLOQUES.map((bloque, i) => {
                const isReceso = bloque === "09:45–10:15";
                if (isReceso) return (
                  <tr key={bloque} className="bg-stone-50">
                    <td className="px-4 py-2 font-mono-data text-stone-400">{bloque}</td>
                    {DIAS.map(d => <td key={d} className="px-4 py-2 text-stone-300 italic text-center">Receso</td>)}
                  </tr>
                );
                return (
                  <tr key={bloque} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                    <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{bloque}</td>
                    {DIAS.map(d => {
                      const celda = HORARIO_3A[d]?.[bloque];
                      return (
                        <td key={d} className="px-2 py-2">
                          {celda ? (
                            <div className={`p-2 rounded-lg border ${celda.color}`}>
                              <p className="font-semibold">{celda.curso}</p>
                              <p className="text-[10px] opacity-70 mt-0.5">{celda.catedratico}</p>
                              <p className="text-[10px] opacity-60">{celda.salon}</p>
                            </div>
                          ) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Calendario ───────────────────────────────────────────────────────────────

const TIPO_BADGE: Record<string, string> = {
  clases:        "bg-stone-100 text-stone-700 border-stone-200",
  examen:        "bg-purple-100 text-purple-800 border-purple-200",
  descanso:      "bg-amber-100 text-amber-800 border-amber-200",
  actividad:     "bg-info-100 text-info-800 border-info-200",
  asueto:        "bg-warning-100 text-warning-800 border-warning-200",
  festivo:       "bg-success-100 text-success-800 border-success-200",
  institucional: "bg-primary-100 text-primary-800 border-primary-200",
  academico:     "bg-info-100 text-info-800 border-info-200",
};

const TIPO_LABEL: Record<string, string> = {
  clases: "Clases", examen: "Exámenes", descanso: "Descanso",
  actividad: "Actividad", asueto: "Asueto", festivo: "Festivo",
  institucional: "Institucional", academico: "Académico",
};

function CalendarioAlu() {
  const filtered = EVENTOS.filter(e => e.tipo !== "clases").sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <div className="space-y-5">
      <SectionHeader title="Calendario Escolar" subtitle="Ciclo 2025 — Eventos y actividades importantes" />

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(["examen","descanso","actividad","asueto","festivo","institucional"] as const).map(t => (
          <span key={t} className={`px-2.5 py-0.5 rounded-full border text-xs font-medium ${TIPO_BADGE[t]}`}>{TIPO_LABEL[t]}</span>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(e => {
          const inicio = e.fecha.split("-").reverse().join("/");
          const fin = e.fechaFin ? e.fechaFin.split("-").reverse().join("/") : null;
          return (
            <div key={e.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${TIPO_BADGE[e.tipo] ?? TIPO_BADGE.clases}`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div>
                  <p className="font-semibold text-sm">{e.titulo}</p>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full border ${TIPO_BADGE[e.tipo]}`}>{TIPO_LABEL[e.tipo]}</span>
                </div>
              </div>
              <span className="font-mono-data text-xs shrink-0 ml-2">{fin ? `${inicio} – ${fin}` : inicio}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function Alumno({ view }: { view: View }) {
  if (view === "alu-notas") return <MisNotas />;
  if (view === "alu-horario") return <MiHorarioAlu />;
  if (view === "alu-calendario") return <CalendarioAlu />;
  return <DashboardAlu />;
}

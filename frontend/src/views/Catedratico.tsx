import { useState } from "react";
import { BookOpen, Clock, CheckCircle2, AlertCircle, Save, ChevronDown } from "lucide-react";
import type { View } from "../types";
import { ALUMNOS, NOTAS_3A, HORARIO_3A, DIAS, BLOQUES } from "../data";
import { Card, MetricCard, SectionHeader, Btn, Badge, EstadoBadge, AlertBanner, Tabs, TH, TD } from "../components/Ui";

// ─── Dashboard ────────────────────────────────────────────────────────────────

function DashboardCat() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Mi Panel" subtitle="Bienvenido, Prof. Carlos Gómez · 25/08/2025" />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Mis cursos" value="2" sub="Ciclo 2025" icon={<BookOpen className="w-5 h-5" />} />
        <MetricCard label="Próxima clase" value="07:00" sub="Lunes · Matemática 3ro A" icon={<Clock className="w-5 h-5" />} />
        <MetricCard label="Notas pendientes" value="2" sub="Cuarta unidad — 3ro A y 2do A" icon={<AlertCircle className="w-5 h-5" />} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Mis cursos</h3>
          <div className="space-y-3">
            {[
              { curso: "Matemática", grado: "Tercero Básico A", alumnos: 28, aprobados: 22, horario: "Lun/Mar/Mié/Jue · 07:00–07:45" },
              { curso: "Matemática", grado: "Segundo Básico A", alumnos: 24, aprobados: 19, horario: "Lun/Mié · 08:30–09:15" },
            ].map(c => (
              <div key={c.grado} className="p-4 bg-stone-50 border border-stone-100 rounded-xl">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-stone-900">{c.curso}</p>
                    <p className="text-xs text-stone-500">{c.grado}</p>
                  </div>
                  <Badge variant="primary">{c.alumnos} alumnos</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                  <Clock className="w-3.5 h-3.5" />{c.horario}
                </div>
                <div className="w-full bg-stone-200 rounded-full h-1.5 mt-2">
                  <div className="bg-success-600 h-1.5 rounded-full" style={{ width: `${Math.round(c.aprobados / c.alumnos * 100)}%` }} />
                </div>
                <p className="text-[10px] text-stone-400 mt-1">{c.aprobados} de {c.alumnos} aprobados ({Math.round(c.aprobados / c.alumnos * 100)}%)</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Pendientes</h3>
          <div className="space-y-2.5">
            {[
              { tipo: "warning", msg: "Ingresar notas de Cuarta Unidad — Matemática 3ro A (28 alumnos)" },
              { tipo: "warning", msg: "Ingresar notas de Cuarta Unidad — Matemática 2do A (24 alumnos)" },
              { tipo: "info", msg: "Asistencia pendiente del 23/08/2025 — Matemática 3ro A" },
            ].map((p, i) => {
              const cls = p.tipo === "warning" ? "bg-warning-50 border-warning-200 text-warning-800" : "bg-info-50 border-info-200 text-info-800";
              return (
                <div key={i} className={`flex items-start gap-2 p-3 rounded-lg border text-xs ${cls}`}>
                  <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  {p.msg}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Mis Cursos ───────────────────────────────────────────────────────────────

function MisCursosView() {
  const [tab, setTab] = useState("Estudiantes");
  const alumnosDelCurso = ALUMNOS.filter(a => a.grado === "Tercero Básico" && a.seccion === "A");

  return (
    <div className="space-y-5">
      <SectionHeader title="Matemática — Tercero Básico A" subtitle="Ciclo 2025 · 28 alumnos inscritos" />

      <Tabs tabs={["Estudiantes", "Notas", "Asistencia", "Actividades"]} active={tab} onChange={setTab} />

      {tab === "Estudiantes" && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr><TH>Alumno</TH><TH>Carnet</TH><TH>Promedio</TH><TH>Estado académico</TH></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {alumnosDelCurso.map(a => (
                  <tr key={a.id} className="hover:bg-stone-50">
                    <TD><span className="font-medium text-stone-900">{a.nombre}</span></TD>
                    <TD><span className="font-mono-data text-stone-500 text-xs">{a.carnet}</span></TD>
                    <TD><span className={`font-mono-data font-semibold ${a.promedio >= 61 ? "text-success-700" : "text-danger-700"}`}>{a.promedio}</span></TD>
                    <TD><EstadoBadge aprobado={a.promedio >= 61} /></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {tab === "Actividades" && (
        <Card className="p-5">
          <div className="space-y-3">
            {[
              { titulo: "Examen Parcial — 1ra Unidad", fecha: "28/02/2025", tipo: "Examen", punteo: 40 },
              { titulo: "Tarea: Ejercicios de álgebra", fecha: "15/02/2025", tipo: "Tarea", punteo: 10 },
              { titulo: "Proyecto grupal — Geometría", fecha: "25/03/2025", tipo: "Proyecto", punteo: 20 },
            ].map(a => (
              <div key={a.titulo} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <div>
                  <p className="font-medium text-stone-900 text-sm">{a.titulo}</p>
                  <p className="text-xs text-stone-500">{a.fecha} · {a.tipo}</p>
                </div>
                <Badge variant="neutral">{a.punteo} pts</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Libreta de Notas ─────────────────────────────────────────────────────────

type NotasState = Record<string, { u1: string; u2: string; u3: string; u4: string }>;

function calcPromedio(notas: { u1: string; u2: string; u3: string; u4: string }): number | null {
  const vals = [notas.u1, notas.u2, notas.u3, notas.u4].map(v => parseFloat(v)).filter(n => !isNaN(n));
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function LibretaNotas() {
  const alumnos = ALUMNOS.filter(a => a.grado === "Tercero Básico" && a.seccion === "A");

  const initialNotas: NotasState = {};
  alumnos.forEach(a => {
    const base = NOTAS_3A.find(n => n.alumnoId === a.id);
    initialNotas[a.id] = {
      u1: base?.u1?.toString() ?? "",
      u2: base?.u2?.toString() ?? "",
      u3: base?.u3?.toString() ?? "",
      u4: base?.u4?.toString() ?? "",
    };
  });

  const [notas, setNotas] = useState<NotasState>(initialNotas);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [curso, setCurso] = useState("Matemática — 3ro Básico A");

  function handleChange(alumnoId: string, unidad: "u1" | "u2" | "u3" | "u4", val: string) {
    const key = `${alumnoId}-${unidad}`;
    const num = parseFloat(val);
    const newErrors = { ...errors };
    if (val !== "" && (isNaN(num) || num < 0 || num > 100)) {
      newErrors[key] = "Valor debe ser entre 0 y 100";
    } else {
      delete newErrors[key];
    }
    setErrors(newErrors);
    setNotas(prev => ({ ...prev, [alumnoId]: { ...prev[alumnoId], [unidad]: val } }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    if (Object.keys(errors).length > 0) return;
    setSaved(true);
    setDirty(false);
    setTimeout(() => setSaved(false), 3000);
  }

  const unidades: Array<{ key: "u1" | "u2" | "u3" | "u4"; label: string }> = [
    { key: "u1", label: "I Unidad" },
    { key: "u2", label: "II Unidad" },
    { key: "u3", label: "III Unidad" },
    { key: "u4", label: "IV Unidad" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SectionHeader title="Libreta de Notas" subtitle="Ingrese notas del 0 al 100 · 61 o más = aprobado" />
        <div className="flex gap-2 items-center shrink-0">
          {dirty && (
            <span className="text-xs text-warning-700 flex items-center gap-1 bg-warning-50 px-2 py-1 rounded-full border border-warning-200">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-600 animate-pulse" />Cambios sin guardar
            </span>
          )}
          {saved && (
            <span className="text-xs text-success-700 flex items-center gap-1 bg-success-50 px-2 py-1 rounded-full border border-success-200">
              <CheckCircle2 className="w-3.5 h-3.5" />Notas guardadas
            </span>
          )}
          <select value={curso} onChange={e => setCurso(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
            <option>Matemática — 3ro Básico A</option>
            <option>Matemática — 2do Básico A</option>
          </select>
          <Btn variant="primary" size="sm" icon={<Save className="w-4 h-4" />} onClick={handleSave} disabled={!dirty || Object.keys(errors).length > 0}>
            Guardar notas
          </Btn>
        </div>
      </div>

      {Object.values(errors).length > 0 && (
        <AlertBanner type="error" title="Valores fuera de rango" message="Una o más notas tienen un valor inválido. Corrija los campos marcados en rojo antes de guardar." />
      )}

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-52">Alumno</th>
                {unidades.map(u => (
                  <th key={u.key} className="px-3 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">
                    <div className="flex flex-col items-center gap-0.5">
                      <span>{u.label}</span>
                      <span className="text-[10px] font-normal text-stone-300 normal-case">(0–100)</span>
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Promedio</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">Estado</th>
              </tr>
              <tr className="border-b border-stone-100">
                <td className="sticky left-0 bg-white z-10 px-4 py-1.5 text-xs text-stone-400">Mostrando {alumnos.length} alumnos</td>
                {unidades.map(u => (
                  <td key={u.key} className="px-3 py-1.5 text-center">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary-300" />
                  </td>
                ))}
                <td /><td />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {alumnos.map(a => {
                const notasA = notas[a.id];
                const prom = calcPromedio(notasA);
                return (
                  <tr key={a.id} className="hover:bg-stone-50 transition-colors">
                    <td className="px-4 py-3 sticky left-0 bg-white hover:bg-stone-50 z-10">
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {a.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </div>
                        <span className="font-medium text-stone-900 whitespace-nowrap">{a.nombre}</span>
                      </div>
                    </td>
                    {unidades.map(u => {
                      const key = `${a.id}-${u.key}`;
                      const hasError = !!errors[key];
                      return (
                        <td key={u.key} className="px-3 py-2 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number" min="0" max="100" step="1"
                              value={notasA?.[u.key] ?? ""}
                              onChange={e => handleChange(a.id, u.key, e.target.value)}
                              placeholder="—"
                              aria-label={`Nota ${u.label} de ${a.nombre}`}
                              aria-invalid={hasError}
                              className={`w-16 text-center border rounded-lg px-2 py-1.5 text-sm font-mono-data font-semibold focus:outline-none focus:ring-2 transition-colors
                                ${hasError ? "border-danger-500 bg-danger-50 text-danger-800 focus:ring-danger-500" : "border-stone-200 bg-white text-stone-800 focus:ring-primary-700 focus:border-primary-700"}`}
                            />
                            {hasError && <span className="text-[10px] text-danger-700 text-center leading-tight">0–100</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-center">
                      {prom !== null ? (
                        <span className={`font-mono-data font-bold text-base ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>
                      ) : (
                        <span className="text-stone-300 font-mono-data">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {prom !== null ? (
                        <EstadoBadge aprobado={prom >= 61} />
                      ) : (
                        <span className="text-xs text-stone-400">Sin notas</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile: card per student */}
      <div className="md:hidden space-y-3">
        {alumnos.map(a => {
          const notasA = notas[a.id];
          const prom = calcPromedio(notasA);
          return (
            <Card key={a.id} className="p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-stone-900 text-sm">{a.nombre}</p>
                {prom !== null && <EstadoBadge aprobado={prom >= 61} />}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {unidades.map(u => {
                  const key = `${a.id}-${u.key}`;
                  const hasError = !!errors[key];
                  return (
                    <div key={u.key}>
                      <p className="text-xs text-stone-500 mb-1">{u.label}</p>
                      <input
                        type="number" min="0" max="100" step="1"
                        value={notasA?.[u.key] ?? ""}
                        onChange={e => handleChange(a.id, u.key, e.target.value)}
                        placeholder="—"
                        className={`w-full text-center border rounded-lg px-2 py-2 text-sm font-mono-data font-semibold focus:outline-none focus:ring-2
                          ${hasError ? "border-danger-500 bg-danger-50 text-danger-800" : "border-stone-200"}`}
                      />
                    </div>
                  );
                })}
              </div>
              {prom !== null && (
                <div className="mt-2 pt-2 border-t border-stone-100 flex justify-between text-sm">
                  <span className="text-stone-500">Promedio</span>
                  <span className={`font-mono-data font-bold ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>
                </div>
              )}
            </Card>
          );
        })}
        <Btn variant="primary" size="lg" className="w-full justify-center" icon={<Save className="w-4 h-4" />} onClick={handleSave}>
          Guardar notas
        </Btn>
      </div>
    </div>
  );
}

// ─── Asistencia ───────────────────────────────────────────────────────────────

type AsistenciaEstado = "presente" | "ausente" | "tarde" | "justificado";

function AsistenciaView() {
  const alumnos = ALUMNOS.filter(a => a.grado === "Tercero Básico" && a.seccion === "A");
  const [asistencia, setAsistencia] = useState<Record<string, AsistenciaEstado>>(
    Object.fromEntries(alumnos.map(a => [a.id, "presente"]))
  );
  const [saved, setSaved] = useState(false);

  const states: Array<{ key: AsistenciaEstado; label: string; color: string }> = [
    { key: "presente", label: "P", color: "bg-success-600 text-white" },
    { key: "ausente", label: "A", color: "bg-danger-600 text-white" },
    { key: "tarde", label: "T", color: "bg-warning-600 text-white" },
    { key: "justificado", label: "J", color: "bg-info-600 text-white" },
  ];

  function markAll(estado: AsistenciaEstado) {
    setAsistencia(Object.fromEntries(alumnos.map(a => [a.id, estado])));
  }

  const presente = Object.values(asistencia).filter(v => v === "presente").length;
  const ausente = Object.values(asistencia).filter(v => v === "ausente").length;

  return (
    <div className="space-y-5">
      <SectionHeader title="Pase de Lista" subtitle={`Matemática — 3ro Básico A · 25/08/2025`} />

      <Card className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-3 text-sm">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-success-600" />Presentes: <strong>{presente}</strong></span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger-600" />Ausentes: <strong>{ausente}</strong></span>
          </div>
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-stone-500">Marcar todos:</span>
            {states.map(s => (
              <button key={s.key} onClick={() => markAll(s.key)}
                className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${s.color} opacity-80 hover:opacity-100`}>
                {s.label === "P" ? "Presentes" : s.label === "A" ? "Ausentes" : s.label === "T" ? "Tarde" : "Justificados"}
              </button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full">
          <thead className="bg-stone-50 border-b border-stone-100">
            <tr><TH>Alumno</TH><TH className="text-center">Estado</TH></tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {alumnos.map(a => (
              <tr key={a.id} className="hover:bg-stone-50">
                <TD>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xs font-bold">
                      {a.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                    <span className="font-medium text-stone-900 text-sm">{a.nombre}</span>
                  </div>
                </TD>
                <TD className="text-center">
                  <div className="flex justify-center gap-1" role="group" aria-label={`Estado de ${a.nombre}`}>
                    {states.map(s => (
                      <button key={s.key} onClick={() => setAsistencia(prev => ({ ...prev, [a.id]: s.key }))}
                        aria-pressed={asistencia[a.id] === s.key}
                        aria-label={`Marcar ${s.key}`}
                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer
                          ${asistencia[a.id] === s.key ? s.color + " ring-2 ring-offset-1 ring-primary-300" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
                        {s.label}
                      </button>
                    ))}
                  </div>
                </TD>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex justify-end gap-2">
        {saved && <span className="text-xs text-success-700 flex items-center gap-1 py-2"><CheckCircle2 className="w-4 h-4" />Asistencia guardada</span>}
        <Btn variant="primary" icon={<Save className="w-4 h-4" />} onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 3000); }}>
          Guardar asistencia
        </Btn>
      </div>
    </div>
  );
}

// ─── Mi Horario ───────────────────────────────────────────────────────────────

function MiHorarioCat() {
  const misCursos = ["Matemática"];
  return (
    <div className="space-y-5">
      <SectionHeader title="Mi Horario" subtitle="Ciclo 2025 — Sede Central" />
      <Card className="overflow-hidden">
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
                    {DIAS.map(d => <td key={d} className="px-4 py-2 text-stone-300 italic text-center text-xs">Receso</td>)}
                  </tr>
                );
                return (
                  <tr key={bloque} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                    <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{bloque}</td>
                    {DIAS.map(d => {
                      const celda = HORARIO_3A[d]?.[bloque];
                      if (!celda || !misCursos.includes("Matemática")) return <td key={d} className="px-2 py-2" />;
                      if (celda.curso !== "Matemática") return <td key={d} className="px-2 py-2" />;
                      return (
                        <td key={d} className="px-2 py-2">
                          <div className="p-2 rounded-lg bg-primary-100 text-primary-800 border border-primary-200">
                            <p className="font-semibold text-xs">{celda.curso}</p>
                            <p className="text-[10px] opacity-70 mt-0.5">{celda.salon}</p>
                          </div>
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

// ─── Router ───────────────────────────────────────────────────────────────────

export default function Catedratico({ view }: { view: View }) {
  if (view === "cat-cursos") return <MisCursosView />;
  if (view === "cat-notas") return <LibretaNotas />;
  if (view === "cat-asistencia") return <AsistenciaView />;
  if (view === "cat-horario") return <MiHorarioCat />;
  return <DashboardCat />;
}

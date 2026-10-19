import { useEffect, useState } from "react";
import { BookOpen, Clock, Bell, CheckCircle2, ChevronRight, ClipboardList, CalendarDays } from "lucide-react";
import type { View } from "../types";
import {
  getPerfilAlumno, getMisNotasAlumno, getMiHorarioAlumno, getMiAsistenciaAlumno, getEventos, getMisNotificaciones,
  type PerfilAlumnoDto, type BoletinHijoDto, type ClaseAlumnoDto, type AsistenciaAlumnoDto, type EventoDto, type NotificacionDto,
} from "../lib/api";
import { Card, MetricCard, SectionHeader, Badge, EstadoBadge, TH, TD, AlertBanner, EmptyState } from "../components/Ui";
import CalendarioEventos from "../components/CalendarioEventos";
import HorarioSemanal, { DIAS, asuetosDeLaSemana } from "../components/HorarioSemanal";


const errorDe = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const colorNota = (n: number | null, minimo = 61) =>
  n === null ? "text-stone-300" : n >= minimo ? "text-success-700" : "text-danger-700";


// Carga una sola vez y expone loading/error (todas las pantallas son de solo lectura)
function useCarga<T>(cargar: () => Promise<T>, mensaje: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelado = false;
    cargar()
      .then((d) => { if (!cancelado) setData(d); })
      .catch((e) => { if (!cancelado) setError(errorDe(e, mensaje)); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { data, error, loading: data === null && !error };
}

function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: filas }, (_, i) => <div key={i} className="h-28 rounded-xl bg-stone-100 animate-pulse" />)}
    </div>
  );
}

const subtituloDe = (p: PerfilAlumnoDto | null) => (p ? `${p.grado} ${p.seccion} · ${p.sede} · Ciclo ${p.anioLectivo}` : undefined);

// La próxima clase a partir de ahora (hoy más tarde, o el siguiente día con clases)
function proximaClase(clases: ClaseAlumnoDto[]): { clase: ClaseAlumnoDto; hoy: boolean } | null {
  if (clases.length === 0) return null;
  const ahora = new Date();
  const diaHoy = ahora.getDay() === 0 ? 7 : ahora.getDay();
  const hora = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
  const hoy = clases.find((c) => c.diaSemana === diaHoy && c.horaFin > hora);
  if (hoy) return { clase: hoy, hoy: true };
  for (let i = 1; i <= 7; i++) {
    const dia = ((diaHoy - 1 + i) % 7) + 1;
    const c = clases.find((x) => x.diaSemana === dia);
    if (c) return { clase: c, hoy: false };
  }
  return null;
}

const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// ─── Dashboard ───────────────────────────────────────────────────────────────

function DashboardAlu({ onNavigate }: { onNavigate?: (v: View) => void }) {
  const perfil = useCarga(getPerfilAlumno, "No se pudo cargar tu información.");
  const notas = useCarga(getMisNotasAlumno, "No se pudieron cargar tus notas.");
  const horario = useCarga(getMiHorarioAlumno, "No se pudo cargar tu horario.");
  const asistencia = useCarga<AsistenciaAlumnoDto>(getMiAsistenciaAlumno, "No se pudo cargar tu asistencia.");
  const eventos = useCarga<EventoDto[]>(getEventos, "No se pudieron cargar los eventos.");
  const avisos = useCarga<NotificacionDto[]>(getMisNotificaciones, "No se pudieron cargar los avisos.");

  const error = perfil.error || notas.error;
  const boletin = notas.data;
  const proxima = horario.data ? proximaClase(horario.data) : null;
  const porcentaje = asistencia.data?.resumen.porcentaje;
  const hoy = hoyISO();
  const proximosEventos = (eventos.data ?? []).filter((e) => e.fecha.slice(0, 10) >= hoy).slice(0, 4);

  return (
    <div className="space-y-6">
      <SectionHeader title={perfil.data ? `Hola, ${perfil.data.nombre.split(" ")[0]}` : "Mi Panel"} subtitle={subtituloDe(perfil.data)} />

      {error && <AlertBanner type="error" message={error} />}

      {notas.loading ? <Cargando filas={4} /> : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Promedio general" value={boletin?.promedioGeneral != null ? Math.round(boletin.promedioGeneral) : "—"}
            sub={boletin?.cursosEvaluados ? "Unidades evaluadas" : "Sin notas aún"} icon={<BookOpen className="w-5 h-5" />}
            variant={boletin?.promedioGeneral == null ? "default" : boletin.promedioGeneral >= boletin.notaAprobacion ? "success" : "danger"} />
          <MetricCard label="Cursos aprobados" value={boletin ? `${boletin.cursosAprobados}/${boletin.cursos.length}` : "—"}
            sub="Según unidades evaluadas" icon={<CheckCircle2 className="w-5 h-5" />}
            variant={boletin && boletin.cursosAprobados < boletin.cursosEvaluados ? "warning" : "success"} />
          <MetricCard label="Asistencia" value={porcentaje !== undefined ? `${Math.round(porcentaje)}%` : "—"}
            sub={asistencia.data ? `${asistencia.data.resumen.ausentes} ausencias · ${asistencia.data.resumen.tardes} tardes` : undefined}
            icon={<ClipboardList className="w-5 h-5" />}
            variant={porcentaje === undefined ? "default" : porcentaje >= 80 ? "success" : "warning"} />
          <MetricCard label="Próxima clase" value={proxima ? proxima.clase.horaInicio : "—"}
            sub={proxima ? `${proxima.hoy ? "Hoy" : DIAS[proxima.clase.diaSemana]} · ${proxima.clase.curso}` : "Sin horario"}
            icon={<Clock className="w-5 h-5" />} />
        </div>
      )}

      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display font-semibold text-stone-800 text-base">Mis cursos</h3>
          {onNavigate && (
            <button onClick={() => onNavigate("alu-notas")} className="text-xs text-primary-700 hover:underline font-medium flex items-center gap-1 cursor-pointer">
              Ver notas completas <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {!boletin || boletin.cursos.length === 0 ? (
          <p className="text-sm text-stone-500">{notas.loading ? "Cargando…" : "Aún no tienes cursos asignados."}</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {boletin.cursos.slice(0, 6).map((c) => (
              <div key={c.cursoSeccionId} className="flex items-center justify-between p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 text-sm">{c.curso}</p>
                  <p className="text-xs text-stone-500">{c.catedratico}</p>
                </div>
                {c.promedio !== null ? (
                  <div className="text-right shrink-0">
                    <p className={`font-mono-data font-bold text-xl ${colorNota(c.promedio, boletin.notaAprobacion)}`}>{Math.round(c.promedio)}</p>
                    <EstadoBadge aprobado={!!c.aprobado} label={c.aprobado ? "✓" : "✗"} />
                  </div>
                ) : <span className="text-xs text-stone-400 shrink-0">Sin notas</span>}
              </div>
            ))}
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-stone-800 text-base">Próximos eventos</h3>
            {onNavigate && (
              <button onClick={() => onNavigate("alu-calendario")} className="text-xs text-primary-700 hover:underline font-medium flex items-center gap-1 cursor-pointer">
                Calendario <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {proximosEventos.length === 0 ? (
            <p className="text-sm text-stone-500">{eventos.loading ? "Cargando…" : "No hay eventos próximos."}</p>
          ) : (
            <div className="space-y-2">
              {proximosEventos.map((e) => (
                <div key={e.eventoId} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <CalendarDays className="w-3.5 h-3.5 text-primary-600 shrink-0" />
                    <span className="font-medium text-stone-800 truncate">{e.nombre}</span>
                  </div>
                  <span className="font-mono-data shrink-0 text-stone-600">{e.fecha.slice(0, 10).split("-").reverse().join("/")}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-3">Avisos recientes</h3>
          {(avisos.data ?? []).length === 0 ? (
            <p className="text-sm text-stone-500">{avisos.loading ? "Cargando…" : "No tienes avisos."}</p>
          ) : (
            <div className="space-y-2.5">
              {avisos.data!.slice(0, 4).map((n) => (
                <div key={n.notificacionId} className="flex items-start gap-2.5">
                  <Bell className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${n.leida ? "text-stone-300" : "text-primary-500"}`} />
                  <div className="min-w-0">
                    <p className={`text-sm ${n.leida ? "text-stone-600" : "text-stone-900 font-medium"}`}>{n.titulo}</p>
                    <p className="text-[10px] text-stone-400 mt-0.5">{new Date(n.fechaEnvio).toLocaleDateString("es-GT")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Notas ───────────────────────────────────────────────────────────────────

function MisNotas() {
  const perfil = useCarga(getPerfilAlumno, "No se pudo cargar tu información.");
  const { data: boletin, error, loading } = useCarga(getMisNotasAlumno, "No se pudieron cargar tus notas.");
  const unidades = ["I", "II", "III", "IV"];
  const minimo = boletin?.notaAprobacion ?? 61;

  return (
    <div className="space-y-5">
      <SectionHeader title="Mis Notas" subtitle={subtituloDe(perfil.data)} />

      {error && <AlertBanner type="error" message={error} />}

      {loading ? <Cargando filas={3} /> : boletin && (boletin.cursos.length === 0 ? (
        <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados" description="Tu sección todavía no tiene cursos registrados." />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {boletin.cursos.map((c) => (
              <Card key={c.cursoSeccionId} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-display font-semibold text-stone-900">{c.curso}</p>
                    <p className="text-xs text-stone-500">{c.catedratico}</p>
                    {c.seccionAnterior && <Badge variant="neutral" className="mt-1">Sección anterior: {c.seccionAnterior}</Badge>}
                  </div>
                  {c.aprobado !== null && <EstadoBadge aprobado={c.aprobado} />}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {c.unidades.map((u) => (
                    <div key={u.numero} className="flex flex-col items-center">
                      <span className="text-[10px] text-stone-400 mb-1">U{u.numero}</span>
                      {u.nota !== null ? (
                        <span className={`font-mono-data font-bold text-sm px-2 py-1 rounded-lg
                          ${u.nota >= minimo ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}>
                          {Math.round(u.nota)}
                        </span>
                      ) : <span className="text-stone-300 font-mono-data text-sm px-2 py-1">—</span>}
                    </div>
                  ))}
                </div>
                {c.promedio !== null && (
                  <div className="mt-3 pt-2 border-t border-stone-100 flex justify-between text-sm">
                    <span className="text-stone-500">Promedio</span>
                    <span className={`font-mono-data font-bold text-base ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Desktop table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200">
                    <TH>Curso</TH>
                    <TH>Catedrático</TH>
                    {unidades.map((u) => <TH key={u} className="text-center">Unidad {u}</TH>)}
                    <TH className="text-center">Promedio</TH>
                    <TH className="text-center">Estado</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-50">
                  {boletin.cursos.map((c) => (
                    <tr key={c.cursoSeccionId} className="hover:bg-stone-50 transition-colors">
                      <TD>
                        <span className="font-medium text-stone-900">{c.curso}</span>
                        {c.seccionAnterior && <Badge variant="neutral" className="ml-2">Sección anterior: {c.seccionAnterior}</Badge>}
                      </TD>
                      <TD><span className="text-stone-500 text-xs">{c.catedratico}</span></TD>
                      {c.unidades.map((u) => (
                        <TD key={u.numero} className="text-center">
                          {u.nota !== null ? (
                            <span title={`Zona ${u.zona ?? 0} + Examen ${u.examen ?? 0}`}
                              className={`inline-block font-mono-data font-semibold text-sm px-2 py-0.5 rounded-md
                                ${u.nota >= minimo ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}
                              aria-label={u.nota >= minimo ? `${u.nota} — aprobado` : `${u.nota} — reprobado`}>
                              {Math.round(u.nota)}
                            </span>
                          ) : <span className="text-stone-300 font-mono-data">—</span>}
                        </TD>
                      ))}
                      <TD className="text-center">
                        {c.promedio !== null
                          ? <span className={`font-mono-data font-bold text-base ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
                          : "—"}
                      </TD>
                      <TD className="text-center">
                        {c.aprobado !== null ? <EstadoBadge aprobado={c.aprobado} /> : <span className="text-xs text-stone-400">Pendiente</span>}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-stone-400 text-center">
            Cada unidad vale 100 puntos (zona + examen) · {minimo} o más = aprobado · El promedio cuenta solo las unidades ya evaluadas.
          </p>
        </>
      ))}
    </div>
  );
}

// ─── Horario ─────────────────────────────────────────────────────────────────

function MiHorarioAlu() {
  const perfil = useCarga(getPerfilAlumno, "No se pudo cargar tu información.");
  const { data: clases, error, loading } = useCarga(getMiHorarioAlumno, "No se pudo cargar tu horario.");
  const eventos = useCarga<EventoDto[]>(getEventos, "No se pudieron cargar los eventos.");

  return (
    <div className="space-y-5">
      <SectionHeader title="Mi Horario" subtitle={subtituloDe(perfil.data)} />
      {error && <AlertBanner type="error" message={error} />}
      {loading ? <Cargando filas={2} /> : clases && <HorarioSemanal clases={clases} asuetos={asuetosDeLaSemana(eventos.data ?? [])} />}
    </div>
  );
}

// ─── Calendario ──────────────────────────────────────────────────────────────

function CalendarioAlu() {
  return <CalendarioEventos subtitle="Eventos y actividades de tu sede" />;
}

export default function Alumno({ view, onNavigate }: { view: View; onNavigate?: (v: View) => void }) {
  if (view === "alu-notas") return <MisNotas />;
  if (view === "alu-horario") return <MiHorarioAlu />;
  if (view === "alu-calendario") return <CalendarioAlu />;
  return <DashboardAlu onNavigate={onNavigate} />;
}

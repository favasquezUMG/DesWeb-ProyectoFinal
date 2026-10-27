import { useEffect, useState } from "react";
import { BookOpen, Clock } from "../components/Iconos";
import type { View } from "../types";
import {
  getPerfilAlumno, getMisNotasAlumno, getMiHorarioAlumno, getMiAsistenciaAlumno, getEventos, getMisNotificaciones, getTableroTareas,
  type PerfilAlumnoDto, type BoletinHijoDto, type ClaseAlumnoDto, type AsistenciaAlumnoDto, type EventoDto, type NotificacionDto,
} from "../lib/api";
import { Card, SectionHeader, Badge, EstadoBadge, TH, TD, AlertBanner, EmptyState, CursoMarca, colorDeCurso, Anillo, FechaBloque, CardTitulo, LinkAccion } from "../components/Ui";
import CalendarioEventos from "../components/CalendarioEventos";
import HorarioSemanal, { DIAS, asuetosDeLaSemana } from "../components/HorarioSemanal";
import TableroTareas, { textoLimite } from "../components/TableroTareas";
import { getSession } from "../lib/auth";


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
      {Array.from({ length: filas }, (_, i) => <div key={i} className="h-28 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}
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
  const tareas = useCarga(() => getTableroTareas(Number(getSession()?.user.id)), "No se pudieron cargar tus tareas.");

  const error = perfil.error || notas.error;
  const boletin = notas.data;
  const proxima = horario.data ? proximaClase(horario.data) : null;
  const porcentaje = asistencia.data?.resumen.porcentaje;
  const hoy = hoyISO();
  const proximosEventos = (eventos.data ?? []).filter((e) => e.fecha.slice(0, 10) >= hoy).slice(0, 4);
  // Lo que falta entregar: primero lo devuelto y lo atrasado (si aún se acepta), luego por fecha límite
  const porEntregar = (tareas.data?.tareas ?? [])
    .filter((t) => t.estado === "Pendiente" || t.estado === "Devuelta" || (t.estado === "Atrasada" && t.permiteAtrasadas))
    .slice(0, 4);

  return (
    <div className="space-y-6">
      <SectionHeader title={perfil.data ? `Hola, ${perfil.data.nombre.split(" ")[0]}` : "Mi Panel"} subtitle={subtituloDe(perfil.data)} />

      {error && <AlertBanner type="error" message={error} />}

      {notas.loading ? <Cargando filas={4} /> : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Promedio + aprobados */}
          <Card className="p-6 lg:col-span-2 flex flex-col sm:flex-row gap-6 sm:items-center">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-stone-500">Promedio general</p>
              <p className={`font-display font-bold text-[4.5rem] leading-none tabular-nums tracking-tight mt-1 ${boletin?.promedioGeneral == null ? "text-stone-300" : boletin.promedioGeneral >= boletin.notaAprobacion ? "text-stone-900" : "text-danger-700"}`}>
                {boletin?.promedioGeneral != null ? Math.round(boletin.promedioGeneral) : "—"}
              </p>
              <p className="text-sm text-stone-500 mt-2">{boletin?.cursosEvaluados ? "Con las unidades evaluadas hasta hoy" : "Aún no hay notas"}</p>
            </div>
            {boletin && boletin.cursos.length > 0 && (
              <div className="sm:w-64 shrink-0">
                <p className="text-sm font-semibold text-stone-700 mb-2.5">
                  <span className="font-display text-2xl font-bold text-stone-900 tabular-nums">{boletin.cursosAprobados}</span>
                  <span className="text-stone-400"> de {boletin.cursos.length}</span> cursos aprobados
                </p>
                <div className="flex gap-1" aria-hidden="true">
                  {boletin.cursos.map((c) => (
                    <span key={c.cursoSeccionId} title={c.curso}
                      className={`h-3 flex-1 rounded-full ${c.aprobado === null ? "bg-stone-200" : c.aprobado ? "bg-primary-700" : "bg-danger-600"}`} />
                  ))}
                </div>
              </div>
            )}
          </Card>

          {/* Próxima clase */}
          {(() => {
            const col = proxima ? colorDeCurso(proxima.clase.curso) : null;
            return (
              <div className={`rounded-[20px] p-6 relative overflow-hidden textile-pattern ${col ? `${col.solid} ${col.fg}` : "bg-stone-400 text-white"}`}>
                <span className="absolute -right-6 -bottom-8 font-display font-extrabold text-[9rem] leading-none opacity-[0.14] select-none" aria-hidden="true">
                  {proxima ? proxima.clase.curso.charAt(0) : ""}
                </span>
                <div className="relative">
                  <p className="text-sm font-semibold opacity-80 flex items-center gap-1.5"><Clock className="w-4 h-4" />
                    {proxima ? (proxima.hoy ? "Tu próxima clase, hoy" : `Tu próxima clase, el ${DIAS[proxima.clase.diaSemana].toLowerCase()}`) : "Próxima clase"}
                  </p>
                  <p className="font-display font-bold text-5xl leading-none mt-4 tabular-nums">{proxima ? proxima.clase.horaInicio : "—"}</p>
                  <p className="font-display font-bold text-xl mt-3 leading-tight">{proxima ? proxima.clase.curso : "Sin horario publicado"}</p>
                  {proxima && <p className="text-sm opacity-80 mt-0.5">{proxima.clase.catedratico}</p>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6 lg:col-span-2">
          <CardTitulo titulo="Mis cursos" accion={onNavigate && <LinkAccion onClick={() => onNavigate("alu-notas")}>Ver todas las notas</LinkAccion>} />
          {!boletin || boletin.cursos.length === 0 ? (
            <p className="text-sm text-stone-500">{notas.loading ? "Cargando…" : "Aún no tienes cursos asignados."}</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {boletin.cursos.slice(0, 8).map((c) => {
                return (
                  <div key={c.cursoSeccionId} className="flex items-center gap-3 p-3 rounded-2xl bg-sand-100">
                    <CursoMarca nombre={c.curso} />
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-stone-900 text-[15px] truncate">{c.curso}</p>
                      <p className="text-[13px] text-stone-600 truncate">{c.catedratico}</p>
                    </div>
                    {c.promedio !== null ? (
                      <span className={`font-display font-bold text-2xl tabular-nums shrink-0 ${c.aprobado ? "text-stone-900" : "text-danger-700"}`}
                        aria-label={`Promedio ${Math.round(c.promedio)}, ${c.aprobado ? "aprobado" : "reprobado"}`}>
                        {Math.round(c.promedio)}
                      </span>
                    ) : <span className="text-xs font-semibold text-stone-500 shrink-0">Sin notas</span>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-6 flex flex-col">
          <CardTitulo titulo="Asistencia" />
          {porcentaje === undefined ? (
            <p className="text-sm text-stone-500">{asistencia.loading ? "Cargando…" : "Sin registros todavía."}</p>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
              <Anillo valor={porcentaje} size={132} grosor={12} color={porcentaje >= 80 ? "#0f7b5f" : "#d99e00"}>
                <span className="font-display font-bold text-3xl tabular-nums text-stone-900">{Math.round(porcentaje)}%</span>
              </Anillo>
              {asistencia.data && (
                <div className="flex gap-5 text-sm">
                  <span><span className="font-display font-bold text-lg text-stone-900 tabular-nums">{asistencia.data.resumen.ausentes}</span> <span className="text-stone-500">ausencias</span></span>
                  <span><span className="font-display font-bold text-lg text-stone-900 tabular-nums">{asistencia.data.resumen.tardes}</span> <span className="text-stone-500">tardes</span></span>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-6">
          <CardTitulo titulo="Tareas por entregar" accion={onNavigate && <LinkAccion onClick={() => onNavigate("alu-tareas")}>Ver tablero</LinkAccion>} />
          {porEntregar.length === 0 ? (
            <p className="text-sm text-stone-500">{tareas.loading ? "Cargando…" : "No tienes tareas pendientes."}</p>
          ) : (
            <ul className="space-y-3">
              {porEntregar.map((t) => {
                const limite = textoLimite(t.fechaLimite);
                return (
                  <li key={t.actividadId} className="flex items-center gap-3">
                    <CursoMarca nombre={t.curso} size="sm" />
                    <div className="min-w-0">
                      <p className="font-semibold text-stone-900 text-[15px] truncate">{t.nombre}</p>
                      <p className={`text-[13px] ${t.estado === "Devuelta" || t.estado === "Atrasada" || limite.urgente ? "text-danger-700 font-semibold" : "text-stone-500"}`}>
                        {t.estado === "Devuelta" ? "Devuelta para corregir" : limite.texto}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <CardTitulo titulo="Próximos eventos" accion={onNavigate && <LinkAccion onClick={() => onNavigate("alu-calendario")}>Abrir calendario</LinkAccion>} />
          {proximosEventos.length === 0 ? (
            <p className="text-sm text-stone-500">{eventos.loading ? "Cargando…" : "No hay eventos próximos."}</p>
          ) : (
            <ul className="space-y-3">
              {proximosEventos.map((e, i) => (
                <li key={e.eventoId} className="flex items-center gap-3.5">
                  <FechaBloque iso={e.fecha} tono={i === 0 ? "primary" : "neutral"} />
                  <div className="min-w-0">
                    <p className="font-semibold text-stone-900 text-[15px] truncate">{e.nombre}</p>
                    <p className="text-[13px] text-stone-500">{e.tipoEvento === "Academico" ? "Académico" : e.tipoEvento === "Reunion" ? "Reunión" : e.tipoEvento}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6">
          <CardTitulo titulo="Avisos recientes" />
          {(avisos.data ?? []).length === 0 ? (
            <p className="text-sm text-stone-500">{avisos.loading ? "Cargando…" : "No tienes avisos."}</p>
          ) : (
            <ul className="divide-y divide-stone-100 -my-2">
              {avisos.data!.slice(0, 4).map((n) => (
                <li key={n.notificacionId} className="flex items-start gap-3 py-3">
                  <span className={`w-2.5 h-2.5 mt-1.5 rounded-full shrink-0 ${n.leida ? "bg-stone-200" : "bg-action-500"}`} aria-label={n.leida ? "Leído" : "Sin leer"} />
                  <div className="min-w-0">
                    <p className={`text-[15px] leading-snug ${n.leida ? "text-stone-600" : "text-stone-900 font-semibold"}`}>{n.titulo}</p>
                    <p className="text-xs text-stone-400 mt-1">{new Date(n.fechaEnvio).toLocaleDateString("es-GT", { day: "numeric", month: "long" })}</p>
                  </div>
                </li>
              ))}
            </ul>
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
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-start gap-3 min-w-0">
                  <CursoMarca nombre={c.curso} />
                  <div className="min-w-0">
                    <p className="font-display font-bold text-stone-900 text-[17px] leading-tight">{c.curso}</p>
                    <p className="text-xs text-stone-500">{c.catedratico}</p>
                    {c.seccionAnterior && <Badge variant="neutral" className="mt-1">Sección anterior: {c.seccionAnterior}</Badge>}
                  </div>
                  </div>
                  {c.aprobado !== null && <EstadoBadge aprobado={c.aprobado} />}
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {c.unidades.map((u) => (
                    <div key={u.numero} className="flex flex-col items-center">
                      <span className="text-xs font-semibold text-stone-500 mb-1.5">Unidad {u.numero}</span>
                      {u.nota !== null ? (
                        <span className={`font-display font-bold text-lg tabular-nums w-full text-center py-1.5 rounded-xl
                          ${u.nota >= minimo ? "bg-sand-100 text-stone-900" : "bg-danger-50 text-danger-700"}`}>
                          {Math.round(u.nota)}
                        </span>
                      ) : <span className="w-full text-center py-1.5 rounded-xl border-[1.5px] border-dashed border-stone-200 text-stone-300 font-display text-lg">—</span>}
                    </div>
                  ))}
                </div>
                {c.promedio !== null && (
                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-baseline justify-between text-sm">
                    <span className="font-semibold text-stone-600">Promedio</span>
                    <span className={`font-display font-bold text-2xl tabular-nums ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
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
                  <tr>
                    <TH>Curso</TH>
                    {unidades.map((u) => <TH key={u} className="text-center">Unidad {u}</TH>)}
                    <TH className="text-center">Promedio</TH>
                    <TH className="text-center">Estado</TH>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {boletin.cursos.map((c) => (
                    <tr key={c.cursoSeccionId} className="hover:bg-sand-50 transition-colors">
                      <TD>
                        <div className="flex items-center gap-3">
                          <CursoMarca nombre={c.curso} size="sm" />
                          <div className="min-w-0">
                            <p className="font-bold text-stone-900">{c.curso}</p>
                            <p className="text-[13px] text-stone-500">{c.catedratico}</p>
                          </div>
                          {c.seccionAnterior && <Badge variant="neutral">Sección anterior: {c.seccionAnterior}</Badge>}
                        </div>
                      </TD>
                      {c.unidades.map((u) => (
                        <TD key={u.numero} className="text-center">
                          {u.nota !== null ? (
                            <span title={`Zona ${u.zona ?? 0} + Examen ${u.examen ?? 0}`}
                              className={`inline-flex items-center justify-center min-w-11 h-9 px-2 font-display font-bold text-base tabular-nums rounded-xl
                                ${u.nota >= minimo ? "bg-sand-100 text-stone-900" : "bg-danger-50 text-danger-700"}`}
                              aria-label={u.nota >= minimo ? `${u.nota} — aprobado` : `${u.nota} — reprobado`}>
                              {Math.round(u.nota)}
                            </span>
                          ) : <span className="text-stone-300 font-mono-data">—</span>}
                        </TD>
                      ))}
                      <TD className="text-center">
                        {c.promedio !== null
                          ? <span className={`font-display font-bold text-2xl tabular-nums ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
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

          <p className="text-[13px] text-stone-500 text-center max-w-xl mx-auto leading-relaxed">
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

function MisTareas() {
  const alumnoId = Number(getSession()?.user.id);
  return (
    <div className="space-y-5">
      <SectionHeader title="Mis Tareas" subtitle="Entregue sus tareas en línea y vea cuáles ya fueron calificadas." />
      <TableroTareas alumnoId={alumnoId} />
    </div>
  );
}

export default function Alumno({ view, onNavigate }: { view: View; onNavigate?: (v: View) => void }) {
  if (view === "alu-notas") return <MisNotas />;
  if (view === "alu-tareas") return <MisTareas />;
  if (view === "alu-horario") return <MiHorarioAlu />;
  if (view === "alu-calendario") return <CalendarioAlu />;
  return <DashboardAlu onNavigate={onNavigate} />;
}

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "./Iconos";
import { Card, SectionHeader, AlertBanner, EmptyState, FechaBloque } from "./Ui";
import { getEventos, type EventoDto } from "../lib/api";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIPO_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  Festivo:   { label: "Festivo o asueto", dot: "bg-subject-science",  badge: "bg-[#e3f1ec] text-[#0b6650]" },
  Academico: { label: "Académico",        dot: "bg-primary-600",     badge: "bg-primary-50 text-primary-800" },
  Deportivo: { label: "Deportivo",        dot: "bg-action-500",      badge: "bg-action-50 text-action-800" },
  Reunion:   { label: "Reunión",          dot: "bg-subject-english", badge: "bg-[#efe5f2] text-[#5a2468]" },
};
const OTRO = { label: "Otro", dot: "bg-stone-400", badge: "bg-stone-100 text-stone-700" };
const cfg = (tipo: string) => TIPO_CFG[tipo] ?? { ...OTRO, label: tipo };

// La fecha viene como @db.Date (medianoche UTC): se usa solo la parte YYYY-MM-DD
const diaISO = (fecha: string) => fecha.slice(0, 10);
const pad = (n: number) => String(n).padStart(2, "0");

function hoyLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatLargo(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
}

export default function CalendarioEventos({ subtitle }: { subtitle?: string }) {
  const [eventos, setEventos] = useState<EventoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const hoy = hoyLocalISO();
  const [mes, setMes] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [diaSel, setDiaSel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEventos()
      .then((data) => { if (!cancelled) setEventos(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los eventos."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const porDia = useMemo(() => {
    const map = new Map<string, EventoDto[]>();
    for (const e of eventos) {
      const k = diaISO(e.fecha);
      map.set(k, [...(map.get(k) ?? []), e]);
    }
    return map;
  }, [eventos]);

  const prefijoMes = `${mes.y}-${pad(mes.m + 1)}`;
  const delMes = eventos.filter((e) => diaISO(e.fecha).startsWith(prefijoMes));
  const proximos = eventos.filter((e) => diaISO(e.fecha) >= hoy).slice(0, 5);
  const listado = diaSel ? porDia.get(diaSel) ?? [] : delMes;

  const diasEnMes = new Date(mes.y, mes.m + 1, 0).getDate();
  const primerDia = new Date(mes.y, mes.m, 1).getDay();
  const celdas = Array.from({ length: primerDia + diasEnMes }, (_, i) => (i < primerDia ? null : i - primerDia + 1));

  function moverMes(delta: number) {
    setDiaSel(null);
    setMes(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-5 h-5 border-[2.5px] border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando calendario…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Calendario Escolar" subtitle={subtitle ?? "Eventos, asuetos y actividades del colegio"} />
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <div className="flex flex-wrap gap-2">
        {Object.values(TIPO_CFG).map((t) => (
          <span key={t.label} className="flex items-center gap-2 text-[13px] font-semibold text-stone-600 mr-3">
            <span className={`w-3 h-3 rounded-full ${t.dot}`} />{t.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-bold text-stone-900 text-2xl">{MESES[mes.m]} <span className="text-stone-400">{mes.y}</span></h3>
            <div className="flex gap-1.5">
              <button onClick={() => moverMes(-1)} className="w-9 h-9 rounded-full border-[1.5px] border-stone-200 flex items-center justify-center text-stone-600 hover:border-stone-900 hover:text-stone-900 cursor-pointer" aria-label="Mes anterior">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => moverMes(1)} className="w-9 h-9 rounded-full border-[1.5px] border-stone-200 flex items-center justify-center text-stone-600 hover:border-stone-900 hover:text-stone-900 cursor-pointer" aria-label="Mes siguiente">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS.map((d) => <div key={d} className="text-left pl-2 text-xs font-bold text-stone-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {celdas.map((dia, i) => {
              if (!dia) return <div key={i} />;
              const iso = `${prefijoMes}-${pad(dia)}`;
              const evts = porDia.get(iso) ?? [];
              const esHoy = iso === hoy;
              const sel = iso === diaSel;
              return (
                <button key={i} onClick={() => setDiaSel(sel ? null : iso)}
                  className={`min-h-[68px] p-1.5 rounded-xl text-left flex flex-col transition-colors cursor-pointer
                    ${sel ? "bg-primary-800 text-white" : evts.length > 0 ? "bg-sand-100 hover:bg-stone-200/70" : "hover:bg-sand-100"}`}
                  aria-label={`${dia} de ${MESES[mes.m]}${evts.length ? `, ${evts.length} evento(s)` : ""}`}>
                  <span className={`text-sm w-7 h-7 flex items-center justify-center rounded-full font-semibold tabular-nums ${esHoy ? "bg-action-500 text-white font-bold" : sel ? "text-white" : "text-stone-700"}`}>{dia}</span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {evts.map((e) => <span key={e.eventoId} className={`w-2 h-2 rounded-full ${cfg(e.tipoEvento).dot}`} />)}
                  </div>
                  {evts[0] && <span className={`hidden md:block text-[11px] font-semibold leading-tight truncate w-full mt-1 ${sel ? "text-white/85" : "text-stone-600"}`}>{evts[0].nombre}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-bold text-stone-900 text-lg mb-4">Próximos eventos</h3>
          {proximos.length === 0 ? (
            <p className="text-sm text-stone-400">No hay eventos próximos.</p>
          ) : (
            <ul className="space-y-3.5">
              {proximos.map((e, i) => (
                <li key={e.eventoId} className="flex items-center gap-3">
                  <FechaBloque iso={e.fecha} tono={i === 0 ? "action" : "neutral"} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-stone-900 leading-snug">{e.nombre}</p>
                    <p className="text-[13px] text-stone-500 flex items-center gap-1.5 mt-0.5"><span className={`w-2 h-2 rounded-full ${cfg(e.tipoEvento).dot}`} />{cfg(e.tipoEvento).label}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div>
        <h3 className="font-display font-bold text-stone-900 text-xl mb-3">
          {diaSel ? <span className="capitalize">{formatLargo(diaSel)}</span> : `Eventos de ${MESES[mes.m].toLowerCase()}`}
        </h3>
        {listado.length === 0 ? (
          <EmptyState icon={<CalendarDays className="w-10 h-10" />} title="Sin eventos" description={diaSel ? "No hay eventos este día." : "No hay eventos registrados este mes."} />
        ) : (
          <div className="space-y-2">
            {listado.map((e) => {
              const c = cfg(e.tipoEvento);
              return (
                <div key={e.eventoId} className="flex items-start gap-4 px-4 py-4 rounded-[20px] bg-white border border-stone-200/80">
                  <FechaBloque iso={e.fecha} />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-[15px] text-stone-900">{e.nombre}</p>
                    {e.descripcion && <p className="text-sm text-stone-600 mt-0.5">{e.descripcion}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.badge}`}>{c.label}</span>
                      <span className="text-xs font-medium text-stone-500">{e.sede ? e.sede.nombre : "Todas las sedes"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

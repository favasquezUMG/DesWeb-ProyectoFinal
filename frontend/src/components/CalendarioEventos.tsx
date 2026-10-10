import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, SectionHeader, AlertBanner, EmptyState } from "./Ui";
import { getEventos, type EventoDto } from "../lib/api";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIPO_CFG: Record<string, { label: string; dot: string; badge: string }> = {
  Festivo:   { label: "Festivo / Asueto", dot: "bg-success-600", badge: "bg-success-50 text-success-800 border-success-100" },
  Academico: { label: "Académico",        dot: "bg-primary-600", badge: "bg-primary-50 text-primary-800 border-primary-200" },
  Deportivo: { label: "Deportivo",        dot: "bg-action-500",  badge: "bg-action-50 text-action-800 border-action-200" },
  Reunion:   { label: "Reunión",          dot: "bg-info-600",    badge: "bg-info-50 text-info-800 border-info-100" },
};
const OTRO = { label: "Otro", dot: "bg-stone-400", badge: "bg-stone-50 text-stone-700 border-stone-200" };
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
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
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
          <span key={t.label} className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${t.badge}`}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-4 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => moverMes(-1)} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label="Mes anterior">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <h3 className="font-display font-semibold text-stone-800">{MESES[mes.m]} {mes.y}</h3>
            <button onClick={() => moverMes(1)} className="p-1.5 rounded-md text-stone-500 hover:bg-stone-100 cursor-pointer" aria-label="Mes siguiente">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {DIAS.map((d) => <div key={d} className="text-center text-[11px] font-semibold text-stone-400 py-1">{d}</div>)}
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
                  className={`min-h-14 p-1 rounded-lg border text-left flex flex-col transition-colors cursor-pointer
                    ${sel ? "border-primary-600 bg-primary-50" : evts.length > 0 ? "border-stone-200 hover:bg-stone-50" : "border-transparent hover:bg-stone-50"}`}
                  aria-label={`${dia} de ${MESES[mes.m]}${evts.length ? `, ${evts.length} evento(s)` : ""}`}>
                  <span className={`text-xs w-6 h-6 flex items-center justify-center rounded-full ${esHoy ? "bg-primary-700 text-white font-bold" : "text-stone-700"}`}>{dia}</span>
                  <div className="flex flex-wrap gap-0.5 mt-auto">
                    {evts.map((e) => <span key={e.eventoId} className={`w-1.5 h-1.5 rounded-full ${cfg(e.tipoEvento).dot}`} />)}
                  </div>
                  {evts[0] && <span className="hidden md:block text-[10px] leading-tight text-stone-600 truncate w-full">{evts[0].nombre}</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="font-display font-semibold text-stone-800 text-sm mb-3">Próximos eventos</h3>
          {proximos.length === 0 ? (
            <p className="text-sm text-stone-400">No hay eventos próximos.</p>
          ) : (
            <div className="space-y-2.5">
              {proximos.map((e) => (
                <div key={e.eventoId} className="flex items-start gap-2.5">
                  <span className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${cfg(e.tipoEvento).dot}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{e.nombre}</p>
                    <p className="text-xs text-stone-500 capitalize">{formatLargo(diaISO(e.fecha))}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div>
        <h3 className="font-display font-semibold text-stone-800 text-sm mb-2">
          {diaSel ? <span className="capitalize">{formatLargo(diaSel)}</span> : `Eventos de ${MESES[mes.m].toLowerCase()}`}
        </h3>
        {listado.length === 0 ? (
          <EmptyState icon={<CalendarDays className="w-10 h-10" />} title="Sin eventos" description={diaSel ? "No hay eventos este día." : "No hay eventos registrados este mes."} />
        ) : (
          <div className="space-y-2">
            {listado.map((e) => {
              const c = cfg(e.tipoEvento);
              return (
                <div key={e.eventoId} className={`flex items-start justify-between gap-3 px-4 py-3 rounded-xl border ${c.badge}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{e.nombre}</p>
                    {e.descripcion && <p className="text-xs opacity-80 mt-0.5">{e.descripcion}</p>}
                    <p className="text-[11px] opacity-70 mt-1">{c.label} · {e.sede ? e.sede.nombre : "Todas las sedes"}</p>
                  </div>
                  <span className="font-mono-data text-xs shrink-0">{diaISO(e.fecha).split("-").reverse().join("/")}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

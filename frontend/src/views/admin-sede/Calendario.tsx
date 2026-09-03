import { useState } from "react";
import { Plus, Bell, X } from "lucide-react";
import { EVENTOS } from "../../data";
import { Card, SectionHeader, Btn } from "../../components/Ui";

// ─── Calendario ───────────────────────────────────────────────────────────────

// ─── Helpers de calendario ───────────────────────────────────────────────────

type TipoEvento = "clases" | "examen" | "descanso" | "actividad" | "asueto" | "festivo" | "institucional";

const TIPO_CFG: Record<TipoEvento, { label: string; dot: string; badge: string; bg: string }> = {
  clases:       { label: "Clases normales",    dot: "bg-stone-400",    badge: "bg-stone-100 text-stone-700 border-stone-200",    bg: "bg-stone-50" },
  examen:       { label: "Semana de exámenes", dot: "bg-purple-500",   badge: "bg-purple-100 text-purple-800 border-purple-200",  bg: "bg-purple-50" },
  descanso:     { label: "Descanso / Vacaciones", dot: "bg-amber-400", badge: "bg-amber-100 text-amber-800 border-amber-200",     bg: "bg-amber-50" },
  actividad:    { label: "Actividad / Recordatorio", dot: "bg-info-500", badge: "bg-info-100 text-info-800 border-info-200",     bg: "bg-info-50" },
  asueto:       { label: "Asueto",            dot: "bg-warning-500",   badge: "bg-warning-100 text-warning-800 border-warning-200", bg: "bg-warning-50" },
  festivo:      { label: "Día festivo",        dot: "bg-success-500",  badge: "bg-success-100 text-success-800 border-success-200", bg: "bg-success-50" },
  institucional:{ label: "Evento institucional", dot: "bg-primary-600", badge: "bg-primary-100 text-primary-800 border-primary-200", bg: "bg-primary-50" },
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"] as const;
const DIAS_SEM = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"] as const;

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function eventosEnDia(eventos: typeof import("../../data").EVENTOS, dateStr: string) {
  return eventos.filter(e => {
    if (e.fecha === dateStr) return true;
    if (e.fechaFin) {
      return dateStr >= e.fecha && dateStr <= e.fechaFin;
    }
    return false;
  });
}

interface NuevoEvento {
  titulo: string;
  tipo: TipoEvento;
  fecha: string;
  fechaFin: string;
  recordatorio: boolean;
}

function MiniCalendario({ year, month, eventos, onDayClick, selectedDay }: {
  year: number;
  month: number;
  eventos: typeof import("../../data").EVENTOS;
  onDayClick: (d: string) => void;
  selectedDay: string | null;
}) {
  const days = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const cells = Array.from({ length: firstDay + days }, (_, i) => i < firstDay ? null : i - firstDay + 1);
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  return (
    <Card className="p-3 hover:shadow-sm transition-shadow">
      <h3 className="font-display font-semibold text-stone-800 text-sm mb-2 px-1">{MESES[month]}</h3>
      <div className="grid grid-cols-7 gap-0.5 mb-1">
        {DIAS_SEM.map(d => <div key={d} className="text-center text-[9px] font-semibold text-stone-400 py-0.5">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const evts = eventosEnDia(eventos, dateStr);
          const isToday = isCurrentMonth && today.getDate() === day;
          const isSelected = selectedDay === dateStr;
          const isWeekend = [0, 6].includes((firstDay + day - 1) % 7);

          // top event dot color
          const topEvt = evts.find(e => e.tipo !== "clases");
          const dotColor = topEvt ? TIPO_CFG[topEvt.tipo as TipoEvento].dot : evts.length > 0 ? TIPO_CFG.clases.dot : "";

          return (
            <button key={i} onClick={() => onDayClick(dateStr)}
              className={`relative aspect-square flex flex-col items-center justify-center rounded text-xs transition-colors cursor-pointer
                ${isSelected ? "bg-primary-700 text-white font-bold ring-2 ring-primary-300"
                  : isToday ? "bg-primary-100 text-primary-800 font-bold"
                  : isWeekend ? "text-stone-400 hover:bg-stone-100"
                  : "text-stone-700 hover:bg-stone-100"}`}
            >
              {day}
              {dotColor && !isSelected && (
                <span className={`w-1 h-1 rounded-full absolute bottom-0.5 ${dotColor}`} />
              )}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export default function CalendarioView() {
  const YEAR = 2025;
  const [eventos, setEventos] = useState(EVENTOS as typeof EVENTOS);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [nuevo, setNuevo] = useState<NuevoEvento>({
    titulo: "", tipo: "clases", fecha: "", fechaFin: "", recordatorio: false,
  });

  const eventosDelDia = selectedDay ? eventosEnDia(eventos, selectedDay) : [];

  function handleCrear() {
    if (!nuevo.titulo || !nuevo.fecha) return;
    const e = {
      id: `custom-${Date.now()}`,
      titulo: nuevo.titulo,
      fecha: nuevo.fecha,
      fechaFin: nuevo.fechaFin || undefined,
      tipo: nuevo.tipo,
      recordatorio: nuevo.recordatorio,
    } as typeof EVENTOS[0];
    setEventos(prev => [...prev, e]);
    setShowForm(false);
    setNuevo({ titulo: "", tipo: "clases", fecha: "", fechaFin: "", recordatorio: false });
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Calendario Escolar 2025" subtitle="Vista anual completa — todos los meses"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Crear evento</Btn>}
      />

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TIPO_CFG) as [TipoEvento, typeof TIPO_CFG[TipoEvento]][]).map(([tipo, cfg]) => (
          <span key={tipo} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.badge}`}>
            <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ))}
      </div>

      {/* Nueva evento form */}
      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-900">Nuevo evento</h3>
            <button onClick={() => setShowForm(false)} className="text-stone-400 hover:text-stone-600"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="text-sm font-medium text-stone-700 block mb-1">Título del evento</label>
              <input value={nuevo.titulo} onChange={e => setNuevo(p => ({ ...p, titulo: e.target.value }))}
                placeholder="Ej. Día del Alumno, Reunión de Padres…"
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Tipo</label>
              <select value={nuevo.tipo} onChange={e => setNuevo(p => ({ ...p, tipo: e.target.value as TipoEvento }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option value="clases">Clases normales</option>
                <option value="examen">Semana de exámenes</option>
                <option value="descanso">Descanso / Vacaciones</option>
                <option value="actividad">Actividad / Recordatorio</option>
                <option value="asueto">Asueto</option>
                <option value="festivo">Día festivo</option>
                <option value="institucional">Evento institucional</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Fecha inicio</label>
              <input type="date" value={nuevo.fecha} onChange={e => setNuevo(p => ({ ...p, fecha: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Fecha fin <span className="text-stone-400 font-normal">(opcional)</span></label>
              <input type="date" value={nuevo.fechaFin} onChange={e => setNuevo(p => ({ ...p, fechaFin: e.target.value }))}
                min={nuevo.fecha}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="recordatorio" checked={nuevo.recordatorio}
                onChange={e => setNuevo(p => ({ ...p, recordatorio: e.target.checked }))}
                className="w-4 h-4 accent-primary-700 cursor-pointer" />
              <label htmlFor="recordatorio" className="text-sm text-stone-700 cursor-pointer">
                Enviar recordatorio un día antes por correo
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Btn variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" size="sm" onClick={handleCrear} disabled={!nuevo.titulo || !nuevo.fecha}>
              Guardar evento
            </Btn>
          </div>
        </Card>
      )}

      {/* Day detail panel */}
      {selectedDay && (
        <Card className={`p-4 border-2 ${eventosDelDia.length ? "border-primary-200 bg-primary-50" : "border-stone-200"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-stone-900 text-sm">
                {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-GT", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              </p>
              {eventosDelDia.length === 0 ? (
                <p className="text-stone-400 text-xs mt-1">Sin eventos · <button className="text-primary-700 underline" onClick={() => { setNuevo(p => ({ ...p, fecha: selectedDay })); setShowForm(true); }}>Agregar evento</button></p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {eventosDelDia.map(e => (
                    <span key={e.id} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${TIPO_CFG[e.tipo as TipoEvento]?.badge ?? ""}`}>
                      {e.titulo}
                      {e.recordatorio && <Bell className="w-3 h-3 opacity-60" />}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setSelectedDay(null)} className="text-stone-400 hover:text-stone-600 shrink-0"><X className="w-4 h-4" /></button>
          </div>
        </Card>
      )}

      {/* 12-month grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 12 }, (_, m) => (
          <MiniCalendario key={m} year={YEAR} month={m} eventos={eventos} onDayClick={setSelectedDay} selectedDay={selectedDay} />
        ))}
      </div>

      {/* Upcoming events list */}
      <Card className="p-5">
        <h3 className="font-display font-semibold text-stone-800 mb-3">Eventos del ciclo escolar</h3>
        <div className="space-y-1.5 max-h-80 overflow-y-auto scrollbar-hide">
          {eventos
            .filter(e => e.tipo !== "clases")
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
            .map(e => {
              const cfg = TIPO_CFG[e.tipo as TipoEvento] ?? TIPO_CFG.clases;
              const inicio = e.fecha.split("-").reverse().join("/");
              const fin = e.fechaFin ? e.fechaFin.split("-").reverse().join("/") : null;
              return (
                <div key={e.id} className={`flex items-center justify-between px-3 py-2 rounded-lg border ${cfg.badge} text-xs`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className="font-medium truncate">{e.titulo}</span>
                    {e.recordatorio && <Bell className="w-3 h-3 shrink-0 opacity-60" />}
                  </div>
                  <span className="font-mono-data shrink-0 ml-2">{fin ? `${inicio} – ${fin}` : inicio}</span>
                </div>
              );
            })}
        </div>
      </Card>
    </div>
  );
}

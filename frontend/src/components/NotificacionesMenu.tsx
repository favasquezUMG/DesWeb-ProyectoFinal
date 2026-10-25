import { useEffect, useRef, useState } from "react";
import { Bell, AlertTriangle, CheckCheck } from "./Iconos";
import {
  getMisNotificaciones,
  marcarNotificacionLeida,
  marcarTodasNotificacionesLeidas,
  type NotificacionDto,
} from "../lib/api";

// Cada cuánto se vuelve a consultar si hay notificaciones nuevas
const INTERVALO_MS = 60_000;
const MAX_VISIBLES = 15;

function tiempoRelativo(iso: string): string {
  const minutos = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 7) return `Hace ${dias} d`;
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const estiloTipo = (tipo: string) =>
  tipo === "Sancion" || tipo === "Conducta"
    ? "bg-danger-50 text-danger-700"
    : tipo === "Evento" || tipo === "Asueto"
      ? "bg-warning-50 text-warning-700"
      : "bg-info-50 text-info-700";

export default function NotificacionesMenu() {
  const [open, setOpen] = useState(false);
  const [notificaciones, setNotificaciones] = useState<NotificacionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandida, setExpandida] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  useEffect(() => {
    let cancelled = false;
    const cargar = () =>
      getMisNotificaciones()
        .then((data) => { if (!cancelled) { setNotificaciones(data); setError(""); } })
        .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar las notificaciones."); })
        .finally(() => { if (!cancelled) setLoading(false); });

    cargar();
    const id = window.setInterval(cargar, INTERVALO_MS);
    return () => { cancelled = true; window.clearInterval(id); };
  }, []);

  // Cerrar al hacer clic fuera o con Escape
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function handleAbrir(n: NotificacionDto) {
    setExpandida((prev) => (prev === n.notificacionId ? null : n.notificacionId));
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((x) => (x.notificacionId === n.notificacionId ? { ...x, leida: true } : x)));
    try {
      await marcarNotificacionLeida(n.notificacionId);
    } catch {
      setNotificaciones((prev) => prev.map((x) => (x.notificacionId === n.notificacionId ? { ...x, leida: false } : x)));
    }
  }

  async function handleTodasLeidas() {
    const anteriores = notificaciones;
    setNotificaciones((prev) => prev.map((x) => ({ ...x, leida: true })));
    try {
      await marcarTodasNotificacionesLeidas();
    } catch {
      setNotificaciones(anteriores);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative w-10 h-10 rounded-full flex items-center justify-center bg-white border-[1.5px] border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-400 transition-colors cursor-pointer"
        aria-label={noLeidas > 0 ? `Notificaciones (${noLeidas} sin leer)` : "Notificaciones"}
        aria-expanded={open}
      >
        <Bell className="w-4.5 h-4.5" />
        {noLeidas > 0 && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 bg-action-500 text-white text-[11px] font-bold leading-5 text-center rounded-full ring-2 ring-sand-100" aria-hidden="true">
            {noLeidas > 9 ? "9+" : noLeidas}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-white border border-stone-200/70 rounded-3xl shadow-xl z-50 overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-3">
            <p className="font-display text-lg font-bold text-stone-900">Notificaciones</p>
            {noLeidas > 0 && (
              <button onClick={handleTodasLeidas} className="flex items-center gap-1 text-xs font-semibold text-primary-700 hover:text-primary-900 cursor-pointer">
                <CheckCheck className="w-3.5 h-3.5" />Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-stone-500">
                <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
                Cargando…
              </div>
            ) : error && notificaciones.length === 0 ? (
              <p className="px-4 py-6 text-sm text-danger-700 text-center">{error}</p>
            ) : notificaciones.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-primary-300 mx-auto mb-2" />
                <p className="text-sm text-stone-500">No tiene notificaciones.</p>
              </div>
            ) : (
              notificaciones.slice(0, MAX_VISIBLES).map((n) => (
                <button
                  key={n.notificacionId}
                  onClick={() => handleAbrir(n)}
                  className={`w-full flex items-start gap-3 px-5 py-3.5 text-left border-t border-stone-100 hover:bg-stone-50 transition-colors cursor-pointer ${n.leida ? "" : "bg-action-50/50"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${estiloTipo(n.tipo)}`}>
                    {n.tipo === "Conducta" ? <AlertTriangle className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm text-stone-900 ${n.leida ? "font-medium" : "font-semibold"} ${expandida === n.notificacionId ? "" : "truncate"}`}>{n.titulo}</p>
                      {!n.leida && <span className="w-2 h-2 mt-1.5 bg-action-500 rounded-full shrink-0" aria-label="Sin leer" />}
                    </div>
                    <p className={`text-xs text-stone-600 mt-0.5 whitespace-pre-line ${expandida === n.notificacionId ? "" : "line-clamp-2"}`}>{n.mensaje}</p>
                    <p className="text-xs text-stone-400 mt-1.5">{n.tipo} · {tiempoRelativo(n.fechaEnvio)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

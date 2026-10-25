import { useEffect, useMemo, useRef, useState, type ComponentType, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { Search, CornerDownLeft } from "./Iconos";
import type { View } from "../types";

export interface SeccionBuscable {
  label: string;
  view: View;
  Icon: ComponentType<{ className?: string }>;
}

// Quita tildes y mayúsculas para que "calendario" encuentre "Calendário", etc.
const normalizar = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// Buscador rápido de las secciones del menú. Se abre con la lupa o con Ctrl+K / ⌘K.
export default function BuscadorSecciones({ secciones, onNavigate }: {
  secciones: SeccionBuscable[];
  onNavigate: (v: View) => void;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [activo, setActivo] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const resultados = useMemo(() => {
    const q = normalizar(texto.trim());
    return q ? secciones.filter((s) => normalizar(s.label).includes(q)) : secciones;
  }, [texto, secciones]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTexto("");
      setActivo(0);
      inputRef.current?.focus();
    }
  }, [open]);

  useEffect(() => { setActivo(0); }, [texto]);

  function ir(s: SeccionBuscable) {
    onNavigate(s.view);
    setOpen(false);
  }

  function onKeyDown(e: ReactKeyboardEvent) {
    if (e.key === "Escape") setOpen(false);
    else if (e.key === "ArrowDown") { e.preventDefault(); setActivo((i) => Math.min(i + 1, resultados.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActivo((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter" && resultados[activo]) ir(resultados[activo]);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-10 h-10 rounded-full flex items-center justify-center bg-white border-[1.5px] border-stone-200 text-stone-600 hover:text-stone-900 hover:border-stone-400 transition-colors cursor-pointer"
        aria-label="Buscar sección (Ctrl+K)"
        title="Buscar sección (Ctrl+K)"
      >
        <Search className="w-4.5 h-4.5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[15vh]" role="dialog" aria-modal="true" aria-label="Buscar sección">
          <div className="absolute inset-0 bg-primary-900/40" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 border-b border-stone-100">
              <Search className="w-5 h-5 text-primary-600 shrink-0" />
              <input
                ref={inputRef}
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="¿A dónde quiere ir?"
                className="flex-1 py-4 text-base bg-transparent focus:outline-none placeholder-stone-400"
                aria-label="Buscar sección"
              />
              <kbd className="hidden sm:block text-[11px] font-semibold text-stone-500 bg-stone-100 rounded-lg px-2 py-0.5">Esc</kbd>
            </div>
            <ul className="max-h-80 overflow-y-auto p-2" role="listbox">
              {resultados.length === 0 ? (
                <li className="px-4 py-6 text-sm text-stone-500 text-center">No se encontró ninguna sección.</li>
              ) : resultados.map((s, i) => (
                <li key={s.view} role="option" aria-selected={i === activo}>
                  <button
                    onClick={() => ir(s)}
                    onMouseEnter={() => setActivo(i)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-[15px] text-left cursor-pointer ${i === activo ? "bg-primary-800 text-white font-semibold" : "text-stone-700"}`}
                  >
                    <s.Icon className="w-4 h-4 shrink-0 opacity-70" />
                    <span className="flex-1">{s.label}</span>
                    {i === activo && <CornerDownLeft className="w-3.5 h-3.5 opacity-50" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

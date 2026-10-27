/**
 * Piezas compartidas de las tareas en línea (catedrático, alumno y encargado).
 */
import { useRef, useState } from "react";
import { abrirArchivoTarea, type ArchivoTareaDto, type EstadoTarea } from "../lib/api";
import { Badge } from "./Ui";
import { Clip, Subir, X } from "./Iconos";

const ESTADO: Record<EstadoTarea, { label: string; variant: "neutral" | "danger" | "warning" | "info" | "success" }> = {
  Pendiente: { label: "Pendiente", variant: "neutral" },
  Atrasada: { label: "Sin entregar (vencida)", variant: "danger" },
  Entregada: { label: "Entregada", variant: "warning" },
  Devuelta: { label: "Devuelta para corregir", variant: "info" },
  Calificada: { label: "Calificada", variant: "success" },
};

/** Para el catedrático una entrega "Entregada" significa "por revisar" */
export function EstadoTareaBadge({ estado, tarde = false, vista = "alumno" }: { estado: EstadoTarea; tarde?: boolean; vista?: "alumno" | "catedratico" }) {
  const cfg = ESTADO[estado];
  const label = vista === "catedratico" && estado === "Entregada" ? "Por revisar" : cfg.label;
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <Badge variant={cfg.variant}>{label}</Badge>
      {tarde && <Badge variant="danger">Tarde</Badge>}
    </span>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-GT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Archivos ya subidos: se abren con una URL temporal; opcionalmente se pueden quitar */
export function ListaArchivos({ archivos, onQuitar, onError, vacio }: {
  archivos: ArchivoTareaDto[];
  onQuitar?: (archivo: ArchivoTareaDto) => void;
  onError?: (mensaje: string) => void;
  vacio?: string;
}) {
  if (archivos.length === 0) return vacio ? <p className="text-sm text-stone-400">{vacio}</p> : null;
  return (
    <ul className="flex flex-col gap-2">
      {archivos.map((a) => (
        <li key={a.archivoId} className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white pl-3 pr-1.5 py-1.5 min-w-0">
          <Clip className="w-4 h-4 text-stone-400 shrink-0" />
          <button
            type="button"
            onClick={() => abrirArchivoTarea(a.archivoId).catch((e: Error) => onError?.(e.message))}
            className="flex-1 min-w-0 text-left text-sm font-semibold text-primary-700 hover:underline truncate cursor-pointer"
            title={`Abrir ${a.nombre}`}
          >
            {a.nombre}
          </button>
          <span className="text-xs text-stone-400 shrink-0 tabular-nums">{formatBytes(a.bytes)}</span>
          {onQuitar && (
            <button type="button" onClick={() => onQuitar(a)} aria-label={`Quitar ${a.nombre}`}
              className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-danger-700 hover:bg-danger-50 cursor-pointer shrink-0">
              <X className="w-4 h-4" />
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Archivos elegidos que aún no se suben */
export function ArchivosPorSubir({ archivos, onQuitar }: { archivos: File[]; onQuitar: (i: number) => void }) {
  if (archivos.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {archivos.map((f, i) => (
        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-xl border border-dashed border-primary-300 bg-primary-50/50 pl-3 pr-1.5 py-1.5 min-w-0">
          <Subir className="w-4 h-4 text-primary-600 shrink-0" />
          <span className="flex-1 min-w-0 text-sm font-semibold text-stone-800 truncate">{f.name}</span>
          <span className="text-xs text-stone-500 shrink-0 tabular-nums">{formatBytes(f.size)}</span>
          <button type="button" onClick={() => onQuitar(i)} aria-label={`Quitar ${f.name}`}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-400 hover:text-danger-700 hover:bg-danger-50 cursor-pointer shrink-0">
            <X className="w-4 h-4" />
          </button>
        </li>
      ))}
    </ul>
  );
}

export const ACEPTA_ARCHIVOS = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.gif,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip";

/** Botón que abre el selector de archivos del sistema */
export function ElegirArchivos({ onElegir, disabled, texto = "Adjuntar archivos" }: { onElegir: (archivos: File[]) => void; disabled?: boolean; texto?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setArrastrando(true); }}
      onDragLeave={() => setArrastrando(false)}
      onDrop={(e) => {
        e.preventDefault();
        setArrastrando(false);
        if (!disabled && e.dataTransfer.files.length) onElegir([...e.dataTransfer.files]);
      }}
      className={`rounded-2xl border-[1.5px] border-dashed px-4 py-4 flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 text-center transition-colors
        ${arrastrando ? "border-primary-600 bg-primary-50" : "border-stone-300 bg-stone-50/60"} ${disabled ? "opacity-50" : ""}`}
    >
      <input ref={ref} type="file" multiple accept={ACEPTA_ARCHIVOS} className="hidden"
        onChange={(e) => { if (e.target.files?.length) onElegir([...e.target.files]); e.target.value = ""; }} />
      <button type="button" disabled={disabled} onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border-[1.5px] border-stone-300 text-sm font-semibold text-stone-800 hover:border-stone-900 cursor-pointer disabled:cursor-not-allowed">
        <Subir className="w-4 h-4" />{texto}
      </button>
      <span className="text-xs text-stone-500">o arrástrelos aquí · PDF, imágenes, Word, Excel, PowerPoint o ZIP · hasta 10 MB c/u</span>
    </div>
  );
}

import type { EstadoBeca, TipoProgramaBeca } from "./api";

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "primary";

export const ESTADO_BECA_BADGE: Record<EstadoBeca, BadgeVariant> = {
  Solicitada: "info",
  Activa: "success",
  Suspendida: "warning",
  Rechazada: "danger",
  Revocada: "danger",
  Finalizada: "neutral",
};

export const TIPO_PROGRAMA_LABEL: Record<TipoProgramaBeca, string> = {
  Merito: "Mérito académico",
  Socioeconomica: "Socioeconómica",
  Deportiva: "Deportiva",
  Convenio: "Convenio",
  Otro: "Otro",
};

export const TIPOS_PROGRAMA = Object.keys(TIPO_PROGRAMA_LABEL) as TipoProgramaBeca[];

export function formatQ(monto: number): string {
  return `Q${monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Las fechas @db.Date llegan a medianoche UTC; se muestran en UTC para no correr el día
export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

export function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-GT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function nombreDe(u: { nombres: string; apellidos: string }): string {
  return `${u.nombres} ${u.apellidos}`;
}

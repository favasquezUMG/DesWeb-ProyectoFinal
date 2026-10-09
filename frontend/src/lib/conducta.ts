import type { TipoConducta } from "./api";

export const TIPOS_CONDUCTA: { value: TipoConducta; label: string; variant: "success" | "warning" | "danger" }[] = [
  { value: "Positivo", label: "Positivo (reconocimiento)", variant: "success" },
  { value: "Leve", label: "Falta leve", variant: "warning" },
  { value: "Grave", label: "Falta grave", variant: "danger" },
];

export const tipoConductaVariant = (tipo: TipoConducta) =>
  TIPOS_CONDUCTA.find((t) => t.value === tipo)?.variant ?? "neutral";

export function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

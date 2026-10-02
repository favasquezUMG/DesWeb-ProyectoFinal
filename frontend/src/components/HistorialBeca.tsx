import type { BecaHistorialDto, EstadoBeca } from "../lib/api";
import { Badge } from "./Ui";
import { ESTADO_BECA_BADGE, formatFechaHora, nombreDe } from "../lib/becas";

// Línea de tiempo con cada cambio de estado de una beca (el más reciente primero)
export default function HistorialBeca({ historial }: { historial: BecaHistorialDto[] }) {
  if (historial.length === 0) {
    return <p className="text-sm text-stone-500">Sin movimientos registrados.</p>;
  }

  return (
    <ol className="relative border-l-2 border-stone-200 ml-2 space-y-5">
      {historial.map((h) => {
        const cambioDeEstado = h.estadoAnterior !== h.estadoNuevo;
        return (
          <li key={h.historialId} className="pl-5 relative">
            <span className="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-white border-2 border-primary-700" />
            <div className="flex flex-wrap items-center gap-1.5">
              {cambioDeEstado ? (
                <>
                  {h.estadoAnterior && <span className="text-xs text-stone-400">{h.estadoAnterior} →</span>}
                  <Badge variant={ESTADO_BECA_BADGE[h.estadoNuevo as EstadoBeca] ?? "neutral"}>{h.estadoNuevo}</Badge>
                </>
              ) : (
                <Badge variant="neutral">Modificación</Badge>
              )}
              <span className="text-xs text-stone-400">{formatFechaHora(h.fecha)}</span>
            </div>
            <p className="text-sm text-stone-700 mt-1">{h.motivo}</p>
            <p className="text-xs text-stone-400 mt-0.5">{h.usuario ? nombreDe(h.usuario) : "Sistema (automático)"}</p>
          </li>
        );
      })}
    </ol>
  );
}

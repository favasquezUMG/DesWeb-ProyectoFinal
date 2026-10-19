import { CalendarCheck, CalendarOff } from "lucide-react";
import type { ClaseAlumnoDto, EventoDto } from "../lib/api";
import { Card, Badge, EmptyState } from "./Ui";

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Colores estables por curso
const PALETA = [
  "bg-primary-50 text-primary-900 border-primary-200",
  "bg-info-50 text-info-800 border-info-200",
  "bg-success-50 text-success-800 border-success-200",
  "bg-warning-50 text-warning-800 border-warning-200",
  "bg-action-50 text-action-800 border-action-200",
  "bg-stone-100 text-stone-800 border-stone-200",
];
const colorCurso = (cursoSeccionId: number) => PALETA[cursoSeccionId % PALETA.length];

export const diaSemanaHoy = () => (new Date().getDay() === 0 ? 7 : new Date().getDay());

const isoLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * Días de esta semana (lunes a domingo) sin clases por un evento festivo o asueto.
 * Con sedeId solo cuentan los eventos generales y los de esa sede.
 */
export function asuetosDeLaSemana(eventos: EventoDto[], sedeId?: number): Map<number, string> {
  const hoy = new Date();
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - (diaSemanaHoy() - 1));
  const resultado = new Map<number, string>();
  for (let i = 0; i < 7; i++) {
    const dia = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + i);
    const iso = isoLocal(dia);
    const evento = eventos.find((e) => e.tipoEvento === "Festivo" && e.fecha.slice(0, 10) === iso
      && (sedeId === undefined || e.sedeId === null || e.sedeId === sedeId));
    if (evento) resultado.set(i + 1, evento.nombre);
  }
  return resultado;
}

/** Hora de entrada y salida de cada día (primera y última clase) */
export function jornadaPorDia(clases: ClaseAlumnoDto[]): Map<number, { entrada: string; salida: string }> {
  const jornada = new Map<number, { entrada: string; salida: string }>();
  for (const c of clases) {
    const j = jornada.get(c.diaSemana);
    jornada.set(c.diaSemana, {
      entrada: !j || c.horaInicio < j.entrada ? c.horaInicio : j.entrada,
      salida: !j || c.horaFin > j.salida ? c.horaFin : j.salida,
    });
  }
  return jornada;
}

export default function HorarioSemanal({ clases, asuetos = new Map(), mostrarJornada = false }: {
  clases: ClaseAlumnoDto[];
  /** diaSemana → motivo, para los días de esta semana sin clases */
  asuetos?: Map<number, string>;
  /** Muestra la hora de entrada y salida de cada día (útil para quien recoge al alumno) */
  mostrarJornada?: boolean;
}) {
  if (clases.length === 0) {
    return <EmptyState icon={<CalendarCheck className="w-10 h-10" />} title="Sin horario publicado" description="La sede aún no ha asignado los horarios de esta sección." />;
  }

  const dias = [...new Set([1, 2, 3, 4, 5, ...clases.map((c) => c.diaSemana)])].sort((a, b) => a - b);
  const bloques = [...new Set(clases.map((c) => `${c.horaInicio}–${c.horaFin}`))].sort();
  const hoy = diaSemanaHoy();
  const jornada = jornadaPorDia(clases);

  return (
    <>
      {asuetos.size > 0 && (
        <div className="flex flex-wrap gap-2">
          {[...asuetos.entries()].map(([dia, motivo]) => (
            <span key={dia} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning-50 border border-warning-200 text-warning-800 text-xs font-medium">
              <CalendarOff className="w-3.5 h-3.5" /> Sin clases el {DIAS[dia].toLowerCase()}: {motivo}
            </span>
          ))}
        </div>
      )}

      {/* Mobile: lista por día */}
      <div className="md:hidden space-y-4">
        {dias.map((dia) => {
          const delDia = clases.filter((c) => c.diaSemana === dia);
          if (delDia.length === 0) return null;
          const j = jornada.get(dia);
          return (
            <Card key={dia} className={`p-4 ${asuetos.has(dia) ? "opacity-60" : ""}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-semibold text-stone-800 flex items-center gap-2">
                  {DIAS[dia]} {dia === hoy && <Badge variant="primary">Hoy</Badge>}
                  {asuetos.has(dia) && <Badge variant="warning">Sin clases</Badge>}
                </h3>
                {mostrarJornada && j && <span className="text-xs text-stone-500 font-mono-data">{j.entrada} – {j.salida}</span>}
              </div>
              <div className="space-y-2">
                {delDia.map((c) => (
                  <div key={c.horarioId} className={`flex items-center gap-3 p-2 rounded-lg border ${colorCurso(c.cursoSeccionId)}`}>
                    <span className="font-mono-data text-xs font-semibold whitespace-nowrap">{c.horaInicio}–{c.horaFin}</span>
                    <div>
                      <p className="font-semibold text-xs">{c.curso}</p>
                      <p className="text-[10px] opacity-70">{c.catedratico}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: cuadrícula */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-medium w-28">Hora</th>
                {dias.map((d) => (
                  <th key={d} className={`px-4 py-3 text-left font-medium ${d === hoy ? "bg-primary-800" : ""}`}>
                    {DIAS[d]}
                    {asuetos.has(d) && <span className="block text-[10px] font-normal text-warning-200">Sin clases</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bloques.map((bloque, i) => {
                const [inicio, fin] = bloque.split("–");
                return (
                  <tr key={bloque} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                    <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{bloque}</td>
                    {dias.map((d) => {
                      const c = clases.find((x) => x.diaSemana === d && x.horaInicio === inicio && x.horaFin === fin);
                      return (
                        <td key={d} className={`px-2 py-2 ${asuetos.has(d) ? "opacity-40" : ""}`}>
                          {c && (
                            <div className={`p-2 rounded-lg border ${colorCurso(c.cursoSeccionId)}`}>
                              <p className="font-semibold">{c.curso}</p>
                              <p className="text-[10px] opacity-70 mt-0.5">{c.catedratico}</p>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {mostrarJornada && (
                <tr className="bg-stone-50 border-t-2 border-stone-200">
                  <td className="px-4 py-3 font-medium text-stone-600">Entrada / salida</td>
                  {dias.map((d) => {
                    const j = jornada.get(d);
                    return (
                      <td key={d} className="px-4 py-3 font-mono-data text-stone-700">
                        {j && !asuetos.has(d) ? `${j.entrada} – ${j.salida}` : "—"}
                      </td>
                    );
                  })}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

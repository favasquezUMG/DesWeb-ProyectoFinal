import { CalendarCheck, CalendarOff } from "./Iconos";
import type { ClaseAlumnoDto, EventoDto } from "../lib/api";
import { Card, Badge, EmptyState, colorDeCurso } from "./Ui";

export const DIAS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Cada bloque toma el color de su curso (el mismo en toda la app)
function BloqueClase({ curso, catedratico, hora }: { curso: string; catedratico: string; hora?: string }) {
  const c = colorDeCurso(curso);
  return (
    <div className={`relative h-full px-3 py-2.5 rounded-xl ${c.solid} ${c.fg} textile-pattern overflow-hidden`}>
      {hora && <p className="text-xs font-bold tabular-nums opacity-85">{hora}</p>}
      <p className="font-display font-bold text-[14px] leading-snug">{curso}</p>
      <p className="text-xs opacity-80 mt-0.5 truncate">{catedratico}</p>
    </div>
  );
}

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
            <span key={dia} className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-warning-50 text-warning-800 text-[13px] font-semibold">
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
                <h3 className="font-display font-bold text-lg text-stone-900 flex items-center gap-2">
                  {DIAS[dia]} {dia === hoy && <Badge variant="primary">Hoy</Badge>}
                  {asuetos.has(dia) && <Badge variant="warning">Sin clases</Badge>}
                </h3>
                {mostrarJornada && j && <span className="text-[13px] font-semibold text-stone-500 tabular-nums">{j.entrada} – {j.salida}</span>}
              </div>
              <div className="space-y-2">
                {delDia.map((c) => (
                  <BloqueClase key={c.horarioId} curso={c.curso} catedratico={c.catedratico} hora={`${c.horaInicio} – ${c.horaFin}`} />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Desktop: cuadrícula */}
      <Card className="hidden md:block overflow-hidden pb-3">
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-separate border-spacing-0">
            <thead>
              <tr>
                <th className="px-4 pt-5 pb-3 text-left w-28" />
                {dias.map((d) => (
                  <th key={d} className="px-1.5 pt-5 pb-3 text-left">
                    <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-display text-[15px] font-bold
                      ${d === hoy ? "bg-primary-800 text-white" : "text-stone-800"}`}>
                      {DIAS[d]}
                    </span>
                    {asuetos.has(d) && <span className="block mt-1 px-3 text-xs font-semibold text-warning-700">Sin clases</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloques.map((bloque, i) => {
                const [inicio, fin] = bloque.split("–");
                return (
                  <tr key={bloque}>
                    <td className="px-4 py-1.5 align-top whitespace-nowrap">
                      <span className="block font-display font-bold text-[15px] text-stone-900 tabular-nums">{inicio}</span>
                      <span className="block text-xs text-stone-400 tabular-nums">{fin}</span>
                    </td>
                    {dias.map((d) => {
                      const c = clases.find((x) => x.diaSemana === d && x.horaInicio === inicio && x.horaFin === fin);
                      return (
                        <td key={d} className={`px-1.5 py-1.5 align-top ${d === hoy ? "bg-primary-50/50" : ""} ${asuetos.has(d) ? "opacity-40" : ""}`}>
                          {c && <BloqueClase curso={c.curso} catedratico={c.catedratico} />}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              {mostrarJornada && (
                <tr>
                  <td className="px-4 py-4 font-semibold text-stone-600 border-t-[1.5px] border-stone-200">Entrada y salida</td>
                  {dias.map((d) => {
                    const j = jornada.get(d);
                    return (
                      <td key={d} className="px-4 py-4 font-bold text-stone-800 tabular-nums border-t-[1.5px] border-stone-200">
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

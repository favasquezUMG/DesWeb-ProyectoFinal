import { CalendarCheck } from "lucide-react";
import { Card, SectionHeader, AlertBanner, EmptyState } from "../../components/Ui";
import type { CursoSeccionDto } from "../../lib/api";
import { Cargando, DIAS_SEMANA, useMisCursos } from "./shared";

export interface ClaseHorario {
  cursoSeccionId: number;
  curso: string;
  grupo: string;
  diaSemana: number;
  horaInicio: string;
  horaFin: string;
}

// Aplana los horarios de todas las secciones del catedrático, ordenados por día y hora
export function clasesDe(cursos: CursoSeccionDto[]): ClaseHorario[] {
  return cursos
    .flatMap((c) => (c.horarios ?? []).map((h) => ({
      cursoSeccionId: c.cursoSeccionId,
      curso: c.curso.nombre,
      grupo: `${c.seccion.grado.nombre} ${c.seccion.nombre}`,
      diaSemana: h.diaSemana,
      horaInicio: h.horaInicio,
      horaFin: h.horaFin,
    })))
    .sort((a, b) => a.diaSemana - b.diaSemana || a.horaInicio.localeCompare(b.horaInicio));
}

export default function Horario() {
  const { cursos, loading, error } = useMisCursos();

  if (loading) return <Cargando texto="Cargando su horario..." />;
  if (error) return <AlertBanner type="error" message={error} />;

  const clases = clasesDe(cursos);
  const sede = cursos[0]?.seccion.sede?.nombre;
  const ciclo = cursos[0]?.seccion.anioLectivo;
  const subtitulo = [ciclo && `Ciclo ${ciclo}`, sede].filter(Boolean).join(" — ");

  if (clases.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Mi Horario" subtitle={subtitulo || undefined} />
        <EmptyState icon={<CalendarCheck className="w-10 h-10" />} title="Sin horario asignado" description="Sus cursos aún no tienen horarios registrados." />
      </div>
    );
  }

  // Lunes a viernes siempre; sábado y domingo solo si hay clases
  const dias = [1, 2, 3, 4, 5, 6, 7].filter((d) => d <= 5 || clases.some((c) => c.diaSemana === d));
  const bloques = [...new Set(clases.map((c) => `${c.horaInicio}–${c.horaFin}`))].sort();

  return (
    <div className="space-y-5">
      <SectionHeader title="Mi Horario" subtitle={subtitulo || undefined} />

      {/* Desktop: cuadrícula */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-medium w-28">Hora</th>
                {dias.map((d) => <th key={d} className="px-4 py-3 text-left font-medium">{DIAS_SEMANA[d]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {bloques.map((bloque, i) => (
                <tr key={bloque} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                  <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{bloque}</td>
                  {dias.map((d) => {
                    const enCelda = clases.filter((c) => c.diaSemana === d && `${c.horaInicio}–${c.horaFin}` === bloque);
                    return (
                      <td key={d} className="px-2 py-2 align-top">
                        {enCelda.map((c) => (
                          <div key={c.cursoSeccionId} className="p-2 rounded-lg bg-primary-100 text-primary-800 border border-primary-200 mb-1 last:mb-0">
                            <p className="font-semibold text-xs">{c.curso}</p>
                            <p className="text-[10px] opacity-70 mt-0.5">{c.grupo}</p>
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Mobile: lista por día */}
      <div className="md:hidden space-y-3">
        {dias.filter((d) => clases.some((c) => c.diaSemana === d)).map((d) => (
          <Card key={d} className="p-4">
            <p className="font-semibold text-stone-900 text-sm mb-2">{DIAS_SEMANA[d]}</p>
            <div className="space-y-2">
              {clases.filter((c) => c.diaSemana === d).map((c) => (
                <div key={`${c.cursoSeccionId}-${c.horaInicio}`} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-stone-800">{c.curso}</p>
                    <p className="text-xs text-stone-500">{c.grupo}</p>
                  </div>
                  <span className="font-mono-data text-xs text-stone-500">{c.horaInicio}–{c.horaFin}</span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

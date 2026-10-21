import { useEffect, useState } from "react";
import { getSession } from "../../lib/auth";
import { getCursosDeCatedratico, type ActividadDto, type CursoSeccionDto, type LibretaDto, type TipoActividad } from "../../lib/api";
import { Badge, EstadoBadge } from "../../components/Ui";

export const NOTA_APROBACION = 61;

export const DIAS_SEMANA: Record<number, string> = {
  1: "Lunes", 2: "Martes", 3: "Miércoles", 4: "Jueves", 5: "Viernes", 6: "Sábado", 7: "Domingo",
};

export const UNIDAD_LABEL: Record<number, string> = { 1: "I Unidad", 2: "II Unidad", 3: "III Unidad", 4: "IV Unidad" };

export function nombreCurso(c: CursoSeccionDto): string {
  return `${c.curso.nombre} — ${c.seccion.grado.nombre} ${c.seccion.nombre}`;
}

// Fecha local en formato YYYY-MM-DD (lo que espera el backend)
export function hoyISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// 1 = Lunes ... 7 = Domingo, igual que el backend
export function diaSemanaHoy(): number {
  const d = new Date().getDay();
  return d === 0 ? 7 : d;
}

export function formatFechaCorta(iso: string | null): string {
  if (!iso) return "Sin fecha";
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

export function iniciales(nombres: string, apellidos: string): string {
  return `${nombres[0] ?? ""}${apellidos[0] ?? ""}`.toUpperCase();
}

export function errorMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// Cada unidad vale 100 puntos: 60 de zona y 40 de examen. La nota final es el promedio de las unidades.
export const PUNTEO_UNIDAD = 100;
export const PUNTEO_POR_TIPO: Record<TipoActividad, number> = { Zona: 60, Examen: 40 };
export const TIPO_LABEL: Record<TipoActividad, string> = { Zona: "Zona", Examen: "Examen" };

export interface NotaUnidad {
  zona: number;
  examen: number;
  total: number; // zona + examen, sobre 100
}

export interface TotalesAlumno {
  unidades: NotaUnidad[]; // en el orden de libreta.unidades
  total: number; // nota final: promedio de las unidades
  conNotas: boolean;
  pendientes: number; // puntos de nota final que aún puede ganar (actividades sin calificar + puntos sin asignar)
}

export function actividadesPorTipo(actividades: ActividadDto[], tipo: TipoActividad): ActividadDto[] {
  return actividades.filter((a) => a.tipo === tipo);
}

export function sumaPuntos(actividades: ActividadDto[]): number {
  return redondear(actividades.reduce((s, a) => s + a.puntosMaximos, 0));
}

// Zona, examen y total de cada unidad, y nota final (promedio) de cada alumno de la libreta
export function calcularTotales(libreta: LibretaDto): Map<number, TotalesAlumno> {
  const notas = new Map(libreta.notas.map((n) => [`${n.actividadId}-${n.alumnoId}`, n.valor]));
  const numUnidades = libreta.unidades.length || 1;
  return new Map(
    libreta.alumnos.map((a) => {
      let porGanar = 0;
      let conNotas = false;
      const unidades = libreta.unidades.map((u) => {
        const nota: NotaUnidad = { zona: 0, examen: 0, total: 0 };
        let calificadoUnidad = 0;
        for (const act of u.actividades) {
          const v = notas.get(`${act.actividadId}-${a.alumnoId}`);
          if (v === undefined) continue;
          conNotas = true;
          calificadoUnidad += act.puntosMaximos;
          if (act.tipo === "Examen") nota.examen += v;
          else nota.zona += v;
        }
        nota.total = nota.zona + nota.examen;
        porGanar += Math.max(0, PUNTEO_UNIDAD - calificadoUnidad);
        return nota;
      });
      return [a.alumnoId, {
        unidades,
        total: unidades.reduce((s, u) => s + u.total, 0) / numUnidades,
        conNotas,
        pendientes: porGanar / numUnidades,
      }];
    }),
  );
}

// Aprobado al llegar a 61; reprobado solo cuando ya no le alcanzan los puntos pendientes
export function estadoAcademico(t: TotalesAlumno): "aprobado" | "reprobado" | "en-curso" {
  if (t.total >= NOTA_APROBACION) return "aprobado";
  if (t.total + t.pendientes < NOTA_APROBACION) return "reprobado";
  return "en-curso";
}

export function EstadoNota({ totales }: { totales: TotalesAlumno | undefined }) {
  if (!totales?.conNotas) return <span className="text-xs text-stone-400">Sin notas</span>;
  const estado = estadoAcademico(totales);
  if (estado === "en-curso") return <Badge variant="info">En curso</Badge>;
  return <EstadoBadge aprobado={estado === "aprobado"} />;
}

export function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

const CURSO_KEY = "dercas.cat.cursoSeccion";

// Cursos que imparte el catedrático con sesión iniciada, y el curso elegido
// (se recuerda al cambiar de vista).
export function useMisCursos() {
  const [cursos, setCursos] = useState<CursoSeccionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seleccion, setSeleccionState] = useState<number | null>(() => {
    try {
      const guardado = Number(localStorage.getItem(CURSO_KEY));
      return guardado || null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    const catedraticoId = Number(getSession()?.user.id);
    if (!catedraticoId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    getCursosDeCatedratico(catedraticoId)
      .then((data) => {
        if (cancelled) return;
        const ordenados = [...data].sort((a, b) => nombreCurso(a).localeCompare(nombreCurso(b)));
        setCursos(ordenados);
        setSeleccionState((actual) =>
          actual && ordenados.some((c) => c.cursoSeccionId === actual) ? actual : ordenados[0]?.cursoSeccionId ?? null,
        );
      })
      .catch((err) => { if (!cancelled) setError(errorMsg(err, "No se pudieron cargar sus cursos.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function setSeleccion(id: number) {
    setSeleccionState(id);
    try { localStorage.setItem(CURSO_KEY, String(id)); } catch { /* sin almacenamiento */ }
  }

  const curso = cursos.find((c) => c.cursoSeccionId === seleccion) ?? null;
  return { cursos, curso, seleccion, setSeleccion, loading, error };
}

export function CursoSelect({ cursos, value, onChange }: {
  cursos: CursoSeccionDto[]; value: number | null; onChange: (id: number) => void;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) => onChange(Number(e.target.value))}
      aria-label="Curso"
      className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
    >
      {cursos.map((c) => (
        <option key={c.cursoSeccionId} value={c.cursoSeccionId}>{nombreCurso(c)}</option>
      ))}
    </select>
  );
}

export function Cargando({ texto = "Cargando..." }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-sm text-stone-500">
      <span className="w-4 h-4 border-2 border-stone-300 border-t-primary-700 rounded-full animate-spin" />
      {texto}
    </div>
  );
}

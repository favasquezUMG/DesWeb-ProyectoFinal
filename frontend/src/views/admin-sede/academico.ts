import { useEffect, useState } from "react";
import { getCatedraticosSede, type CatedraticoSedeDto } from "../../lib/api";

// Utilidades compartidas por Cursos, Horarios y Catedráticos de la sede

export const DIAS_SEMANA = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export const etiquetaSeccion = (s: { nombre: string; grado: { nombre: string } }) => `${s.grado.nombre} ${s.nombre}`;

const minutos = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Horas semanales de una lista de bloques de horario */
export const horasSemanales = (bloques: { horaInicio: string; horaFin: string }[]) =>
  Math.round((bloques.reduce((acc, b) => acc + (minutos(b.horaFin) - minutos(b.horaInicio)), 0) / 60) * 10) / 10;

/** Catedráticos activos de la sede con sus cursos asignados */
export function useCatedraticos() {
  const [catedraticos, setCatedraticos] = useState<CatedraticoSedeDto[] | null>(null);
  const [error, setError] = useState("");

  const recargar = () =>
    getCatedraticosSede()
      .then(setCatedraticos)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los catedráticos."));

  useEffect(() => { recargar(); }, []);

  return { catedraticos, error, recargar };
}

import type { View } from "../types";
import Dashboard from "./catedratico/Dashboard";
import MisCursos from "./catedratico/MisCursos";
import LibretaNotas from "./catedratico/LibretaNotas";
import Asistencia from "./catedratico/Asistencia";
import Horario from "./catedratico/Horario";
import ComunicacionCatedratico from "./ComunicacionCatedratico";
import CalendarioEventos from "../components/CalendarioEventos";

export default function Catedratico({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  if (view === "cat-cursos") return <MisCursos />;
  if (view === "cat-notas") return <LibretaNotas />;
  if (view === "cat-asistencia") return <Asistencia />;
  if (view === "cat-horario") return <Horario />;
  if (view === "cat-calendario") return <CalendarioEventos />;
  if (view === "cat-comunicacion") return <ComunicacionCatedratico />;
  return <Dashboard onNavigate={onNavigate} />;
}

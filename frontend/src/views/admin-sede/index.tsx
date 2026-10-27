import type { View } from "../../types";
import DashboardSede from "./DashboardSede";
import AlumnosView from "./Alumnos";
import HorariosView from "./Horarios";
import BecasView from "./Becas";
import JustificacionesView from "./Justificaciones";
import NotificacionesView from "./Notificaciones";
import CalendarioView from "./Calendario";
import CatedraticosView from "./Catedraticos";
import GradosView from "./Grados";
import CursosView from "./Cursos";
import UsuariosView from "./Usuarios";
import SolicitudesView from "./Solicitudes";
import PagosVentanillaView from "./PagosVentanilla";

// Roles y permisos es solo del Administrador General (lo muestra AdminGeneral.tsx): crear, editar
// y asignar permisos a roles solo lo permite el backend a ese rol.
export default function AdminSede({ view }: { view: View }) {
  if (view === "as-usuarios") return <UsuariosView />;
  if (view === "as-catedraticos") return <CatedraticosView />;
  if (view === "as-solicitudes") return <SolicitudesView />;
  if (view === "as-alumnos") return <AlumnosView />;
  if (view === "as-grados") return <GradosView />;
  if (view === "as-cursos") return <CursosView />;
  if (view === "as-horarios") return <HorariosView />;
  if (view === "as-becas") return <BecasView />;
  if (view === "as-justificaciones") return <JustificacionesView />;
  if (view === "as-notificaciones") return <NotificacionesView />;
  if (view === "as-calendario") return <CalendarioView />;
  if (view === "as-pagos") return <PagosVentanillaView />;
  return <DashboardSede />;
}

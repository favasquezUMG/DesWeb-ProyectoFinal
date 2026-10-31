import type { AppUser, Role, View } from "../types";

// Menú de cada rol, sin íconos (los pone Layout): App lo usa para los permisos antes de cargar Layout.
// modulo: permiso que necesita el personal de sede para ver la pestaña.
// soloDirector: pestaña del Administrador de Sede que no depende de un permiso (ej. el Inicio).
export type ItemMenu = { label: string; view: View; modulo?: string; soloDirector?: boolean };

const MENU: Record<Role, ItemMenu[]> = {
  "admin-general": [
    { label: "Inicio", view: "ag-dashboard" },
    { label: "Sedes", view: "ag-sedes" },
    { label: "Malla Curricular", view: "ag-malla" },
    { label: "Reportería", view: "ag-reporteria" },
    { label: "Solicitudes", view: "as-solicitudes" },
    { label: "Calendario", view: "as-calendario" },
    { label: "Usuarios", view: "as-usuarios" },
    { label: "Pagos en ventanilla", view: "as-pagos" },
    { label: "Roles y Permisos", view: "as-roles" },
  ],
  "admin-sede": [
    { label: "Inicio", view: "as-dashboard", soloDirector: true },
    { label: "Usuarios", view: "as-usuarios", modulo: "usuarios" },
    { label: "Catedráticos", view: "as-catedraticos", modulo: "usuarios" },
    { label: "Solicitudes", view: "as-solicitudes", modulo: "matriculas" },
    { label: "Alumnos y Encargados", view: "as-alumnos", modulo: "alumnos" },
    { label: "Grados y Secciones", view: "as-grados", modulo: "horarios" },
    { label: "Cursos", view: "as-cursos", modulo: "horarios" },
    { label: "Horarios", view: "as-horarios", modulo: "horarios" },
    { label: "Becas", view: "as-becas", modulo: "becas" },
    { label: "Pagos en ventanilla", view: "as-pagos", modulo: "pagos" },
    { label: "Justificaciones", view: "as-justificaciones", modulo: "asistencia" },
    { label: "Notificaciones", view: "as-notificaciones", modulo: "comunicados" },
    { label: "Calendario", view: "as-calendario", modulo: "calendario" },
  ],
  "catedratico": [
    { label: "Inicio", view: "cat-dashboard" },
    { label: "Mis Cursos", view: "cat-cursos" },
    { label: "Libreta de Notas", view: "cat-notas" },
    { label: "Tareas y entregas", view: "cat-tareas" },
    { label: "Asistencia", view: "cat-asistencia" },
    { label: "Mi Horario", view: "cat-horario" },
    { label: "Calendario", view: "cat-calendario" },
    { label: "Comunicación con padres", view: "cat-comunicacion" },
  ],
  "alumno": [
    { label: "Inicio", view: "alu-dashboard" },
    { label: "Mis Notas", view: "alu-notas" },
    { label: "Mis Tareas", view: "alu-tareas" },
    { label: "Mi Horario", view: "alu-horario" },
    { label: "Calendario", view: "alu-calendario" },
  ],
  "padre": [
    { label: "Inicio", view: "pad-dashboard" },
    { label: "Matrícula", view: "pad-matricula" },
    { label: "Notas y Reportes", view: "pad-notas" },
    { label: "Tareas", view: "pad-tareas" },
    { label: "Asistencia", view: "pad-asistencia" },
    { label: "Horario", view: "pad-horario" },
    { label: "Calendario", view: "pad-calendario" },
    { label: "Pagos", view: "pad-pagos" },
    { label: "Circulares", view: "pad-circulares" },
    { label: "Becas", view: "pad-becas" },
    { label: "Avisos y Conducta", view: "pad-avisos" },
    { label: "Perfil", view: "pad-perfil" },
  ],
};

// El personal de sede (Administrador de Sede y los roles que crea el colegio, ej. Secretaría) solo ve
// las pestañas de los módulos que tiene permitidos.
// (Sesiones guardadas antes de los permisos no traen la lista: se muestra todo.)
export function menuDe(user: AppUser): ItemMenu[] {
  if (user.role !== "admin-sede") return MENU[user.role];
  return MENU[user.role].filter((item) =>
    item.soloDirector ? user.roleName === "Administrador de Sede"
      : !item.modulo || user.permisos === undefined || user.permisos.includes(item.modulo));
}

/** Pantallas que el usuario puede abrir (las de su menú) */
export function vistasPermitidas(user: AppUser): View[] {
  return menuDe(user).map((item) => item.view);
}

// Nombre de una pantalla tal como aparece en el menú (para el título de la pestaña)
export function tituloDeVista(view: View): string | undefined {
  for (const items of Object.values(MENU)) {
    const item = items.find((i) => i.view === view);
    if (item) return item.label;
  }
  return undefined;
}

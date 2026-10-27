export type Role = "admin-general" | "admin-sede" | "catedratico" | "alumno" | "padre";

export type View =
  // Admin General
  | "ag-dashboard" | "ag-sedes" | "ag-malla" | "ag-reporteria"
  // Admin Sede
  | "as-dashboard" | "as-usuarios" | "as-roles" | "as-catedraticos"
  | "as-alumnos" | "as-grados" | "as-cursos" | "as-horarios"
  | "as-becas" | "as-solicitudes" | "as-justificaciones" | "as-notificaciones" | "as-calendario"
  // Catedrático
  | "cat-dashboard" | "cat-cursos" | "cat-notas" | "cat-tareas" | "cat-asistencia" | "cat-horario" | "cat-calendario" | "cat-comunicacion"
  // Alumno
  | "alu-dashboard" | "alu-notas" | "alu-tareas" | "alu-horario" | "alu-calendario"
  // Padre
  | "pad-dashboard" | "pad-matricula" | "pad-notas" | "pad-tareas" | "pad-asistencia" | "pad-horario" | "pad-calendario" | "pad-pagos" | "pad-circulares" | "pad-becas" | "pad-avisos" | "pad-perfil";

export interface RolUsuario {
  rolId: number;
  nombre: string;
}

export interface AppUser {
  id: string;
  name: string;
  /** Interfaz que se muestra. Los roles creados por el colegio usan la de "admin-sede". */
  role: Role;
  /** Nombre real del rol activo (ej. "Secretaría") */
  roleName?: string;
  roleId?: number;
  /** Todos los roles de la persona (ej. Catedrático + Encargado) */
  roles?: RolUsuario[];
  /** Módulos administrativos del rol activo */
  permisos?: string[];
  email: string;
  initials: string;
  sede?: string;
  grado?: string;
  seccion?: string;
}

export interface Sede {
  id: string;
  nombre: string;
  ciudad: string;
  alumnos: number;
  catedraticos: number;
  aprobacion: number;
  mora: number;
}


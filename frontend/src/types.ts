export type Role = "admin-general" | "admin-sede" | "catedratico" | "alumno" | "padre";

export type View =
  // Admin General
  | "ag-dashboard" | "ag-sedes" | "ag-malla" | "ag-reporteria"
  // Admin Sede
  | "as-dashboard" | "as-usuarios" | "as-roles" | "as-catedraticos"
  | "as-alumnos" | "as-grados" | "as-cursos" | "as-horarios"
  | "as-becas" | "as-notificaciones" | "as-calendario"
  // Catedrático
  | "cat-dashboard" | "cat-cursos" | "cat-notas" | "cat-asistencia" | "cat-horario"
  // Alumno
  | "alu-dashboard" | "alu-notas" | "alu-horario" | "alu-calendario"
  // Padre
  | "pad-dashboard" | "pad-matricula" | "pad-notas" | "pad-pagos" | "pad-perfil";

export interface AppUser {
  id: string;
  name: string;
  role: Role;
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

export interface Alumno {
  id: string;
  nombre: string;
  grado: string;
  seccion: string;
  promedio: number;
  estado: "activo" | "inactivo" | "egresado";
  encargado: string;
  encargadoEmail: string;
  pagado: boolean;
  beca: number;
  carnet: string;
  nacimiento: string;
}

export interface Catedratico {
  id: string;
  nombre: string;
  email: string;
  cursos: string[];
  cargaHoraria: number;
  estado: "activo" | "inactivo";
}

export interface Curso {
  id: string;
  nombre: string;
  area: string;
  grado: string;
  seccion: string;
  catedratico: string;
  alumnos: number;
  horario: string;
}

export interface Nota {
  alumnoId: string;
  u1: number | null;
  u2: number | null;
  u3: number | null;
  u4: number | null;
}

export interface Pago {
  id: string;
  mes: string;
  monto: number;
  beca: number;
  total: number;
  estado: "pagado" | "pendiente" | "vencido";
  fecha: string | null;
}

export interface Evento {
  id: string;
  titulo: string;
  fecha: string;
  /** fecha final para eventos que abarcan varios días (YYYY-MM-DD) */
  fechaFin?: string;
  tipo: "clases" | "examen" | "descanso" | "actividad" | "asueto" | "festivo" | "institucional";
  descripcion?: string;
  recordatorio?: boolean;
}

export interface Notificacion {
  id: string;
  titulo: string;
  cuerpo: string;
  destinatarios: string;
  fecha: string;
  tipo: "aviso" | "sancion" | "actividad" | "asueto";
}

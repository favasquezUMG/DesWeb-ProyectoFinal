import type { AppUser, Role } from "../types";

const TOKEN_KEY = "dercas.token";
const USER_KEY = "dercas.user";

const ROLE_FROM_BACKEND: Record<string, Role> = {
  "Admin": "admin-general",
  "Administrador General": "admin-general",
  "Administrador de Sede": "admin-sede",
  "Catedratico": "catedratico",
  "Alumno": "alumno",
  "Encargado": "padre",
};

// Los roles creados por el colegio (Secretaría, Contabilidad...) son personal administrativo:
// usan la interfaz de sede y el menú se filtra con sus permisos.
export function mapBackendRole(nombreRol: string): Role {
  return ROLE_FROM_BACKEND[nombreRol] ?? "admin-sede";
}

export function getInitials(nombre: string): string {
  return nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

export interface BackendUsuario {
  usuarioId: number;
  nombre: string;
  apellidos?: string;
  email: string;
  rol: string;
  rolId?: number;
  sede?: string | null;
  roles?: { rolId: number; nombre: string }[];
  permisos?: string[];
}

export function buildAppUser(usuario: BackendUsuario): AppUser {
  const nombreCompleto = usuario.apellidos ? `${usuario.nombre} ${usuario.apellidos}` : usuario.nombre;
  return {
    id: String(usuario.usuarioId),
    name: nombreCompleto,
    role: mapBackendRole(usuario.rol),
    roleName: usuario.rol,
    roleId: usuario.rolId,
    roles: usuario.roles ?? [],
    permisos: usuario.permisos ?? [],
    email: usuario.email,
    initials: getInitials(nombreCompleto),
    sede: usuario.sede ?? undefined,
  };
}

export interface Session {
  token: string;
  user: AppUser;
}

export function saveSession(token: string, user: AppUser): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getSession(): Session | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;

  try {
    return { token, user: JSON.parse(rawUser) as AppUser };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

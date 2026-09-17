import type { AppUser, Role } from "../types";

const TOKEN_KEY = "dercas.token";
const USER_KEY = "dercas.user";

// El backend guarda los roles como texto ("Administrador General", ...);
// el frontend usa slugs cortos. Este mapeo conecta ambos mundos.
const ROLE_FROM_BACKEND: Record<string, Role> = {
  "Administrador General": "admin-general",
  "Administrador de Sede": "admin-sede",
  "Catedratico": "catedratico",
  "Alumno": "alumno",
  "Encargado": "padre",
};

export function mapBackendRole(nombreRol: string): Role {
  const role = ROLE_FROM_BACKEND[nombreRol];
  if (!role) throw new Error(`Rol no reconocido: ${nombreRol}`);
  return role;
}

function getInitials(nombre: string): string {
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
  email: string;
  rol: string;
}

export function buildAppUser(usuario: BackendUsuario): AppUser {
  return {
    id: String(usuario.usuarioId),
    name: usuario.nombre,
    role: mapBackendRole(usuario.rol),
    email: usuario.email,
    initials: getInitials(usuario.nombre),
  };
}

export interface Session {
  token: string;
  user: AppUser;
}

/** Guarda la sesión en localStorage para que sobreviva a un refresh de página. */
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

import { getToken } from "./auth";

// Si VITE_API_URL apunta a "localhost" pero la página se abrió desde otra
// máquina (ej. http://192.168.1.6:8443 vía la red local), "localhost" en el
// navegador de esa máquina no es el servidor de desarrollo: hay que usar el
// mismo host con el que se cargó la página.
function resolveApiUrl(): string {
  const configured = import.meta.env.VITE_API_URL;

  try {
    const url = new URL(configured);
    const configuredIsLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const pageIsRemote = window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1";

    if (configuredIsLocal && pageIsRemote) {
      url.hostname = window.location.hostname;
      return url.toString().replace(/\/$/, "");
    }
  } catch {
    // VITE_API_URL vacío o inválido: se usa tal cual
  }

  return configured;
}

const API_URL = resolveApiUrl();

/** Forma genérica de respuesta que usa el backend: { status, data?, message? } */
interface ApiEnvelope {
  status: "success" | "error";
  message?: string;
  [key: string]: unknown;
}

/**
 * Función base: arma la petición contra VITE_API_URL, adjunta el token si existe,
 * y lanza un error si status === 'error' (o si la petición HTTP falla).
 */
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, headers });
  } catch {
    throw new Error("No se pudo conectar con el servidor. Verifique su conexión e intente de nuevo.");
  }

  const body = (await response.json().catch(() => null)) as ApiEnvelope | null;

  if (!response.ok || !body || body.status === "error") {
    throw new Error(body?.message || "Ocurrió un error al comunicarse con el servidor.");
  }

  return body as T;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginResponse {
  status: "success";
  token: string;
  usuario: {
    usuarioId: number;
    nombre: string;
    email: string;
    rol: string;
  };
}

export function login(email: string, password: string): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export interface RolDto {
  rolId: number;
  nombre: string;
}

export async function getRoles(): Promise<RolDto[]> {
  const body = await request<{ status: "success"; data: RolDto[] }>("/api/roles/all");
  return body.data;
}

import { getToken } from "./auth";

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
  }

  return configured;
}

const API_URL = resolveApiUrl();

interface ApiEnvelope {
  status: "success" | "error";
  message?: string;
  [key: string]: unknown;
}

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

export interface RolDto {
  rolId: number;
  nombre: string;
}

export async function getRoles(): Promise<RolDto[]> {
  const body = await request<{ status: "success"; data: RolDto[] }>("/api/roles/all");
  return body.data;
}

export interface AlumnoDto {
  alumnoId: number;
  seccionId: number;
  usuario: { nombres: string; apellidos: string };
  seccion: { seccionId: number; nombre: string; grado: { nombre: string } };
}

export async function getAlumnos(): Promise<AlumnoDto[]> {
  const body = await request<{ status: "success"; data: AlumnoDto[] }>("/api/alumnos/all");
  return body.data;
}

export interface BecaDto {
  becaId: number;
  alumnoId: number;
  porcentaje: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFin: string | null;
  activa: boolean;
  alumno: {
    alumnoId: number;
    usuario: { nombres: string; apellidos: string };
    seccion: { nombre: string; grado: { nombre: string } };
  };
}

export interface BecaInput {
  alumnoId: number;
  porcentaje: number;
  descripcion?: string;
  fechaInicio: string;
  fechaFin?: string | null;
}

export async function getBecas(params?: { activa?: boolean }): Promise<BecaDto[]> {
  const query = params?.activa !== undefined ? `?activa=${params.activa}` : "";
  const body = await request<{ status: "success"; data: BecaDto[] }>(`/api/becas/all${query}`);
  return body.data;
}

export async function getBecaById(id: number): Promise<BecaDto> {
  const body = await request<{ status: "success"; data: BecaDto }>(`/api/becas/${id}`);
  return body.data;
}

export async function createBeca(input: BecaInput): Promise<BecaDto> {
  const body = await request<{ status: "success"; data: BecaDto }>("/api/becas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function updateBeca(id: number, input: Partial<BecaInput> & { activa?: boolean }): Promise<BecaDto> {
  const body = await request<{ status: "success"; data: BecaDto }>(`/api/becas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return body.data;
}

export function desactivarBeca(id: number): Promise<{ status: "success"; message: string }> {
  return request(`/api/becas/${id}`, { method: "DELETE" });
}

import { getToken, type BackendUsuario } from "./auth";

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

// Caché corto de lecturas: al volver a una pestaña los datos aparecen al instante en vez de
// esperar de nuevo al servidor. Cualquier escritura (POST/PUT/PATCH/DELETE) lo vacía, así que
// después de guardar algo siempre se vuelve a consultar.
const CACHE_MS = 30_000;
const cacheGet = new Map<string, { expira: number; promesa: Promise<unknown> }>();

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const metodo = (options.method ?? "GET").toUpperCase();
  if (metodo !== "GET") {
    cacheGet.clear();
    return requestServidor<T>(path, options);
  }

  // La clave incluye el token: al cambiar de usuario o de rol no se reutiliza lo anterior
  const clave = `${getToken() ?? ""} ${path}`;
  const guardado = cacheGet.get(clave);
  if (guardado && guardado.expira > Date.now()) return guardado.promesa as Promise<T>;

  const promesa = requestServidor<T>(path, options);
  cacheGet.set(clave, { expira: Date.now() + CACHE_MS, promesa });
  promesa.catch(() => cacheGet.delete(clave));
  return promesa;
}

async function requestServidor<T>(path: string, options: RequestInit): Promise<T> {
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
  usuario: BackendUsuario;
}

export function login(email: string, password: string, rolId?: number): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password, rolId }),
  });
}

// Entrega un token nuevo con otro de los roles del usuario (ej. catedrático → encargado)
export function cambiarRol(rolId: number): Promise<LoginResponse> {
  return request<LoginResponse>("/api/auth/cambiar-rol", {
    method: "POST",
    body: JSON.stringify({ rolId }),
  });
}

// Envía al correo un enlace para restablecer la contraseña
export function solicitarRecuperacion(email: string): Promise<{ status: "success"; message: string }> {
  return request("/api/auth/olvide-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function restablecerPassword(token: string, password: string): Promise<{ status: "success"; message: string }> {
  return request("/api/auth/restablecer-password", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}

export function cambiarPassword(actual: string, nueva: string): Promise<MessageResponse> {
  return request("/api/auth/cambiar-password", {
    method: "POST",
    body: JSON.stringify({ actual, nueva }),
  });
}

// ---------- Roles y permisos ----------

export type TipoRol = "global" | "comunidad" | "personal";

export interface RolDto {
  rolId: number;
  nombre: string;
  descripcion: string | null;
  esSistema: boolean;
  tipo: TipoRol;
  permisos: string[];
  permisosEditables: boolean;
  usuarios: number;
}

export interface ModuloDto {
  modulo: string;
  nombre: string;
}

export async function getRoles(): Promise<RolDto[]> {
  const body = await request<{ status: "success"; data: RolDto[] }>("/api/roles/all");
  return body.data;
}

export async function getModulos(): Promise<ModuloDto[]> {
  const body = await request<{ status: "success"; data: ModuloDto[] }>("/api/roles/modulos");
  return body.data;
}

export async function createRol(input: { nombre: string; descripcion?: string; permisos: string[] }): Promise<RolDto> {
  const body = await request<{ status: "success"; data: RolDto }>("/api/roles", { method: "POST", body: JSON.stringify(input) });
  return body.data;
}

export async function updateRol(id: number, input: { nombre?: string; descripcion?: string }): Promise<RolDto> {
  const body = await request<{ status: "success"; data: RolDto }>(`/api/roles/${id}`, { method: "PUT", body: JSON.stringify(input) });
  return body.data;
}

export async function guardarPermisosRol(id: number, permisos: string[]): Promise<RolDto> {
  const body = await request<{ status: "success"; data: RolDto }>(`/api/roles/${id}/permisos`, {
    method: "PUT",
    body: JSON.stringify({ permisos }),
  });
  return body.data;
}

export function deleteRol(id: number): Promise<{ status: "success"; message: string }> {
  return request(`/api/roles/${id}`, { method: "DELETE" });
}

// ---------- Usuarios ----------

export interface BitacoraDto {
  id: number;
  accion: string;
  entidad: string;
  detalle: string;
  fecha: string;
  usuario: string;
}

/** Registro de la bitácora de un usuario o alumno (historial de cambios) */
export interface RegistroBitacoraDto {
  bitacoraId: number;
  accion: string;
  entidad: string;
  detalle: string;
  fecha: string;
  usuario: { nombres: string; apellidos: string } | null;
}

export interface UsuarioDto {
  usuarioId: number;
  nombres: string;
  apellidos: string;
  email: string;
  rolId: number;
  sedeId: number | null;
  deletedAt: string | null;
  rol: { rolId: number; nombre: string };
  sede: { sedeId: number; nombre: string } | null;
  rolesAdicionales: { rolId: number; rol: { rolId: number; nombre: string } }[];
  catedratico: { especialidad: string | null } | null;
  encargado: { _count: { alumnosEncargado: number } } | null;
  alumno: { seccion: { nombre: string; grado: { nombre: string } } } | null;
}

export interface UsuarioDetalleDto extends UsuarioDto {
  dependencias: { cursosAsignados: number; alumnosACargo: { alumnoId: number; nombre: string }[]; esAlumno: boolean };
  bitacora: RegistroBitacoraDto[];
}

export interface UsuarioInput {
  nombres: string;
  apellidos: string;
  email: string;
  rolId: number;
  password?: string;
  sedeId?: number | null;
  rolesAdicionales?: number[];
  especialidad?: string;
  seccionId?: number;
  fechaNacimiento?: string;
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  return entries.length ? "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&") : "";
}

export async function getUsuarios(params: { q?: string; rolId?: number; estado?: "activos" | "inactivos" | "todos" } = {}): Promise<UsuarioDto[]> {
  const body = await request<{ status: "success"; data: UsuarioDto[] }>(`/api/usuarios${toQueryString(params)}`);
  return body.data;
}

export async function getUsuario(id: number): Promise<UsuarioDetalleDto> {
  const body = await request<{ status: "success"; data: UsuarioDetalleDto }>(`/api/usuarios/${id}`);
  return body.data;
}

export async function createUsuario(input: UsuarioInput): Promise<UsuarioDto & { passwordTemporal: string | null }> {
  const body = await request<{ status: "success"; data: UsuarioDto & { passwordTemporal: string | null } }>("/api/usuarios", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function updateUsuario(id: number, input: Partial<UsuarioInput>): Promise<UsuarioDto> {
  const body = await request<{ status: "success"; data: UsuarioDto }>(`/api/usuarios/${id}`, { method: "PUT", body: JSON.stringify(input) });
  return body.data;
}

export async function setRolesAdicionales(id: number, rolesAdicionales: number[]): Promise<UsuarioDto> {
  const body = await request<{ status: "success"; data: UsuarioDto }>(`/api/usuarios/${id}/roles`, {
    method: "PUT",
    body: JSON.stringify({ rolesAdicionales }),
  });
  return body.data;
}

export function cambiarEstadoUsuario(id: number, activo: boolean, motivo: string): Promise<{ status: "success"; message: string }> {
  return request(`/api/usuarios/${id}/estado`, { method: "PATCH", body: JSON.stringify({ activo, motivo }) });
}

// ---------- Alumnos y encargados ----------

export interface AlumnoDto {
  alumnoId: number;
  seccionId: number;
  fechaNacimiento?: string | null;
  usuario: { nombres: string; apellidos: string; email?: string };
  seccion: { seccionId: number; nombre: string; sedeId?: number; grado: { nombre: string; nivel?: string } };
  encargadosActivos?: number;
  contactoPrincipal?: string | null;
  tieneRestriccion?: boolean;
  /** null = según el nivel; true/false = excepción de la sede */
  accesoPortal?: boolean | null;
  accesoPortalEfectivo?: boolean;
  accesoPorNivel?: boolean;
}

export function setAccesoPortalAlumno(alumnoId: number, accesoPortal: boolean | null): Promise<{ status: "success"; message: string; data: { accesoPortal: boolean | null; accesoPortalEfectivo: boolean } }> {
  return request(`/api/alumnos/${alumnoId}/acceso-portal`, { method: "PATCH", body: JSON.stringify({ accesoPortal }) });
}

export async function getAlumnos(params?: { seccionId?: number; q?: string }): Promise<AlumnoDto[]> {
  const body = await request<{ status: "success"; data: AlumnoDto[] }>(`/api/alumnos/all${toQueryString({ ...params })}`);
  return body.data;
}

export interface VinculoEncargadoDto {
  alumnoId: number;
  encargadoId: number;
  parentesco: string | null;
  esPrincipal: boolean;
  responsableFinanciero: boolean;
  tieneCustodia: boolean;
  autorizadoRecoger: boolean;
  puedeVerNotas: boolean;
  puedeVerPagos: boolean;
  recibeNotificaciones: boolean;
  restringido: boolean;
  motivoRestriccion: string | null;
  vigenteDesde: string;
  vigenteHasta: string | null;
  activo: boolean;
  vigente: boolean;
  observaciones: string | null;
  encargado: {
    encargadoId: number;
    usuario: { usuarioId: number; nombres: string; apellidos: string; email: string; deletedAt: string | null };
  };
}

export interface EncargadosAlumnoDto {
  alumno: { alumnoId: number; nombre: string; grado: string };
  vinculos: VinculoEncargadoDto[];
  bitacora: RegistroBitacoraDto[];
  parentescos: string[];
  maximo: number;
}

export type DatosVinculoInput = Partial<Pick<VinculoEncargadoDto,
  "parentesco" | "esPrincipal" | "responsableFinanciero" | "tieneCustodia" | "autorizadoRecoger" |
  "puedeVerNotas" | "puedeVerPagos" | "recibeNotificaciones" | "restringido" | "motivoRestriccion" |
  "vigenteHasta" | "observaciones">>;

export interface EncargadoBusquedaDto {
  usuarioId: number;
  nombre: string;
  email: string;
  rol: string;
  esEncargado: boolean;
  alumnosACargo: number;
}

export async function getEncargadosDeAlumno(alumnoId: number): Promise<EncargadosAlumnoDto> {
  const body = await request<{ status: "success"; data: EncargadosAlumnoDto }>(`/api/alumnos/${alumnoId}/encargados`);
  return body.data;
}

export async function buscarEncargados(q: string): Promise<EncargadoBusquedaDto[]> {
  const body = await request<{ status: "success"; data: EncargadoBusquedaDto[] }>(`/api/alumnos/encargados/buscar?q=${encodeURIComponent(q)}`);
  return body.data;
}

export function agregarEncargado(
  alumnoId: number,
  input: DatosVinculoInput & { usuarioId?: number; nuevo?: { nombres: string; apellidos: string; email: string } }
): Promise<{ status: "success"; message: string; data: { usuarioId: number; passwordTemporal: string | null } }> {
  return request(`/api/alumnos/${alumnoId}/encargados`, { method: "POST", body: JSON.stringify(input) });
}

export function actualizarVinculo(alumnoId: number, encargadoId: number, input: DatosVinculoInput): Promise<{ status: "success"; message: string }> {
  return request(`/api/alumnos/${alumnoId}/encargados/${encargadoId}`, { method: "PUT", body: JSON.stringify(input) });
}

export function quitarEncargado(alumnoId: number, encargadoId: number, motivo: string): Promise<{ status: "success"; message: string }> {
  return request(`/api/alumnos/${alumnoId}/encargados/${encargadoId}`, { method: "DELETE", body: JSON.stringify({ motivo }) });
}

export interface ConteoAlumnosDto {
  total: number;
  totalAnterior: number;
  diferencia: number;
  porcentajeCrecimiento: number;
  subtexto: string;
}

export async function getConteoAlumnos(): Promise<ConteoAlumnosDto> {
  const body = await request<{ status: "success"; data: ConteoAlumnosDto }>("/api/alumnos/conteo-alumnos");
  return body.data;
}

export interface TasaAprobacionDTO {
  tasaAprobacion: number;
  promedioGeneral: number;
  subtexto: string;
}

export async function getTasaAprobacion(): Promise<TasaAprobacionDTO> {
  const body = await request<{ status: "success"; data: TasaAprobacionDTO }>("/api/alumnos/tasa-aprobacion");
  return body.data;
}

// ---------- Becas ----------

export type EstadoBeca = "Solicitada" | "Activa" | "Rechazada" | "Suspendida" | "Revocada" | "Finalizada";
export type TipoProgramaBeca = "Merito" | "Socioeconomica" | "Deportiva" | "Convenio" | "Otro";

export interface BecaHistorialDto {
  historialId: number;
  estadoAnterior: string | null;
  estadoNuevo: string;
  motivo: string;
  fecha: string;
  usuario: { nombres: string; apellidos: string } | null;
}

export interface BecaDto {
  becaId: number;
  alumnoId: number;
  programaId: number | null;
  anioLectivo: number;
  porcentaje: string;
  descripcion: string | null;
  fechaInicio: string;
  fechaFin: string;
  estado: EstadoBeca;
  createdAt: string;
  programa: { programaId?: number; nombre: string; tipo: string } | null;
  solicitadaPor?: { nombres: string; apellidos: string } | null;
  alumno: {
    alumnoId: number;
    usuario: { nombres: string; apellidos: string };
    seccion: { nombre: string; sedeId: number; grado: { nombre: string } };
  };
  historial?: BecaHistorialDto[];
}

export interface BecaInput {
  alumnoId: number;
  programaId: number;
  porcentaje?: number;
  descripcion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface BecaUpdateInput {
  porcentaje?: number;
  descripcion?: string;
  fechaInicio?: string;
  fechaFin?: string;
}

export interface PoliticaBecaDto {
  presupuestoMensual: number | null;
  descuentoHermanos: number;
  descuentoMaximo: number;
  configurada?: boolean;
}

export interface ResumenBecasDto {
  anioLectivo: number;
  sedeId: number | null;
  colegiaturaMensual: number;
  politica: PoliticaBecaDto | null;
  presupuestoUsado: number;
  presupuestoDisponible: number | null;
  porEstado: Record<EstadoBeca, number>;
}

export interface ProgramaBecaDto {
  programaId: number;
  sedeId: number;
  anioLectivo: number;
  nombre: string;
  tipo: TipoProgramaBeca;
  descripcion: string | null;
  porcentaje: string;
  cupos: number | null;
  cuposUsados: number;
  cuposDisponibles: number | null;
  promedioMinimo: string | null;
  pierdePorConductaGrave: boolean;
  permiteSolicitud: boolean;
  activo: boolean;
}

export interface ProgramaBecaInput {
  anioLectivo?: number;
  nombre?: string;
  tipo?: TipoProgramaBeca;
  descripcion?: string | null;
  porcentaje?: number;
  cupos?: number | null;
  promedioMinimo?: number | null;
  pierdePorConductaGrave?: boolean;
  permiteSolicitud?: boolean;
  activo?: boolean;
}

export interface EvaluacionBecasDto {
  revisadas: number;
  suspendidas: { becaId: number; alumno: string; programa: string; motivo: string }[];
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== "");
  if (entries.length === 0) return "";
  return "?" + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join("&");
}

export async function getBecas(params?: { estado?: string; anioLectivo?: number; programaId?: number }): Promise<BecaDto[]> {
  const body = await request<{ status: "success"; data: BecaDto[] }>(`/api/becas/all${toQuery({ ...params })}`);
  return body.data;
}

export async function getResumenBecas(anioLectivo: number): Promise<ResumenBecasDto> {
  const body = await request<{ status: "success"; data: ResumenBecasDto }>(`/api/becas/resumen?anioLectivo=${anioLectivo}`);
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

export async function updateBeca(id: number, input: BecaUpdateInput): Promise<BecaDto> {
  const body = await request<{ status: "success"; data: BecaDto }>(`/api/becas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return body.data;
}

export function cambiarEstadoBeca(id: number, estado: EstadoBeca, motivo: string): Promise<{ status: "success"; message: string; data: BecaDto }> {
  return request(`/api/becas/${id}/estado`, {
    method: "PATCH",
    body: JSON.stringify({ estado, motivo }),
  });
}

export async function renovarBeca(id: number, anioLectivo?: number): Promise<BecaDto> {
  const body = await request<{ status: "success"; data: BecaDto }>(`/api/becas/${id}/renovar`, {
    method: "POST",
    body: JSON.stringify({ anioLectivo }),
  });
  return body.data;
}

export function evaluarBecas(anioLectivo: number): Promise<{ status: "success"; message: string; data: EvaluacionBecasDto }> {
  return request("/api/becas/evaluar", { method: "POST", body: JSON.stringify({ anioLectivo }) });
}

export async function getProgramasBeca(anioLectivo: number, incluirInactivos = false): Promise<ProgramaBecaDto[]> {
  const body = await request<{ status: "success"; data: ProgramaBecaDto[] }>(
    `/api/becas/programas${toQuery({ anioLectivo, incluirInactivos: incluirInactivos || undefined })}`
  );
  return body.data;
}

export async function createProgramaBeca(input: ProgramaBecaInput): Promise<ProgramaBecaDto> {
  const body = await request<{ status: "success"; data: ProgramaBecaDto }>("/api/becas/programas", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function updateProgramaBeca(id: number, input: ProgramaBecaInput): Promise<ProgramaBecaDto> {
  const body = await request<{ status: "success"; data: ProgramaBecaDto }>(`/api/becas/programas/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function guardarPoliticaBecas(input: PoliticaBecaDto & { anioLectivo: number }): Promise<PoliticaBecaDto> {
  const body = await request<{ status: "success"; data: PoliticaBecaDto }>("/api/becas/politica", {
    method: "PUT",
    body: JSON.stringify(input),
  });
  return body.data;
}

export interface DescuentoColegiaturaDto {
  beca: number;
  hermanos: number;
  total: number;
  programa: string | null;
  topeAplicado: boolean;
}

export interface HijoBecasDto {
  alumnoId: number;
  nombre: string;
  grado: string;
  becas: (Omit<BecaDto, "alumno"> & { historial: BecaHistorialDto[] })[];
  descuento: DescuentoColegiaturaDto;
  programasDisponibles: ProgramaBecaDto[];
}

export interface MisBecasDto {
  colegiaturaMensual: number;
  puedeSolicitar: boolean;
  hijos: HijoBecasDto[];
}

export async function getMisBecas(): Promise<MisBecasDto> {
  const body = await request<{ status: "success"; data: MisBecasDto }>("/api/becas/mias");
  return body.data;
}

export function solicitarBeca(input: { alumnoId: number; programaId: number; justificacion: string }): Promise<{ status: "success"; message: string }> {
  return request("/api/becas/solicitar", { method: "POST", body: JSON.stringify(input) });
}

type MessageResponse = { status: "success"; message: string };

export interface MetricaBecaDto{
  becasActivas: number;
  porcentajeAlumnado: number;
  subtexto: string;
}

export async function getBecasActivasMetrica(): Promise<MetricaBecaDto> {
  const body = await request<{ status: "success"; data: MetricaBecaDto }>("/api/becas/becas-activas")
  return body.data;
}

// ---------- Cursos del catedrático ----------

export interface HorarioCursoDto {
  horarioId: number;
  diaSemana: number; // 1 = Lunes ... 7 = Domingo
  horaInicio: string; // "HH:MM"
  horaFin: string;
}

export interface CursoSeccionDto {
  cursoSeccionId: number;
  seccionId: number;
  curso: { cursoId: number; nombre: string };
  seccion: { seccionId: number; nombre: string; sedeId: number; anioLectivo?: number; grado: { nombre: string }; sede?: { nombre: string } };
  horarios?: HorarioCursoDto[];
}

export async function getCursosDeCatedratico(catedraticoId: number): Promise<CursoSeccionDto[]> {
  const body = await request<{ status: "success"; data: CursoSeccionDto[] }>(`/api/curso-seccion/catedratico/${catedraticoId}`);
  return body.data;
}

// ---------- Libreta de notas y actividades ----------

// Cada unidad vale 100: zona (tareas, proyectos...) 60 y examen 40
export type TipoActividad = "Zona" | "Examen";

export interface ActividadDto {
  actividadId: number;
  nombre: string;
  puntosMaximos: number;
  tipo: TipoActividad;
  fecha: string | null; // "YYYY-MM-DD"
}

export interface LibretaDto {
  cursoSeccionId: number;
  curso: string;
  grado: string;
  seccion: string;
  unidades: { unidadId: number; numero: number; actividades: ActividadDto[] }[];
  alumnos: { alumnoId: number; nombres: string; apellidos: string }[];
  notas: { actividadId: number; alumnoId: number; valor: number }[];
}

export async function getLibreta(cursoSeccionId: number): Promise<LibretaDto> {
  const body = await request<{ status: "success"; data: LibretaDto }>(`/api/notas/curso-seccion/${cursoSeccionId}`);
  return body.data;
}

export interface ActividadInput {
  unidadId: number;
  nombre: string;
  puntosMaximos: number;
  tipo: TipoActividad;
  fecha: string;
}

export function createActividad(input: ActividadInput): Promise<{ status: "success" }> {
  return request("/api/actividades", { method: "POST", body: JSON.stringify(input) });
}

export function updateActividad(id: number, input: Omit<ActividadInput, "unidadId">): Promise<{ status: "success" }> {
  return request(`/api/actividades/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function deleteActividad(id: number): Promise<MessageResponse> {
  return request(`/api/actividades/${id}`, { method: "DELETE" });
}

// valor null borra la nota registrada
export function guardarNotasActividad(actividadId: number, notas: { alumnoId: number; valor: number | null }[]): Promise<MessageResponse> {
  return request("/api/notas/bulk", { method: "POST", body: JSON.stringify({ actividadId, notas }) });
}

// ---------- Asistencia ----------

export type EstadoAsistencia = "Presente" | "Tarde" | "Ausente" | "Justificado";

export interface ListaAsistenciaDto {
  cursoSeccionId: number;
  curso: string;
  grado: string;
  seccion: string;
  fecha: string;
  yaRegistrada: boolean;
  alumnos: {
    alumnoId: number; nombres: string; apellidos: string; estado: EstadoAsistencia | null; asistenciaId: number | null;
    /** La sede aprobó la justificación de ese día: la falta se registra como "Justificado" */
    diaJustificado: boolean;
    /** Sin registro en esta clase, pero otro catedrático ya lo marcó ausente ese día */
    ausenteEnOtraClase: boolean;
  }[];
}

export async function getListaAsistencia(cursoSeccionId: number, fecha?: string): Promise<ListaAsistenciaDto> {
  const query = fecha ? `?fecha=${encodeURIComponent(fecha)}` : "";
  const body = await request<{ status: "success"; data: ListaAsistenciaDto }>(`/api/asistencia/lista/${cursoSeccionId}${query}`);
  return body.data;
}

export function pasarLista(input: { cursoSeccionId: number; fecha: string; asistencias: { alumnoId: number; estado: EstadoAsistencia }[] }): Promise<MessageResponse> {
  return request("/api/asistencia/pasar-lista", { method: "POST", body: JSON.stringify(input) });
}

export interface ResumenAsistenciaDto {
  curso: string;
  grado: string;
  seccion: string;
  diasRegistrados: number;
  alumnos: {
    alumnoId: number; nombres: string; apellidos: string;
    presentes: number; tardes: number; ausentes: number; justificados: number;
    totalRegistrado: number; porcentaje: number;
  }[];
}

export async function getResumenAsistencia(cursoSeccionId: number): Promise<ResumenAsistenciaDto> {
  const body = await request<{ status: "success"; data: ResumenAsistenciaDto }>(`/api/asistencia/resumen/${cursoSeccionId}`);
  return body.data;
}

// ---------- Justificación de ausencias ----------

export type EstadoJustificacion = "Pendiente" | "Aprobada" | "Rechazada";

export interface JustificacionDto {
  justificacionId: number;
  alumnoId: number;
  fecha: string;
  motivo: string;
  estado: EstadoJustificacion;
  comentario: string | null;
  fechaSolicitud: string;
  fechaRevision: string | null;
  revisor?: { nombres: string; apellidos: string } | null;
}

export interface AsistenciaHijoDto {
  alumnoId: number;
  nombre: string;
  grado: string;
  resumen: { presentes: number; tardes: number; ausentes: number; justificados: number; total: number; porcentaje: number };
  dias: { fecha: string; clases: { curso: string; estado: EstadoAsistencia }[] }[];
  justificaciones: JustificacionDto[];
}

export interface JustificacionAdminDto extends JustificacionDto {
  alumno: { alumnoId: number; usuario: { nombres: string; apellidos: string }; seccion: { nombre: string; grado: { nombre: string } } };
  solicitante: { usuarioId: number; nombres: string; apellidos: string; email: string };
  clases: { curso: string; estado: EstadoAsistencia }[];
}

export async function getAsistenciaHijos(): Promise<AsistenciaHijoDto[]> {
  const body = await request<{ status: "success"; data: AsistenciaHijoDto[] }>("/api/justificaciones/mis-hijos");
  return body.data;
}

export function solicitarJustificacion(input: { alumnoId: number; fecha: string; motivo: string }): Promise<{ status: "success"; message: string; data: JustificacionDto }> {
  return request("/api/justificaciones", { method: "POST", body: JSON.stringify(input) });
}

export function cancelarJustificacion(id: number): Promise<MessageResponse> {
  return request(`/api/justificaciones/${id}`, { method: "DELETE" });
}

export async function getJustificaciones(estado?: EstadoJustificacion): Promise<JustificacionAdminDto[]> {
  const body = await request<{ status: "success"; data: JustificacionAdminDto[] }>(`/api/justificaciones${estado ? `?estado=${estado}` : ""}`);
  return body.data;
}

export function revisarJustificacion(id: number, estado: "Aprobada" | "Rechazada", comentario?: string): Promise<{ status: "success"; message: string; data: JustificacionDto }> {
  return request(`/api/justificaciones/${id}/revisar`, { method: "PATCH", body: JSON.stringify({ estado, comentario }) });
}

// ---------- Envío de notas a encargados ----------

export interface EnvioNotasInput {
  cursoSeccionId?: number;
  seccionId?: number;
  alumnoId?: number;
}

export interface EnvioNotasResponse {
  status: "success";
  message: string;
  data: { alumnos: number; encargados: number; alumnosSinEncargado: string[] };
}

export function enviarNotasAEncargados(input: EnvioNotasInput): Promise<EnvioNotasResponse> {
  return request<EnvioNotasResponse>("/api/notas/enviar-encargados", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface TendenciaNotasDto {
  mes: string;
  promedio: number;
}

export async function getTendenciaNotas(): Promise<TendenciaNotasDto[]>{
  const body = await request<{ status: "success"; data: TendenciaNotasDto[] }>("/api/notas/tendencia-notas");
  return body.data
}

// ---------- Reportes de conducta ----------

export type TipoConducta = "Positivo" | "Leve" | "Grave";

export interface ReporteConductaDto {
  reporteId: number;
  alumnoId: number;
  autorId: number;
  tipo: TipoConducta;
  titulo: string;
  descripcion: string;
  fecha: string;
  revisado: boolean;
  fechaRevision: string | null;
  comentarioEncargado: string | null;
  alumno: {
    alumnoId: number;
    usuario: { nombres: string; apellidos: string };
    seccion: { seccionId: number; nombre: string; sedeId: number; grado: { nombre: string } };
  };
  autor: { usuarioId: number; nombres: string; apellidos: string };
}

export interface ReporteConductaInput {
  alumnoId: number;
  tipo: TipoConducta;
  titulo: string;
  descripcion: string;
  /** Encargados a notificar; si se omite se notifica a todos los que reciben notificaciones */
  encargadoIds?: number[];
}

export interface DestinatarioConductaDto {
  encargadoId: number;
  nombre: string;
  email: string;
  parentesco: string | null;
  esPrincipal: boolean;
}

export async function getDestinatariosConducta(alumnoId: number): Promise<DestinatarioConductaDto[]> {
  const body = await request<{ status: "success"; data: DestinatarioConductaDto[] }>(`/api/conducta/destinatarios?alumnoId=${alumnoId}`);
  return body.data;
}

export async function getReportesConducta(params?: { alumnoId?: number; revisado?: boolean }): Promise<ReporteConductaDto[]> {
  const query = new URLSearchParams();
  if (params?.alumnoId !== undefined) query.set("alumnoId", String(params.alumnoId));
  if (params?.revisado !== undefined) query.set("revisado", String(params.revisado));
  const qs = query.toString();
  const body = await request<{ status: "success"; data: ReporteConductaDto[] }>(`/api/conducta${qs ? `?${qs}` : ""}`);
  return body.data;
}

export function createReporteConducta(input: ReporteConductaInput): Promise<{ status: "success"; message: string; data: ReporteConductaDto }> {
  return request("/api/conducta", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function revisarReporteConducta(id: number, comentario?: string): Promise<ReporteConductaDto> {
  const body = await request<{ status: "success"; data: ReporteConductaDto }>(`/api/conducta/${id}/revisar`, {
    method: "PATCH",
    body: JSON.stringify({ comentario }),
  });
  return body.data;
}

export function deleteReporteConducta(id: number): Promise<MessageResponse> {
  return request(`/api/conducta/${id}`, { method: "DELETE" });
}

// ---------- Comunicados y notificaciones ----------

export type TipoComunicado = "Aviso" | "Sancion" | "Actividad" | "Asueto";
export type DestinoComunicado = "encargados" | "catedraticos" | "alumnos" | "todos" | "seccion";

export interface ComunicadoDto {
  comunicadoId: number;
  sedeId: number | null;
  tipo: TipoComunicado;
  titulo: string;
  mensaje: string;
  destinatarios: string;
  totalDestinatarios: number;
  fechaEnvio: string;
  autor: { nombres: string; apellidos: string };
  sede: { nombre: string } | null;
}

export interface ComunicadoInput {
  tipo: TipoComunicado;
  titulo: string;
  mensaje: string;
  destino: DestinoComunicado;
  seccionId?: number;
}

export async function getComunicados(): Promise<ComunicadoDto[]> {
  const body = await request<{ status: "success"; data: ComunicadoDto[] }>("/api/notificaciones/comunicados");
  return body.data;
}

export function enviarComunicado(input: ComunicadoInput): Promise<{ status: "success"; message: string; data: ComunicadoDto }> {
  return request("/api/notificaciones/comunicados", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface NotificacionDto {
  notificacionId: number;
  titulo: string;
  mensaje: string;
  tipo: string;
  fechaEnvio: string;
  leida: boolean;
}

export async function getMisNotificaciones(): Promise<NotificacionDto[]> {
  const body = await request<{ status: "success"; data: NotificacionDto[] }>("/api/notificaciones/mias");
  return body.data;
}

export function marcarNotificacionLeida(id: number): Promise<MessageResponse> {
  return request(`/api/notificaciones/${id}/leida`, { method: "PATCH" });
}

export function marcarTodasNotificacionesLeidas(): Promise<MessageResponse> {
  return request("/api/notificaciones/leidas", { method: "PATCH" });
}

// ---------- Eventos ----------

export type TipoEvento = "Festivo" | "Academico" | "Deportivo" | "Reunion";

export interface EventoDto {
  eventoId: number;
  sedeId: number | null;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  tipoEvento: TipoEvento | string;
  enviarRecordatorio?: boolean;
  sede: { nombre: string } | null;
  // Eventos con cobro (los paga el padre desde el carrito)
  requierePago: boolean;
  costo: string | null;
  cupoMaximo: number | null;
  fechaLimiteInscripcion: string | null;
}

// Sin sedeId el backend devuelve los eventos generales y los de la sede del usuario
export async function getEventos(): Promise<EventoDto[]> {
  const body = await request<{ status: "success"; data: EventoDto[] }>("/api/events");
  return body.data;
}

export function enviarRecordatorioEvento(eventoId: number): Promise<MessageResponse> {
  return request(`/api/events/${eventoId}/recordatorio`, { method: "POST" });
}

// ---------- Sedes ----------

export interface SedeDto {
  sedeId: number;
  nombre: string;
  direccion: string | null;
  telefono?: string | null;
}

export type CrearSedePayload = {
  nombre: string;
  direccion?: string;
  telefono?: string;
};

export type ActualizarSedePayload = {
  nombre?: string;
  direccion?: string;
  telefono?: string;
  activo?: boolean;
};

export interface SedeMetricaDto {
  sedeId: number;
  nombre: string;
  alumnos: number;
  aprobacion: number;
  mora: number;
}

export async function getSedes(): Promise<SedeDto[]> {
  const body = await request<{ status: "success"; data: SedeDto[] }>("/api/sedes");
  return body.data;
}

export async function createSede(payload: CrearSedePayload): Promise<SedeDto> {
  const body = await request<{ status: "success"; data: SedeDto }>("/api/sedes", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function updateSede(
  sedeId: number,
  payload: ActualizarSedePayload
): Promise<SedeDto> {
  const body = await request<{ status: "success"; data: SedeDto }>(`/api/sedes/${sedeId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return body.data;
}

export async function getSedesMetricas(): Promise<SedeMetricaDto[]> {
  const body = await request<{ status: "success"; data: SedeMetricaDto[] }>("/api/sedes/metricas")
  return body.data;
}

// ---------- Página principal (pública) ----------

export interface InfoInicioDto {
  sedes: { sedeId: number; nombre: string; direccion: string | null; telefono: string | null }[];
  niveles: { nivel: string; grados: string[] }[];
}

export async function getInfoInicio(): Promise<InfoInicioDto> {
  const body = await request<{ status: "success"; data: InfoInicioDto }>("/api/publico/inicio");
  return body.data;
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

export interface HijoDto {
  alumnoId: number;
  nombre: string;
  grado: string;
  seccion: string;
}

/**
 * "Sin registrar" = nunca se intentó pagar; "Pendiente" = se abrió el pago pero no se completó;
 * "Exonerado" = la beca (y/o descuento por hermanos) cubre el 100% del mes.
 */
export type EstadoPagoBackend = "Pagado" | "Pendiente" | "Reembolsado" | "Exonerado" | "Sin registrar";

export interface MesEstadoCuentaDto {
  mes: number;
  nombreMes: string;
  estado: EstadoPagoBackend;
  /** Monto registrado del pago (null si no hay registro). */
  monto: number | null;
  montoBase: number;
  descuentoPorcentaje: number;
  /** Lo que toca pagar ese mes, con beca aplicada. */
  montoAPagar: number;
  fechaPago: string | null;
}

export interface EstadoCuentaDto {
  alumno: string;
  grado: string;
  seccion: string;
  anioLectivo: number;
  mesesPagados: number;
  mesesPendientes: number;
  totalPagado: number;
  detalle: MesEstadoCuentaDto[];
}

export interface IntentPagoDto {
  pagoId: number;
  clientSecret: string;
  paymentIntentId: string;
  alumno: string;
  concepto: string;
  montoBase: number;
  descuentoPorcentaje: number;
  montoFinal: number;
  exonerado: boolean;
}

export interface VerificacionPagoDto {
  pagado: boolean;
  estadoStripe: string;
  estadoLocal: EstadoPagoBackend | null;
  monto: number;
  fechaPago: string | null;
}

export async function getMisHijos(): Promise<HijoDto[]> {
  const body = await request<{ status: "success"; data: HijoDto[] }>("/api/pagos/mis-hijos");
  return body.data;
}

export async function getEstadoCuenta(alumnoId: number, anioLectivo?: number): Promise<EstadoCuentaDto> {
  const query = anioLectivo ? `?anioLectivo=${anioLectivo}` : "";
  const body = await request<{ status: "success"; data: EstadoCuentaDto }>(`/api/pagos/estado-cuenta/${alumnoId}${query}`);
  return body.data;
}

/** Prepara el cobro en Stripe y devuelve el clientSecret para montar el formulario de tarjeta. */
export async function crearIntentPago(input: { alumnoId: number; anioLectivo: number; mes: number }): Promise<IntentPagoDto> {
  const body = await request<{ status: "success"; data: IntentPagoDto }>("/api/pagos/intent", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return body.data;
}

export async function verificarPago(paymentIntentId: string): Promise<VerificacionPagoDto> {
  const body = await request<{ status: "success"; data: VerificacionPagoDto }>(`/api/pagos/verificar/${paymentIntentId}`);
  return body.data;
}

// ─── Carrito de pagos (eventos con cobro + colegiaturas) ───────────────────────

export interface EventoDisponibleDto {
  eventoId: number;
  nombre: string;
  descripcion: string | null;
  tipoEvento: string;
  fecha: string;
  fechaLimiteInscripcion: string;
  costo: number;
  cupoMaximo: number | null;
  /** null = sin límite de cupo. */
  cuposDisponibles: number | null;
  inscripcionAbierta: boolean;
  alumnos: { alumnoId: number; nombre: string; inscrito: boolean }[];
}

export type ItemCarritoInput =
  | { tipo: "evento"; alumnoId: number; eventoId: number }
  | { tipo: "colegiatura"; alumnoId: number; anioLectivo: number; mes: number };

export interface IntentCarritoDto {
  ordenId: number;
  clientSecret: string;
  paymentIntentId: string;
  total: number;
  lineas: { tipo: "evento" | "colegiatura"; alumnoId: number; alumno: string; descripcion: string; monto: number }[];
}

export interface InscripcionDto {
  inscripcionId: number;
  eventoId: number;
  evento: string;
  fecha: string;
  alumnoId: number;
  alumno: string;
  monto: number;
  estado: "Confirmada" | "Reembolsada";
  fechaPago: string | null;
}

export async function getEventosDisponibles(): Promise<EventoDisponibleDto[]> {
  const body = await request<{ status: "success"; data: EventoDisponibleDto[] }>("/api/pagos/carrito/eventos");
  return body.data;
}

export async function getMisInscripciones(): Promise<InscripcionDto[]> {
  const body = await request<{ status: "success"; data: InscripcionDto[] }>("/api/pagos/carrito/inscripciones");
  return body.data;
}

/** El servidor valida cada concepto y calcula el total; el frontend solo dice qué quiere pagar. */
export async function crearIntentCarrito(items: ItemCarritoInput[]): Promise<IntentCarritoDto> {
  const body = await request<{ status: "success"; data: IntentCarritoDto }>("/api/pagos/carrito/intent", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
  return body.data;
}

export async function verificarCarrito(paymentIntentId: string): Promise<VerificacionPagoDto> {
  const body = await request<{ status: "success"; data: VerificacionPagoDto }>(`/api/pagos/carrito/verificar/${paymentIntentId}`);
  return body.data;
}

// ─── Eventos con cobro (administración) ───────────────────────────────────────

export interface InscritosEventoDto {
  eventoId: number;
  nombre: string;
  cupoMaximo: number | null;
  inscritos: number;
  recaudado: number;
  detalle: { inscripcionId: number; alumnoId: number; alumno: string; grado: string; monto: number; estado: string; fechaPago: string | null }[];
}

export async function getInscritosEvento(eventoId: number): Promise<InscritosEventoDto> {
  const body = await request<{ status: "success"; data: InscritosEventoDto }>(`/api/events/${eventoId}/inscritos`);
  return body.data;
}

// --- Pagos ---
export interface MetricaMoraDto {
  porcentajeMora: number;
  cuentasPendientes: number;
  subtexto: string;
}

export async function getMoraPagosMetrica(): Promise<MetricaMoraDto> {
  const body = await request<{ status: "success"; data: MetricaMoraDto }>("/api/pagos/metrica-mora");
  return body.data;
}

// --- Bitacora ---
export async function getActividadReciente(): Promise<BitacoraDto[]> {
  const body = await request<{ status: "success", data: BitacoraDto[]}>("/api/bitacora/actividad-reciente");
  return body.data
}

// ---------- Vista del encargado ----------

export interface HijoEncargadoDto {
  alumnoId: number;
  nombre: string;
  email: string;
  grado: string;
  seccion: string;
  sede: string;
  sedeId: number;
  anioLectivo: number;
  /** Tiene matrícula del ciclo pero ninguna activa */
  retirado: boolean;
  parentesco: string | null;
  esPrincipal: boolean;
  responsableFinanciero: boolean;
  autorizadoRecoger: boolean;
  puedeVerNotas: boolean;
  puedeVerPagos: boolean;
  recibeNotificaciones: boolean;
  vigenteHasta: string | null;
  /** Usuario con el que el alumno entra al portal */
  usuarioPortal: string;
  accesoPortal: boolean;
  accesoPorNivel: boolean;
}

export interface UnidadBoletinDto {
  numero: number;
  zona: number | null;
  examen: number | null;
  /** null = la unidad todavía no tiene notas registradas */
  nota: number | null;
}

export interface CursoBoletinDto {
  cursoSeccionId: number;
  curso: string;
  catedratico: string;
  /** null = sección actual; si no, la sección de la que fue trasladado en este ciclo */
  seccionAnterior: string | null;
  unidades: UnidadBoletinDto[];
  promedio: number | null;
  aprobado: boolean | null;
}

export interface BoletinHijoDto {
  alumnoId: number;
  nombre: string;
  grado: string;
  seccion: string;
  sede: string;
  anioLectivo: number;
  notaAprobacion: number;
  promedioGeneral: number | null;
  cursosAprobados: number;
  cursosEvaluados: number;
  cursos: CursoBoletinDto[];
}

export interface SeccionMatriculaDto {
  seccionId: number;
  nombre: string;
  anioLectivo: number;
  alumnos: number;
  grado: { gradoId: number; nombre: string; nivel: string; orden: number };
  sede: { sedeId: number; nombre: string };
  cursos: string[];
}

export interface OpcionesMatriculaDto {
  puedeMatricular: boolean;
  matriculas: { matriculaId: number; anioLectivo: number; estado: string; fechaMatricula: string; grado: string; seccion: string; sede: string }[];
  secciones: SeccionMatriculaDto[];
}

export interface MatriculaCreadaResponse {
  status: "success";
  message: string;
  data: { matricula: { matriculaId: number; anioLectivo: number }; cursosAsignados: { cursoSeccionId: number; nombre: string }[] };
}

export async function getHijosEncargado(): Promise<HijoEncargadoDto[]> {
  const body = await request<{ status: "success"; data: HijoEncargadoDto[] }>("/api/encargado/hijos");
  return body.data;
}

export async function getBoletinHijo(alumnoId: number): Promise<BoletinHijoDto> {
  const body = await request<{ status: "success"; data: BoletinHijoDto }>(`/api/encargado/hijos/${alumnoId}/notas`);
  return body.data;
}

export async function getOpcionesMatricula(alumnoId: number): Promise<OpcionesMatriculaDto> {
  const body = await request<{ status: "success"; data: OpcionesMatriculaDto }>(`/api/encargado/hijos/${alumnoId}/matricula`);
  return body.data;
}

export function crearMatricula(input: { alumnoId: number; seccionId: number; encargadoId: number; anioLectivo: number }): Promise<MatriculaCreadaResponse> {
  return request("/api/matriculas", { method: "POST", body: JSON.stringify(input) });
}

export function setNotificacionesHijo(alumnoId: number, recibeNotificaciones: boolean): Promise<MessageResponse> {
  return request(`/api/encargado/hijos/${alumnoId}/notificaciones`, {
    method: "PATCH",
    body: JSON.stringify({ recibeNotificaciones }),
  });
}

export function restablecerPasswordHijo(alumnoId: number, password: string): Promise<MessageResponse> {
  return request(`/api/encargado/hijos/${alumnoId}/password`, { method: "POST", body: JSON.stringify({ password }) });
}

// ---------- Portal del alumno ----------

export interface PerfilAlumnoDto {
  alumnoId: number;
  nombre: string;
  usuario: string;
  grado: string;
  nivel: string;
  seccion: string;
  sede: string;
  anioLectivo: number;
  encargadoPrincipal: string | null;
}

export interface ClaseAlumnoDto {
  horarioId: number;
  cursoSeccionId: number;
  diaSemana: number; // 1 = Lunes ... 7 = Domingo
  horaInicio: string; // "HH:MM"
  horaFin: string;
  curso: string;
  catedratico: string;
}

export interface AsistenciaAlumnoDto {
  resumen: AsistenciaHijoDto["resumen"];
  dias: AsistenciaHijoDto["dias"];
}

export async function getPerfilAlumno(): Promise<PerfilAlumnoDto> {
  const body = await request<{ status: "success"; data: PerfilAlumnoDto }>("/api/portal-alumno/perfil");
  return body.data;
}

/** Mismo formato que el boletín que ve el encargado */
export async function getMisNotasAlumno(): Promise<BoletinHijoDto> {
  const body = await request<{ status: "success"; data: BoletinHijoDto }>("/api/portal-alumno/notas");
  return body.data;
}

export async function getMiHorarioAlumno(): Promise<ClaseAlumnoDto[]> {
  const body = await request<{ status: "success"; data: ClaseAlumnoDto[] }>("/api/portal-alumno/horario");
  return body.data;
}

export async function getMiAsistenciaAlumno(): Promise<AsistenciaAlumnoDto> {
  const body = await request<{ status: "success"; data: AsistenciaAlumnoDto }>("/api/portal-alumno/asistencia");
  return body.data;
}

export async function getHorarioHijo(alumnoId: number): Promise<ClaseAlumnoDto[]> {
  const body = await request<{ status: "success"; data: ClaseAlumnoDto[] }>(`/api/encargado/hijos/${alumnoId}/horario`);
  return body.data;
}

// ---------- Solicitudes de inscripción (administración) ----------

export type EstadoSolicitudDto = "PENDIENTE" | "REVISION" | "APROBADA" | "RECHAZADA" | "VENCIDA";

export interface SolicitudDto {
  solicitudId: number;
  numero: string;
  modo: "PUBLICO" | "PRESENCIAL";
  estado: EstadoSolicitudDto;
  encargadoNombres: string;
  encargadoApellidos: string;
  encargadoDpi: string;
  encargadoTelefono: string;
  encargadoCorreo: string;
  encargadoParentesco: string;
  alumnoNombres: string;
  alumnoApellidos: string;
  alumnoFechaNacimiento: string;
  alumnoNivel: string;
  alumnoCarrera: string | null;
  alumnoAnio: string | null;
  alumnoGrado: string | null;
  sedeId: number | null;
  sede: { sedeId: number; nombre: string } | null;
  documentos: string[];
  observaciones: string | null;
  fechaSolicitud: string;
  fechaLimite: string;
  alumnoId: number | null;
  fechaResolucion: string | null;
  motivoResolucion: string | null;
}

export interface OpcionesAprobacionDto {
  solicitud: SolicitudDto;
  vencida: boolean;
  cuentaEncargado: { usuarioId: number; nombre: string; email: string; roles: string[]; dadoDeBaja: boolean; esAlumno: boolean; yaEsEncargado: boolean } | null;
  duplicados: { alumnoId: number; usuario: { nombres: string; apellidos: string; deletedAt: string | null }; seccion: { nombre: string; anioLectivo: number; grado: { nombre: string }; sede: { nombre: string } } }[];
  secciones: {
    seccionId: number; nombre: string; anioLectivo: number; alumnos: number;
    grado: { gradoId: number; nombre: string; nivel: string };
    sede: { sedeId: number; nombre: string };
    accesoPorNivel: boolean;
    sugerida: boolean;
  }[];
}

export interface AprobacionDto {
  alumnoId: number;
  encargadoId: number;
  correoEnviado: boolean;
  encargado: { usuario: string; passwordTemporal: string | null; cuentaExistente: boolean; nombre: string };
  alumno: { usuario: string; passwordTemporal: string | null; accesoPortal: boolean; nombre: string };
}

export async function getSolicitudesAdmin(params: { estado?: EstadoSolicitudDto; q?: string } = {}): Promise<SolicitudDto[]> {
  const body = await request<{ status: "success"; data: SolicitudDto[] }>(`/api/solicitudes${toQueryString({ ...params })}`);
  return body.data;
}

export async function getOpcionesAprobacion(id: number): Promise<OpcionesAprobacionDto> {
  const body = await request<{ status: "success"; data: OpcionesAprobacionDto }>(`/api/solicitudes/${id}/opciones`);
  return body.data;
}

export function marcarSolicitud(id: number, estado: "PENDIENTE" | "REVISION" | "VENCIDA", observaciones?: string): Promise<{ status: "success"; data: SolicitudDto }> {
  return request(`/api/solicitudes/${id}/estado`, { method: "PUT", body: JSON.stringify({ estado, observaciones }) });
}

export function aprobarSolicitud(id: number, input: { seccionId: number; accesoPortal: boolean | null; confirmarDuplicado: boolean }): Promise<{ status: "success"; message: string; data: AprobacionDto }> {
  return request(`/api/solicitudes/${id}/aprobar`, { method: "POST", body: JSON.stringify(input) });
}

export function rechazarSolicitud(id: number, motivo: string): Promise<MessageResponse> {
  return request(`/api/solicitudes/${id}/rechazar`, { method: "POST", body: JSON.stringify({ motivo }) });
}

// ---------- Estructura académica (grados, secciones, cursos, horarios) ----------

export interface GradoDto {
  gradoId: number;
  nombre: string;
  nivel: string;
  orden: number;
  cursos: { cursoId: number; nombre: string }[];
}

export interface SeccionAdminDto {
  seccionId: number;
  nombre: string;
  anioLectivo: number;
  grado: { gradoId: number; nombre: string; nivel: string; orden: number };
  sede: { sedeId: number; nombre: string };
  alumnos: number;
  cursos: number;
  matriculas: number;
}

export async function getGrados(): Promise<GradoDto[]> {
  const body = await request<{ status: "success"; data: GradoDto[] }>("/api/grados");
  return body.data;
}

export async function getSeccionesAdmin(params: { anioLectivo?: number; sedeId?: number } = {}): Promise<{ ciclos: number[]; secciones: SeccionAdminDto[] }> {
  const body = await request<{ status: "success"; data: { ciclos: number[]; secciones: SeccionAdminDto[] } }>(`/api/grados/secciones${toQueryString({ ...params })}`);
  return body.data;
}

export function crearSeccion(input: { gradoId: number; nombre: string; anioLectivo: number; sedeId?: number }): Promise<MessageResponse> {
  return request("/api/grados/secciones", { method: "POST", body: JSON.stringify(input) });
}

export function renombrarSeccion(id: number, nombre: string): Promise<MessageResponse> {
  return request(`/api/grados/secciones/${id}`, { method: "PUT", body: JSON.stringify({ nombre }) });
}

export function eliminarSeccion(id: number): Promise<MessageResponse> {
  return request(`/api/grados/secciones/${id}`, { method: "DELETE" });
}

export function copiarSecciones(input: { desde: number; hasta: number; sedeId?: number }): Promise<MessageResponse> {
  return request("/api/grados/secciones/copiar", { method: "POST", body: JSON.stringify(input) });
}

export interface CursoCatalogoDto {
  cursoId: number;
  nombre: string;
  descripcion: string | null;
  mallas: { gradoId: number; grado: { gradoId: number; nombre: string; nivel: string } }[];
}

export async function getCursosCatalogo(): Promise<CursoCatalogoDto[]> {
  const body = await request<{ status: "success"; data: CursoCatalogoDto[] }>("/api/cursos");
  return body.data;
}

export function crearCurso(input: { nombre: string; descripcion?: string; gradosIds?: number[] }): Promise<{ status: "success"; data: CursoCatalogoDto }> {
  return request("/api/cursos", { method: "POST", body: JSON.stringify(input) });
}

export function asignarCursoAGrado(cursoId: number, gradoId: number): Promise<MessageResponse> {
  return request(`/api/cursos/${cursoId}/grados`, { method: "POST", body: JSON.stringify({ gradoId }) });
}

export function quitarCursoDeGrado(cursoId: number, gradoId: number): Promise<MessageResponse> {
  return request(`/api/cursos/${cursoId}/grados/${gradoId}`, { method: "DELETE" });
}

export interface CursoSeccionAdminDto {
  cursoSeccionId: number;
  cursoId: number;
  seccionId: number;
  catedraticoId: number;
  curso: { cursoId: number; nombre: string };
  seccion: { seccionId: number; nombre: string; sedeId: number; anioLectivo: number; grado: { gradoId: number; nombre: string }; sede: { nombre: string } };
  catedratico: { catedraticoId: number; especialidad: string | null; usuario: { usuarioId: number; nombres: string; apellidos: string; email: string } };
  horarios: HorarioCursoDto[];
}

export async function getCursosSeccionAdmin(params: { sedeId?: number; seccionId?: number } = {}): Promise<CursoSeccionAdminDto[]> {
  const body = await request<{ status: "success"; data: CursoSeccionAdminDto[] }>(`/api/curso-seccion${toQueryString({ ...params })}`);
  return body.data;
}

export function asignarCursoSeccion(input: { cursoId: number; seccionId: number; catedraticoId: number }): Promise<MessageResponse> {
  return request("/api/curso-seccion", { method: "POST", body: JSON.stringify(input) });
}

export function cambiarCatedraticoCurso(cursoSeccionId: number, catedraticoId: number): Promise<MessageResponse> {
  return request(`/api/curso-seccion/${cursoSeccionId}`, { method: "PUT", body: JSON.stringify({ catedraticoId }) });
}

export function quitarCursoSeccion(cursoSeccionId: number): Promise<MessageResponse> {
  return request(`/api/curso-seccion/${cursoSeccionId}`, { method: "DELETE" });
}

export interface ChoqueHorarioDto { disponible: boolean; choque: unknown }

export function crearHorario(input: { cursoSeccionId: number; diaSemana: number; horaInicio: string; horaFin: string }): Promise<MessageResponse> {
  return request("/api/horarios", { method: "POST", body: JSON.stringify(input) });
}

export function eliminarHorario(horarioId: number): Promise<MessageResponse> {
  return request(`/api/horarios/${horarioId}`, { method: "DELETE" });
}

// ---------- Eventos (administración) ----------

export interface EventoInput {
  nombre: string;
  descripcion?: string | null;
  fecha: string; // YYYY-MM-DD
  tipoEvento: TipoEvento | string;
  sedeId?: number | null;
  enviarRecordatorio?: boolean;
  requierePago?: boolean;
  costo?: number | null;
  cupoMaximo?: number | null;
  fechaLimiteInscripcion?: string | null;
}

export function crearEvento(input: EventoInput): Promise<{ status: "success"; data: EventoDto }> {
  return request("/api/events", { method: "POST", body: JSON.stringify(input) });
}

export function actualizarEvento(id: number, input: Partial<EventoInput>): Promise<{ status: "success"; data: EventoDto }> {
  return request(`/api/events/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function eliminarEvento(id: number): Promise<MessageResponse> {
  return request(`/api/events/${id}`, { method: "DELETE" });
}

// ---------- Dashboard de sede ----------

export interface DashboardSedeDto {
  sede: string;
  anioLectivo: number;
  alumnos: { total: number; anterior: number };
  aprobacion: { porcentaje: number | null; evaluados: number; promedio: number | null };
  mora: { alumnos: number; porcentaje: number };
  becas: { activas: number; porcentaje: number };
  porGrado: { grado: string; total: number; evaluados: number; aprobados: number }[];
  pendientes: { solicitudes: number; justificaciones: number; sinEncargado: number };
  enRiesgo: { alumnoId: number; nombre: string; grado: string; promedio: number; cursosReprobados: number }[];
  proximosEventos: { eventoId: number; nombre: string; fecha: string; tipoEvento: string }[];
}

export async function getDashboardSede(sedeId?: number): Promise<DashboardSedeDto> {
  const body = await request<{ status: "success"; data: DashboardSedeDto }>(`/api/sedes/dashboard${toQueryString({ sedeId })}`);
  return body.data;
}

// ---------- Reportes en PDF (generados por el backend) ----------

/** Descarga un PDF protegido (con el token de la sesión) y lo abre en otra pestaña */
export async function abrirReportePdf(path: string): Promise<void> {
  const token = getToken();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new Error("No se pudo conectar con el servidor.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message || "No se pudo generar el reporte.");
  }
  const url = URL.createObjectURL(await response.blob());
  window.open(url, "_blank");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export interface CatedraticoSedeDto {
  catedraticoId: number;
  nombre: string;
  email: string;
  especialidad: string | null;
  sede: string | null;
  cursos: { cursoSeccionId: number; curso: string; seccion: string; anioLectivo: number; horarios: { diaSemana: number; horaInicio: string; horaFin: string }[] }[];
}

export async function getCatedraticosSede(): Promise<CatedraticoSedeDto[]> {
  const body = await request<{ status: "success"; data: CatedraticoSedeDto[] }>("/api/curso-seccion/catedraticos");
  return body.data;
}

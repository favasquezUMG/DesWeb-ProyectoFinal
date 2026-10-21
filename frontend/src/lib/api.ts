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
  bitacoraId: number;
  accion: string;
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
  bitacora: BitacoraDto[];
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
  seccion: { seccionId: number; nombre: string; sedeId?: number; grado: { nombre: string } };
  encargadosActivos?: number;
  contactoPrincipal?: string | null;
  tieneRestriccion?: boolean;
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
  bitacora: BitacoraDto[];
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

export async function getPoliticaBecas(anioLectivo: number): Promise<PoliticaBecaDto> {
  const body = await request<{ status: "success"; data: PoliticaBecaDto }>(`/api/becas/politica?anioLectivo=${anioLectivo}`);
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

// ---------- Cursos del catedrático ----------

export interface CursoSeccionDto {
  cursoSeccionId: number;
  seccionId: number;
  curso: { cursoId: number; nombre: string };
  seccion: { seccionId: number; nombre: string; sedeId: number; grado: { nombre: string } };
}

export async function getCursosDeCatedratico(catedraticoId: number): Promise<CursoSeccionDto[]> {
  const body = await request<{ status: "success"; data: CursoSeccionDto[] }>(`/api/curso-seccion/catedratico/${catedraticoId}`);
  return body.data;
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

// ---------- Eventos ----------

export function enviarRecordatorioEvento(eventoId: number): Promise<MessageResponse> {
  return request(`/api/events/${eventoId}/recordatorio`, { method: "POST" });
}

// ---------- Sedes ----------

export interface SedeDto {
  sedeId: number;
  nombre: string;
  direccion: string | null;
}

export async function getSedes(): Promise<SedeDto[]> {
  const body = await request<{ status: "success"; data: SedeDto[] }>("/api/sedes");
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

export interface EventoDto {
  eventoId: number;
  sedeId: number | null;
  nombre: string;
  descripcion: string | null;
  fecha: string;
  tipoEvento: string;
  enviarRecordatorio: boolean;
  requierePago: boolean;
  costo: string | null;
  cupoMaximo: number | null;
  fechaLimiteInscripcion: string | null;
  sede?: { nombre: string } | null;
}

export interface EventoInput {
  nombre: string;
  descripcion?: string | null;
  fecha: string;
  tipoEvento: string;
  sedeId?: number | null;
  requierePago: boolean;
  costo: number | null;
  cupoMaximo: number | null;
  fechaLimiteInscripcion: string | null;
}

export interface InscritosEventoDto {
  eventoId: number;
  nombre: string;
  cupoMaximo: number | null;
  inscritos: number;
  recaudado: number;
  detalle: { inscripcionId: number; alumnoId: number; alumno: string; grado: string; monto: number; estado: string; fechaPago: string | null }[];
}

export async function getEventos(sedeId?: number | null): Promise<EventoDto[]> {
  const query = sedeId ? `?sedeId=${sedeId}` : "";
  const body = await request<{ status: "success"; data: EventoDto[] }>(`/api/events${query}`);
  return body.data;
}

export async function crearEvento(input: EventoInput): Promise<EventoDto> {
  const body = await request<{ status: "success"; data: EventoDto }>("/api/events", { method: "POST", body: JSON.stringify(input) });
  return body.data;
}

export async function actualizarEvento(eventoId: number, input: Partial<EventoInput>): Promise<EventoDto> {
  const body = await request<{ status: "success"; data: EventoDto }>(`/api/events/${eventoId}`, { method: "PUT", body: JSON.stringify(input) });
  return body.data;
}

export async function eliminarEvento(eventoId: number): Promise<MessageResponse> {
  return request(`/api/events/${eventoId}`, { method: "DELETE" });
}

export async function getInscritosEvento(eventoId: number): Promise<InscritosEventoDto> {
  const body = await request<{ status: "success"; data: InscritosEventoDto }>(`/api/events/${eventoId}/inscritos`);
  return body.data;
}

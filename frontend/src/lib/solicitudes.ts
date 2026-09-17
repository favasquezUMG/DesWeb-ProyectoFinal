// Persistencia simulada (localStorage) de solicitudes de inscripción. No hay
// backend real todavía: esto solo existe para que el flujo de "Solicitud" y el
// de "Consultar estado" puedan conversar entre sí durante las pruebas.

export type EstadoSolicitud = "En revisión" | "Documentos pendientes" | "Aprobada" | "Rechazada" | "Vencida";

export interface DatosEncargadoSolicitud {
  nombres: string;
  apellidos: string;
  dpi: string;
  telefono: string;
  correo: string;
  parentesco: string;
}

export interface DatosAlumnoSolicitud {
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  nivel: string;
  carrera?: string;
  anio?: string;
  grado?: string;
  sede: string;
}

export interface SolicitudGuardada {
  numero: string;
  modo: "publico" | "presencial";
  encargado: DatosEncargadoSolicitud;
  alumno: DatosAlumnoSolicitud;
  documentos: string[];
  observaciones?: string;
  fechaSolicitud: string; // ISO
  fechaLimite: string; // ISO
}

const STORAGE_KEY = "dercas.solicitudes";

function leerTodas(): SolicitudGuardada[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarSolicitud(solicitud: SolicitudGuardada): void {
  try {
    const todas = leerTodas();
    todas.push(solicitud);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todas));
  } catch {
    // Sin localStorage disponible la solicitud sigue mostrándose en pantalla,
    // solo no quedará disponible luego para "Consultar estado".
  }
}

export function buscarPorNumero(numero: string): SolicitudGuardada | null {
  const buscado = numero.trim().toLowerCase();
  return leerTodas().find((s) => s.numero.toLowerCase() === buscado) ?? null;
}

export function buscarPorDpiCorreo(dpi: string, correo: string): SolicitudGuardada | null {
  const dpiBuscado = dpi.trim();
  const correoBuscado = correo.trim().toLowerCase();
  return (
    leerTodas().find(
      (s) => s.encargado.dpi === dpiBuscado && s.encargado.correo.toLowerCase() === correoBuscado
    ) ?? null
  );
}

// ─── Generación de folio y fechas ──────────────────────────────────────────────

export function generarNumeroSolicitud(): string {
  const anio = new Date().getFullYear();
  const numero = Math.floor(Math.random() * 99999) + 1;
  return `SOL-${anio}-${String(numero).padStart(5, "0")}`;
}

/** Fecha límite para entregar documentos físicamente: 15 días naturales desde hoy. */
export function calcularFechaLimite(desde: Date = new Date()): Date {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + 15);
  return fecha;
}

export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });
}

// ─── Estado simulado ────────────────────────────────────────────────────────
// No hay backend que apruebe/rechace solicitudes de verdad: el estado se
// deriva de forma determinista del número de folio, para que la misma
// solicitud siempre muestre el mismo resultado. La única regla "real" es que
// una solicitud aún pendiente vence automáticamente si ya pasó su fecha límite.

export interface EstadoResuelto {
  estado: EstadoSolicitud;
  motivo?: string;
}

const MOTIVOS_RECHAZO = [
  "La documentación entregada no coincide con los datos registrados en la solicitud.",
  "No hay cupo disponible en el grado y la sede solicitados.",
  "La edad del alumno no corresponde al grado solicitado.",
];

function hashTexto(texto: string): number {
  let hash = 0;
  for (let i = 0; i < texto.length; i++) {
    hash = (hash * 31 + texto.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function resolverEstado(solicitud: SolicitudGuardada): EstadoResuelto {
  const hash = hashTexto(solicitud.numero);
  const base = hash % 4; // 0: en revisión, 1: documentos pendientes, 2: aprobada, 3: rechazada

  if (base === 2) return { estado: "Aprobada" };
  if (base === 3) {
    return { estado: "Rechazada", motivo: MOTIVOS_RECHAZO[hash % MOTIVOS_RECHAZO.length] };
  }

  const vencida = new Date() > new Date(solicitud.fechaLimite);
  if (vencida) {
    return {
      estado: "Vencida",
      motivo: "El plazo para entregar los documentos venció sin recibir la documentación completa. Debe iniciar una nueva solicitud.",
    };
  }

  return { estado: base === 0 ? "En revisión" : "Documentos pendientes" };
}

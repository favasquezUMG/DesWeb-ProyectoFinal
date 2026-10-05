import axios from "axios";

export type EstadoSolicitud = 
  | "PENDIENTE" 
  | "REVISION" 
  | "APROBADA" 
  | "RECHAZADA" 
  | "VENCIDA";

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
  solicitudId?: number;
  numero: string;
  modo: "publico" | "presencial";
  estado?: EstadoSolicitud;
  encargado: DatosEncargadoSolicitud;
  alumno: DatosAlumnoSolicitud;
  documentos: string[];
  observaciones?: string;
  fechaSolicitud: string; // ISO
  fechaLimite: string; // ISO
}

export interface EstadoResuelto {
  estado: EstadoSolicitud;
  motivo?: string;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export async function guardarSolicitud(solicitud: SolicitudGuardada): Promise<SolicitudGuardada> {
  try {
    const response = await axios.post(`${API_URL}/api/solicitudes`, solicitud);
    return response.data.data;
  } catch (error){
    return solicitud;
  }
}

export async function buscarPorNumero(numero: string): Promise<SolicitudGuardada | null> {
  try{
    const response = await axios.get(`${API_URL}/api/solicitudes/numero`, {
      params: {
        numero: numero.trim()
      }
    })
    return normalizarSolicitud(response.data.data)
  } catch (error) {
    return null;
  }
}

export async function buscarPorDpiCorreo(dpi: string, correo: string): Promise<SolicitudGuardada | null> {
  try{
    const response = await axios.get(`${API_URL}/api/solicitudes/dpi-correo`, {
      params: {
        dpi: dpi.trim(),
        correo: correo.trim().toLocaleLowerCase()
      }
    });
    return normalizarSolicitud(response.data.data)
  } catch (error) {
    return null;
  }
}

export function resolverEstado(solicitud: SolicitudGuardada): EstadoResuelto {
  const estadoBase = solicitud.estado || "PENDIENTE";

  if(estadoBase === 'APROBADA') return { estado: "APROBADA" };
  if(estadoBase === 'RECHAZADA') {
    return {
      estado: "RECHAZADA",
      motivo: "La solicitud no cumple con los requisitos mínimos o no hay cupo disponible."
    };
  }

  const fechaLimite = new Date(solicitud.fechaLimite);
  const estaVencida = new Date() > fechaLimite;

  if(estaVencida || estadoBase === 'VENCIDA'){
    return {
      estado: "VENCIDA",
      motivo: "El plazo para entregar los documentos en ventanilla venció sin recibir la papelería completa. Debe iniciar un nuevo proceso."
    };
  }
  
  return { estado: estadoBase}
}

export async function actualizarEstadoSolicitud(
  solicitudId: number,
  nuevoEstado: EstadoSolicitud,
  observaciones?: string,
  token?: string
): Promise<SolicitudGuardada | null> {
  try{
    const response = await axios.patch(
      `${API_URL}/api/solicitudes/${solicitudId}/estado`,
      {
        estado: nuevoEstado,
        observaciones
      },
      {
        headers: token ? {Authorization: `Bearer ${token}` } : {}
      }
    );

    return response.data.data;
  } catch(error) {
    return null
  }
}

export function generarNumeroSolicitud(): string {
  const anio = new Date().getFullYear();
  const numero = Math.floor(Math.random() * 99999) + 1;
  return `SOL-${anio}-${String(numero).padStart(5, "0")}`;
}

export function calcularFechaLimite(desde: Date = new Date()): Date {
  const fecha = new Date(desde);
  fecha.setDate(fecha.getDate() + 15);
  return fecha;
}

export function formatearFecha(fecha: string | Date): string {
  const d = typeof fecha === "string" ? new Date(fecha) : fecha;
  return d.toLocaleDateString("es-GT", { day: "numeric", month: "long", year: "numeric" });
}

function normalizarSolicitud(soliBD: any): SolicitudGuardada {
  if (!soliBD) return soliBD;
  
  // Si ya viene anidado, lo retorna tal cual
  if (soliBD.encargado?.correo) return soliBD;

  return {
    solicitudId: soliBD.solicitudId,
    numero: soliBD.numero,
    modo: soliBD.modo === "PUBLICO" ? "publico" : "presencial",
    estado: soliBD.estado,
    encargado: {
      nombres: soliBD.encargadoNombres || "",
      apellidos: soliBD.encargadoApellidos || "",
      dpi: soliBD.encargadoDpi || "",
      telefono: soliBD.encargadoTelefono || "",
      correo: soliBD.encargadoCorreo || "",
      parentesco: soliBD.encargadoParentesco || "",
    },
    alumno: {
      nombres: soliBD.alumnoNombres || "",
      apellidos: soliBD.alumnoApellidos || "",
      fechaNacimiento: soliBD.alumnoFechaNacimiento || "",
      nivel: soliBD.alumnoNivel || "",
      carrera: soliBD.alumnoCarrera || undefined,
      anio: soliBD.alumnoAnio || undefined,
      grado: soliBD.alumnoGrado || undefined,
      sede: soliBD.sede?.nombre || "",
    },
    documentos: soliBD.documentos || [],
    observaciones: soliBD.observaciones || undefined,
    fechaSolicitud: soliBD.fechaSolicitud,
    fechaLimite: soliBD.fechaLimite,
  };
}
import { useState } from "react";
import { CheckCircle2, Clock, Download, Printer } from "lucide-react";
import { Stepper, Input, Select, Textarea, Btn, AlertBanner } from "./Ui";
import { MALLA_CNB } from "../data";
import {
  type SolicitudGuardada,
  guardarSolicitud,
  generarNumeroSolicitud,
  calcularFechaLimite,
  formatearFecha,
} from "../lib/solicitudes";
import { generarConstanciaPdf, etiquetaGradoSolicitud } from "../lib/constanciaPdf";

// ─── Solicitud de inscripción ──────────────────────────────────────────────────
// Flujo simulado (sin backend) para solicitar el cupo de un alumno. Se usa en
// dos contextos:
//  - "publico": desde el login, un encargado sin cuenta solicita la inscripción.
//  - "presencial": desde el panel de admin de sede, cuando la secretaría recibe
//     al encargado en ventanilla y registra la solicitud por él.

export type SolicitudInscripcionModo = "publico" | "presencial";

interface SolicitudInscripcionProps {
  modo: SolicitudInscripcionModo;
  /** Se llama al terminar el flujo (botón final de la pantalla de confirmación). */
  onFinalizar?: () => void;
  /** Se llama si el usuario cancela antes de terminar (solo visible en el primer paso). */
  onCancelar?: () => void;
}

const STEPS = ["Encargado", "Alumno", "Documentos", "Confirmación"];

const SEDES_DISPONIBLES = ["Sede Central", "Sede Xela", "Sede Coatepeque"];

const PARENTESCOS = ["Madre", "Padre", "Tutor Legal", "Otro"];

const DOCUMENTOS_REQUERIDOS = [
  { id: "partida-nacimiento", label: "Certificación de nacimiento del alumno extendida por RENAP" },
  { id: "certificado-grado", label: "Certificado del último grado aprobado" },
  { id: "copia-dpi", label: "Copia de DPI del padre o encargado" },
  { id: "fotografias", label: "Dos fotografías tamaño cédula" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type NivelId = "pre" | "pri" | "bas" | "div";

// Posición (0-14) de cada grado/año en la progresión completa del colegio:
// 0-2 Preprimaria, 3-8 Primaria, 9-11 Básico, 12-14 Diversificado (Cuarto/Quinto/Sexto,
// sin importar la carrera). Se usa solo para validar que la edad sea coherente.
const OFFSET_POR_NIVEL: Record<NivelId, number> = { pre: 0, pri: 3, bas: 9, div: 12 };
const ORDEN_ANIO_DIV: Record<string, number> = { Cuarto: 0, Quinto: 1, Sexto: 2 };

const RANGOS_EDAD_POR_POSICION: { min: number; max: number }[] = [
  { min: 4, max: 5 },   // Párvulos 1
  { min: 5, max: 6 },   // Párvulos 2
  { min: 6, max: 7 },   // Párvulos 3
  { min: 6, max: 8 },   // Primero Primaria
  { min: 7, max: 9 },   // Segundo Primaria
  { min: 8, max: 10 },  // Tercero Primaria
  { min: 9, max: 11 },  // Cuarto Primaria
  { min: 10, max: 12 }, // Quinto Primaria
  { min: 11, max: 13 }, // Sexto Primaria
  { min: 12, max: 15 }, // Primero Básico
  { min: 13, max: 16 }, // Segundo Básico
  { min: 14, max: 17 }, // Tercero Básico
  { min: 15, max: 19 }, // Cuarto (Diversificado)
  { min: 16, max: 20 }, // Quinto (Diversificado)
  { min: 17, max: 21 }, // Sexto (Diversificado)
];

interface DatosEncargado {
  nombres: string;
  apellidos: string;
  dpi: string;
  telefono: string;
  correo: string;
  parentesco: string;
}

interface DatosAlumno {
  nombres: string;
  apellidos: string;
  fechaNacimiento: string;
  nivelId: NivelId | "";
  grado: string; // usado cuando nivelId es pre/pri/bas
  carrera: string; // usado cuando nivelId es "div"
  anio: string; // usado cuando nivelId es "div" (Cuarto/Quinto/Sexto)
  sede: string;
}

function calcularEdad(fechaISO: string): number | null {
  const nacimiento = new Date(fechaISO);
  if (isNaN(nacimiento.getTime())) return null;

  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const aunNoCumple = hoy.getMonth() < nacimiento.getMonth() ||
    (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() < nacimiento.getDate());
  if (aunNoCumple) edad--;
  return edad;
}

function calcularPosicionGrado(d: DatosAlumno): number | null {
  if (!d.nivelId) return null;
  if (d.nivelId === "div") {
    if (!d.anio || !(d.anio in ORDEN_ANIO_DIV)) return null;
    return OFFSET_POR_NIVEL.div + ORDEN_ANIO_DIV[d.anio];
  }
  const nivel = MALLA_CNB.find((n) => n.id === d.nivelId);
  if (!nivel) return null;
  const indice = nivel.grados.findIndex((g) => g.nombre === d.grado);
  if (indice === -1) return null;
  return OFFSET_POR_NIVEL[d.nivelId] + indice;
}

function nombreNivel(nivelId: string): string {
  return MALLA_CNB.find((n) => n.id === nivelId)?.nivel ?? "";
}

function validarEncargado(d: DatosEncargado): Partial<Record<keyof DatosEncargado, string>> {
  const errores: Partial<Record<keyof DatosEncargado, string>> = {};
  if (!d.nombres.trim()) errores.nombres = "Los nombres son obligatorios.";
  if (!d.apellidos.trim()) errores.apellidos = "Los apellidos son obligatorios.";
  if (!/^\d{13}$/.test(d.dpi.trim())) errores.dpi = "El DPI debe tener 13 dígitos.";
  if (!/^\d{8}$/.test(d.telefono.trim())) errores.telefono = "El teléfono debe tener 8 dígitos.";
  if (!EMAIL_RE.test(d.correo.trim())) errores.correo = "Ingrese un correo electrónico válido.";
  if (!d.parentesco) errores.parentesco = "Seleccione el parentesco con el alumno.";
  return errores;
}

function validarAlumno(d: DatosAlumno): Partial<Record<keyof DatosAlumno, string>> {
  const errores: Partial<Record<keyof DatosAlumno, string>> = {};
  if (!d.nombres.trim()) errores.nombres = "Los nombres son obligatorios.";
  if (!d.apellidos.trim()) errores.apellidos = "Los apellidos son obligatorios.";
  if (!d.nivelId) errores.nivelId = "Seleccione el nivel educativo.";

  if (d.nivelId === "div") {
    if (!d.carrera) errores.carrera = "Seleccione la carrera.";
    if (!d.anio) errores.anio = "Seleccione el año.";
  } else if (d.nivelId && !d.grado) {
    errores.grado = "Seleccione el grado al que aplica.";
  }

  if (!d.fechaNacimiento) {
    errores.fechaNacimiento = "La fecha de nacimiento es obligatoria.";
  } else {
    const edad = calcularEdad(d.fechaNacimiento);
    if (edad === null || edad < 0 || edad > 30) {
      errores.fechaNacimiento = "Ingrese una fecha de nacimiento válida.";
    } else {
      const posicion = calcularPosicionGrado(d);
      if (posicion !== null) {
        const rango = RANGOS_EDAD_POR_POSICION[posicion];
        if (rango && (edad < rango.min || edad > rango.max)) {
          errores.fechaNacimiento = `La edad (${edad} años) no es coherente con el grado seleccionado (rango esperado: ${rango.min}–${rango.max} años).`;
        }
      }
    }
  }

  if (!d.sede) errores.sede = "Seleccione la sede.";
  return errores;
}

/** Bloque imprimible de la constancia (oculto en pantalla, visible solo al imprimir). Ver @media print en index.css. */
export function ConstanciaImprimible({ solicitud }: { solicitud: SolicitudGuardada }) {
  return (
    <div id="constancia-imprimible" className="p-10 text-stone-900 text-sm">
      <div className="flex items-start justify-between border-b-2 border-primary-700 pb-3 mb-4">
        <div>
          <p className="font-display text-xl font-bold text-primary-700">Colegio Vanguardia</p>
          <p className="text-stone-500 text-xs">Constancia de solicitud de inscripción</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">Número de solicitud</p>
          <p className="font-mono-data font-semibold text-primary-700">{solicitud.numero}</p>
        </div>
      </div>

      <p className="text-xs text-stone-500 mb-4">Fecha de emisión: {formatearFecha(solicitud.fechaSolicitud)}</p>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700 border-b border-stone-200 pb-1 mb-2">Datos del encargado</h3>
        <p>Nombre: {solicitud.encargado.nombres} {solicitud.encargado.apellidos}</p>
        <p>DPI: {solicitud.encargado.dpi}</p>
        <p>Teléfono: {solicitud.encargado.telefono}</p>
        <p>Correo electrónico: {solicitud.encargado.correo}</p>
        <p>Parentesco con el alumno: {solicitud.encargado.parentesco}</p>
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700 border-b border-stone-200 pb-1 mb-2">Datos del alumno</h3>
        <p>Nombre: {solicitud.alumno.nombres} {solicitud.alumno.apellidos}</p>
        <p>Fecha de nacimiento: {formatearFecha(solicitud.alumno.fechaNacimiento)}</p>
        <p>Nivel: {solicitud.alumno.nivel}</p>
        {solicitud.alumno.carrera && <p>Carrera: {solicitud.alumno.carrera}</p>}
        <p>Grado / año solicitado: {etiquetaGradoSolicitud(solicitud.alumno)}</p>
        <p>Sede: {solicitud.alumno.sede}</p>
      </section>

      <section className="mb-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-primary-700 border-b border-stone-200 pb-1 mb-2">Documentos a presentar en la sede</h3>
        <ul className="list-disc list-inside space-y-0.5">
          {solicitud.documentos.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </section>

      <section className="mb-4 p-3 border border-warning-200 rounded-lg">
        <p className="font-semibold text-warning-800">Fecha límite para entregar los documentos: {formatearFecha(solicitud.fechaLimite)}</p>
        <p className="text-warning-800 mt-1">Si no se presentan a tiempo en la sede, la solicitud pasará automáticamente a estado VENCIDA y deberá iniciarse un nuevo proceso.</p>
      </section>

      <p className="mb-4">El resultado de la solicitud se resuelve en un plazo de 5 días hábiles.</p>

      <p className="font-semibold text-warning-800 mb-16">
        Esta constancia NO otorga acceso al sistema. Las credenciales de acceso se envían por correo electrónico únicamente si la solicitud es aprobada.
      </p>

      <div className="flex items-end justify-between mt-10">
        <div className="text-center text-xs text-stone-600">
          <div className="w-48 border-t border-stone-400 pt-1">Firma del encargado</div>
        </div>
        <div className="text-center text-xs text-stone-600">
          <div className="w-48 border-t border-stone-400 pt-1">Sello del colegio</div>
        </div>
      </div>
    </div>
  );
}

export default function SolicitudInscripcion({ modo, onFinalizar, onCancelar }: SolicitudInscripcionProps) {
  const [step, setStep] = useState(0);
  const [numeroSolicitud] = useState(generarNumeroSolicitud);
  const [fechaLimite] = useState(calcularFechaLimite);
  const [solicitudGuardada, setSolicitudGuardada] = useState<SolicitudGuardada | null>(null);

  const [encargado, setEncargado] = useState<DatosEncargado>({
    nombres: "", apellidos: "", dpi: "", telefono: "", correo: "", parentesco: "",
  });
  const [erroresEncargado, setErroresEncargado] = useState<Partial<Record<keyof DatosEncargado, string>>>({});

  const [alumno, setAlumno] = useState<DatosAlumno>({
    nombres: "", apellidos: "", fechaNacimiento: "", nivelId: "", grado: "", carrera: "", anio: "", sede: "",
  });
  const [erroresAlumno, setErroresAlumno] = useState<Partial<Record<keyof DatosAlumno, string>>>({});

  const [documentos, setDocumentos] = useState<Record<string, boolean>>({});
  const [observaciones, setObservaciones] = useState("");
  const [errorDocumentos, setErrorDocumentos] = useState("");

  const nivelSeleccionado = MALLA_CNB.find((n) => n.id === alumno.nivelId);
  const carreraSeleccionada = nivelSeleccionado?.carreras?.find((c) => c.nombre === alumno.carrera);

  function actualizarEncargado<K extends keyof DatosEncargado>(campo: K, valor: string) {
    setEncargado((prev) => ({ ...prev, [campo]: valor }));
    setErroresEncargado((prev) => ({ ...prev, [campo]: undefined }));
  }

  function actualizarAlumno<K extends keyof DatosAlumno>(campo: K, valor: string) {
    setAlumno((prev) => ({ ...prev, [campo]: valor }));
    setErroresAlumno((prev) => ({ ...prev, [campo]: undefined }));
  }

  function cambiarNivel(valor: string) {
    setAlumno((prev) => ({ ...prev, nivelId: valor as NivelId | "", grado: "", carrera: "", anio: "" }));
    setErroresAlumno((prev) => ({ ...prev, nivelId: undefined, grado: undefined, carrera: undefined, anio: undefined }));
  }

  function cambiarCarrera(valor: string) {
    setAlumno((prev) => ({ ...prev, carrera: valor, anio: "" }));
    setErroresAlumno((prev) => ({ ...prev, carrera: undefined, anio: undefined }));
  }

  function marcarDocumento(id: string, valor: boolean) {
    setDocumentos((prev) => ({ ...prev, [id]: valor }));
    setErrorDocumentos("");
  }

  function irSiguiente() {
    if (step === 0) {
      const errores = validarEncargado(encargado);
      setErroresEncargado(errores);
      if (Object.values(errores).some(Boolean)) return;
    } else if (step === 1) {
      const errores = validarAlumno(alumno);
      setErroresAlumno(errores);
      if (Object.values(errores).some(Boolean)) return;
    } else if (step === 2) {
      const faltanDocumentos = DOCUMENTOS_REQUERIDOS.some((doc) => !documentos[doc.id]);
      if (faltanDocumentos) {
        setErrorDocumentos(
          modo === "publico"
            ? "Debe confirmar que entregará todos los documentos antes de continuar."
            : "Debe marcar todos los documentos como recibidos antes de continuar."
        );
        return;
      }
      setErrorDocumentos("");

      const registro: SolicitudGuardada = {
        numero: numeroSolicitud,
        modo,
        encargado: { ...encargado },
        alumno: {
          nombres: alumno.nombres,
          apellidos: alumno.apellidos,
          fechaNacimiento: alumno.fechaNacimiento,
          nivel: nombreNivel(alumno.nivelId),
          carrera: alumno.nivelId === "div" ? alumno.carrera : undefined,
          anio: alumno.nivelId === "div" ? alumno.anio : undefined,
          grado: alumno.nivelId === "div" ? undefined : alumno.grado,
          sede: alumno.sede,
        },
        documentos: DOCUMENTOS_REQUERIDOS.map((d) => d.label),
        observaciones: modo === "presencial" ? observaciones.trim() || undefined : undefined,
        fechaSolicitud: new Date().toISOString(),
        fechaLimite: fechaLimite.toISOString(),
      };
      guardarSolicitud(registro);
      setSolicitudGuardada(registro);
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function irAnterior() {
    setStep((s) => Math.max(s - 1, 0));
  }

  const fechaLimiteTexto = formatearFecha(fechaLimite);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Solicitud de inscripción</h2>
        <p className="text-stone-500 text-sm">
          {modo === "publico"
            ? "Complete los siguientes pasos para solicitar el cupo de su hijo. La documentación se entrega físicamente en la sede."
            : "Registre los datos de la solicitud recibida en ventanilla."}
        </p>
      </div>

      <Stepper steps={STEPS} current={step} />

      {/* ── Paso 1: Encargado ── */}
      {step === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombres" value={encargado.nombres} onChange={(e) => actualizarEncargado("nombres", e.target.value)} error={erroresEncargado.nombres} placeholder="Nombres del encargado" />
          <Input label="Apellidos" value={encargado.apellidos} onChange={(e) => actualizarEncargado("apellidos", e.target.value)} error={erroresEncargado.apellidos} placeholder="Apellidos del encargado" />
          <Input
            label="DPI" value={encargado.dpi} inputMode="numeric" placeholder="0000000000000"
            onChange={(e) => actualizarEncargado("dpi", e.target.value.replace(/\D/g, "").slice(0, 13))}
            error={erroresEncargado.dpi} hint={!erroresEncargado.dpi ? "13 dígitos, sin espacios ni guiones" : undefined}
          />
          <Input
            label="Teléfono" value={encargado.telefono} inputMode="numeric" placeholder="00000000"
            onChange={(e) => actualizarEncargado("telefono", e.target.value.replace(/\D/g, "").slice(0, 8))}
            error={erroresEncargado.telefono}
          />
          <div className="sm:col-span-2">
            <Input label="Correo electrónico" type="email" value={encargado.correo} onChange={(e) => actualizarEncargado("correo", e.target.value)} error={erroresEncargado.correo} placeholder="encargado@correo.com" />
          </div>
          <div className="sm:col-span-2">
            <Select label="Parentesco con el alumno" value={encargado.parentesco} onChange={(e) => actualizarEncargado("parentesco", e.target.value)} error={erroresEncargado.parentesco}>
              <option value="">Seleccione…</option>
              {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </div>
        </div>
      )}

      {/* ── Paso 2: Alumno ── */}
      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombres del alumno" value={alumno.nombres} onChange={(e) => actualizarAlumno("nombres", e.target.value)} error={erroresAlumno.nombres} />
          <Input label="Apellidos del alumno" value={alumno.apellidos} onChange={(e) => actualizarAlumno("apellidos", e.target.value)} error={erroresAlumno.apellidos} />
          <Input label="Fecha de nacimiento" type="date" value={alumno.fechaNacimiento} onChange={(e) => actualizarAlumno("fechaNacimiento", e.target.value)} error={erroresAlumno.fechaNacimiento} />
          <Select label="Sede" value={alumno.sede} onChange={(e) => actualizarAlumno("sede", e.target.value)} error={erroresAlumno.sede}>
            <option value="">Seleccione…</option>
            {SEDES_DISPONIBLES.map((s) => <option key={s} value={s}>{s}</option>)}
          </Select>

          <Select label="Nivel educativo" value={alumno.nivelId} onChange={(e) => cambiarNivel(e.target.value)} error={erroresAlumno.nivelId}>
            <option value="">Seleccione…</option>
            {MALLA_CNB.map((n) => <option key={n.id} value={n.id}>{n.nivel}</option>)}
          </Select>

          {alumno.nivelId && alumno.nivelId !== "div" && (
            <Select label="Grado al que aplica" value={alumno.grado} onChange={(e) => actualizarAlumno("grado", e.target.value)} error={erroresAlumno.grado}>
              <option value="">Seleccione…</option>
              {nivelSeleccionado?.grados.map((g) => <option key={g.nombre} value={g.nombre}>{g.nombre}</option>)}
            </Select>
          )}

          {alumno.nivelId === "div" && (
            <>
              <Select label="Carrera" value={alumno.carrera} onChange={(e) => cambiarCarrera(e.target.value)} error={erroresAlumno.carrera}>
                <option value="">Seleccione…</option>
                {nivelSeleccionado?.carreras?.map((c) => <option key={c.nombre} value={c.nombre}>{c.nombre}</option>)}
              </Select>
              <Select label="Año" value={alumno.anio} onChange={(e) => actualizarAlumno("anio", e.target.value)} error={erroresAlumno.anio} disabled={!carreraSeleccionada}>
                <option value="">Seleccione…</option>
                {carreraSeleccionada?.anios.map((a) => <option key={a.nombre} value={a.nombre}>{a.nombre}</option>)}
              </Select>
            </>
          )}
        </div>
      )}

      {/* ── Paso 3: Documentos ── */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 px-4 py-3 bg-warning-50 border border-warning-200 rounded-lg">
            <Clock className="w-4 h-4 text-warning-700 shrink-0" />
            <span className="text-sm font-semibold text-warning-800">Fecha límite para entregar los documentos: {fechaLimiteTexto}</span>
          </div>

          <AlertBanner
            type="warning"
            title={modo === "publico" ? "Entrega física obligatoria" : "Checklist de recepción"}
            message={
              modo === "publico"
                ? `Aquí no se suben archivos: debe presentar estos documentos físicamente en la sede seleccionada antes del ${fechaLimiteTexto}. Si no lo hace a tiempo, la solicitud pasará automáticamente a estado VENCIDA y deberá iniciar el proceso nuevamente.`
                : `Marque cada documento conforme la familia lo entregue en ventanilla. Si no se completa antes del ${fechaLimiteTexto}, la solicitud pasará automáticamente a estado VENCIDA.`
            }
          />

          <div className="space-y-2">
            {DOCUMENTOS_REQUERIDOS.map((doc) => (
              <label key={doc.id} className="flex items-start gap-3 p-3 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!documentos[doc.id]}
                  onChange={(e) => marcarDocumento(doc.id, e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-primary-700 cursor-pointer shrink-0"
                />
                <span className="text-sm text-stone-700">
                  {doc.label}
                  <span className="block text-xs text-stone-400 mt-0.5">
                    {modo === "publico" ? "Confirmo que entregaré este documento" : "Documento recibido"}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {modo === "presencial" && (
            <Textarea
              label="Observaciones para la secretaría"
              value={observaciones}
              onChange={(e) => setObservaciones(e.target.value)}
              placeholder="Notas sobre la documentación recibida (opcional)"
            />
          )}

          {errorDocumentos && <AlertBanner type="error" message={errorDocumentos} />}
        </div>
      )}

      {/* ── Paso 4: Confirmación ── */}
      {step === 3 && solicitudGuardada && (
        <div className="text-center py-2 space-y-5">
          <div className="w-14 h-14 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <p className="text-sm text-stone-500">Número de solicitud</p>
            <p className="font-display text-2xl font-semibold text-primary-700 font-mono-data">{solicitudGuardada.numero}</p>
          </div>

          <div className="px-4 py-3 bg-warning-50 border border-warning-200 rounded-lg text-left">
            <p className="text-sm font-semibold text-warning-800">Fecha límite para entregar los documentos: {formatearFecha(solicitudGuardada.fechaLimite)}</p>
            <p className="text-xs text-warning-800 mt-1">Si no se presentan a tiempo en la sede, la solicitud pasará automáticamente a estado VENCIDA.</p>
          </div>

          <AlertBanner
            type="info"
            title="¿Qué sigue?"
            message={`Le enviamos esta constancia a ${solicitudGuardada.encargado.correo}. El resultado de la solicitud se resuelve en un plazo de 5 días hábiles.`}
          />

          <AlertBanner
            type="warning"
            title="Esto todavía no es un acceso al sistema"
            message="Esta solicitud no le da acceso al portal. Si es aprobada, le enviaremos sus credenciales por ese mismo correo; mientras tanto, no podrá iniciar sesión."
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Btn variant="outline" size="md" className="justify-center" icon={<Download className="w-4 h-4" />} onClick={() => generarConstanciaPdf(solicitudGuardada)}>
              Descargar constancia
            </Btn>
            <Btn variant="outline" size="md" className="justify-center" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              Imprimir constancia
            </Btn>
          </div>

          <Btn variant="primary" size="lg" className="w-full justify-center" onClick={onFinalizar}>
            {modo === "publico" ? "Volver al inicio de sesión" : "Finalizar"}
          </Btn>
        </div>
      )}

      {/* ── Navegación entre pasos ── */}
      {step < 3 && (
        <div className="flex items-center justify-between pt-2">
          {step === 0 ? (
            <button type="button" onClick={onCancelar} className="text-sm text-stone-500 hover:text-stone-700 py-1">
              ← Cancelar
            </button>
          ) : (
            <Btn variant="outline" size="md" onClick={irAnterior}>Anterior</Btn>
          )}
          <Btn variant="primary" size="md" onClick={irSiguiente}>
            {step === 2 ? "Enviar solicitud" : "Siguiente"}
          </Btn>
        </div>
      )}

      {solicitudGuardada && <ConstanciaImprimible solicitud={solicitudGuardada} />}
    </div>
  );
}

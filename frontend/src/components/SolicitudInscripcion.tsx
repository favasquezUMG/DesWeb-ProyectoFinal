import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Stepper, Input, Select, Textarea, Btn, AlertBanner } from "./Ui";
import { MALLA_CNB } from "../data";

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

const GRADOS_DISPONIBLES = MALLA_CNB.flatMap((nivel) => nivel.grados.map((g) => g.nombre));

// Rango de edad esperado por grado, solo para validar coherencia (no es un límite estricto)
const RANGOS_EDAD_POR_GRADO: Record<string, { min: number; max: number }> = {
  "Párvulos 1": { min: 4, max: 5 },
  "Párvulos 2": { min: 5, max: 6 },
  "Párvulos 3": { min: 6, max: 7 },
  "Primero Primaria": { min: 6, max: 8 },
  "Segundo Primaria": { min: 7, max: 9 },
  "Tercero Primaria": { min: 8, max: 10 },
  "Cuarto Primaria": { min: 9, max: 11 },
  "Quinto Primaria": { min: 10, max: 12 },
  "Sexto Primaria": { min: 11, max: 13 },
  "Primero Básico": { min: 12, max: 15 },
  "Segundo Básico": { min: 13, max: 16 },
  "Tercero Básico": { min: 14, max: 17 },
  "Cuarto Bachillerato (Ciencias)": { min: 15, max: 19 },
  "Quinto Bachillerato (Ciencias)": { min: 16, max: 20 },
  "Sexto Bachillerato (Ciencias)": { min: 17, max: 21 },
};

const DOCUMENTOS_REQUERIDOS = [
  { id: "partida-nacimiento", label: "Certificación de nacimiento del alumno extendida por RENAP" },
  { id: "certificado-grado", label: "Certificado del último grado aprobado" },
  { id: "copia-dpi", label: "Copia de DPI del padre o encargado" },
  { id: "fotografias", label: "Dos fotografías tamaño cédula" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  grado: string;
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

function generarNumeroSolicitud(): string {
  const anio = new Date().getFullYear();
  const numero = Math.floor(Math.random() * 99999) + 1;
  return `SOL-${anio}-${String(numero).padStart(5, "0")}`;
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

  if (!d.fechaNacimiento) {
    errores.fechaNacimiento = "La fecha de nacimiento es obligatoria.";
  } else {
    const edad = calcularEdad(d.fechaNacimiento);
    if (edad === null || edad < 0 || edad > 25) {
      errores.fechaNacimiento = "Ingrese una fecha de nacimiento válida.";
    } else if (d.grado) {
      const rango = RANGOS_EDAD_POR_GRADO[d.grado];
      if (rango && (edad < rango.min || edad > rango.max)) {
        errores.fechaNacimiento = `La edad (${edad} años) no es coherente con ${d.grado} (rango esperado: ${rango.min}–${rango.max} años).`;
      }
    }
  }

  if (!d.grado) errores.grado = "Seleccione el grado al que aplica.";
  if (!d.sede) errores.sede = "Seleccione la sede.";
  return errores;
}

export default function SolicitudInscripcion({ modo, onFinalizar, onCancelar }: SolicitudInscripcionProps) {
  const [step, setStep] = useState(0);
  const [numeroSolicitud] = useState(generarNumeroSolicitud);

  const [encargado, setEncargado] = useState<DatosEncargado>({
    nombres: "", apellidos: "", dpi: "", telefono: "", correo: "", parentesco: "",
  });
  const [erroresEncargado, setErroresEncargado] = useState<Partial<Record<keyof DatosEncargado, string>>>({});

  const [alumno, setAlumno] = useState<DatosAlumno>({
    nombres: "", apellidos: "", fechaNacimiento: "", grado: "", sede: "",
  });
  const [erroresAlumno, setErroresAlumno] = useState<Partial<Record<keyof DatosAlumno, string>>>({});

  const [documentos, setDocumentos] = useState<Record<string, boolean>>({});
  const [observaciones, setObservaciones] = useState("");
  const [errorDocumentos, setErrorDocumentos] = useState("");

  function actualizarEncargado<K extends keyof DatosEncargado>(campo: K, valor: string) {
    setEncargado((prev) => ({ ...prev, [campo]: valor }));
    setErroresEncargado((prev) => ({ ...prev, [campo]: undefined }));
  }

  function actualizarAlumno<K extends keyof DatosAlumno>(campo: K, valor: string) {
    setAlumno((prev) => ({ ...prev, [campo]: valor }));
    setErroresAlumno((prev) => ({ ...prev, [campo]: undefined }));
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
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function irAnterior() {
    setStep((s) => Math.max(s - 1, 0));
  }

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
          <Select label="Grado al que aplica" value={alumno.grado} onChange={(e) => actualizarAlumno("grado", e.target.value)} error={erroresAlumno.grado}>
            <option value="">Seleccione…</option>
            {GRADOS_DISPONIBLES.map((g) => <option key={g} value={g}>{g}</option>)}
          </Select>
          <div className="sm:col-span-2">
            <Select label="Sede" value={alumno.sede} onChange={(e) => actualizarAlumno("sede", e.target.value)} error={erroresAlumno.sede}>
              <option value="">Seleccione…</option>
              {SEDES_DISPONIBLES.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
          </div>
        </div>
      )}

      {/* ── Paso 3: Documentos ── */}
      {step === 2 && (
        <div className="space-y-4">
          <AlertBanner
            type={modo === "publico" ? "warning" : "info"}
            title={modo === "publico" ? "Entrega física obligatoria" : "Checklist de recepción"}
            message={
              modo === "publico"
                ? "Aquí no se suben archivos. Debe presentar estos documentos físicamente en la sede seleccionada para completar el proceso de inscripción."
                : "Marque cada documento conforme la familia lo entregue en ventanilla y agregue observaciones si algo queda pendiente."
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
      {step === 3 && (
        <div className="text-center py-2 space-y-5">
          <div className="w-14 h-14 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <p className="text-sm text-stone-500">Número de solicitud</p>
            <p className="font-display text-2xl font-semibold text-primary-700 font-mono-data">{numeroSolicitud}</p>
          </div>

          <AlertBanner
            type="info"
            title="¿Qué sigue?"
            message={`Recibirá un correo a ${encargado.correo || "su correo registrado"} con el resultado de la solicitud en un plazo de 5 días hábiles.`}
          />

          <AlertBanner
            type="warning"
            title="Esto todavía no es un acceso al sistema"
            message="Esta solicitud no le da acceso al portal. Si es aprobada, le enviaremos sus credenciales por ese mismo correo; mientras tanto, no podrá iniciar sesión."
          />

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
    </div>
  );
}

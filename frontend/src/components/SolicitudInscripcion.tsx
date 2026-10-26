import { useEffect, useState } from "react";
import { CheckCircle2, Clock, Download, Printer } from "./Iconos";
import { Stepper, Input, Select, Textarea, Btn, AlertBanner } from "./Ui";
import {
  type SolicitudGuardada,
  guardarSolicitud,
  generarNumeroSolicitud,
  calcularFechaLimite,
  formatearFecha,
} from "../lib/solicitudes";
import { generarConstanciaPdf, etiquetaGradoSolicitud } from "../lib/constanciaPdf";
import axios from "axios";
import { getInfoInicio, getMisDatosSolicitud, crearSolicitudPropia, type InfoInicioDto, type DatosSaludDto } from "@/lib/api";
import { CamposSalud, SALUD_VACIA } from "./InfoSalud";

export type SolicitudInscripcionModo = "publico" | "presencial";

interface SolicitudInscripcionProps {
  modo: SolicitudInscripcionModo;
  /** Encargado con sesión iniciada que inscribe a otro hijo: la solicitud queda a nombre de su cuenta */
  conCuenta?: boolean;
  onFinalizar?: () => void;
  onCancelar?: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

const STEPS = ["Encargado", "Alumno", "Documentos", "Confirmación"];

const PARENTESCOS = ["Madre", "Padre", "Tutor Legal", "Otro"];

const DOCUMENTOS = [
  { id: "partida-nacimiento", label: "Certificación de nacimiento del alumno extendida por RENAP" },
  { id: "certificado-grado", label: "Certificado del último grado aprobado" },
  { id: "copia-dpi", label: "Copia de DPI del padre o encargado" },
  { id: "fotografias", label: "Dos fotografías tamaño cédula" },
];

// En Preprimaria el alumno suele empezar a estudiar: no tiene un grado aprobado que certificar
const documentosRequeridos = (nivel: string) =>
  normalizar(nivel) === "preprimaria" ? DOCUMENTOS.filter((d) => d.id !== "certificado-grado") : DOCUMENTOS;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Edad esperada por nivel: el primer grado empieza en "base" años y cada grado suma uno,
// con "holgura" años de margen. Un nivel que no esté aquí no se valida por edad.
const EDAD_POR_NIVEL: Record<string, { base: number; holgura: number }> = {
  preprimaria: { base: 4, holgura: 1 },
  primaria: { base: 6, holgura: 2 },
  basico: { base: 12, holgura: 3 },
  diversificado: { base: 15, holgura: 4 },
};

const normalizar = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

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
  nivel: string;
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

function rangoEdad(d: DatosAlumno, niveles: InfoInicioDto["niveles"]): { min: number; max: number } | null {
  const regla = EDAD_POR_NIVEL[normalizar(d.nivel)];
  const indice = niveles.find((n) => n.nivel === d.nivel)?.grados.indexOf(d.grado) ?? -1;
  if (!regla || indice === -1) return null;
  return { min: regla.base + indice, max: regla.base + indice + regla.holgura };
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

function validarAlumno(d: DatosAlumno, niveles: InfoInicioDto["niveles"]): Partial<Record<keyof DatosAlumno, string>> {
  const errores: Partial<Record<keyof DatosAlumno, string>> = {};
  if (!d.nombres.trim()) errores.nombres = "Los nombres son obligatorios.";
  if (!d.apellidos.trim()) errores.apellidos = "Los apellidos son obligatorios.";
  if (!d.nivel) errores.nivel = "Seleccione el nivel educativo.";
  else if (!d.grado) errores.grado = "Seleccione el grado al que aplica.";

  if (!d.fechaNacimiento) {
    errores.fechaNacimiento = "La fecha de nacimiento es obligatoria.";
  } else {
    const edad = calcularEdad(d.fechaNacimiento);
    if (edad === null || edad < 0 || edad > 30) {
      errores.fechaNacimiento = "Ingrese una fecha de nacimiento válida.";
    } else {
      const rango = rangoEdad(d, niveles);
      if (rango && (edad < rango.min || edad > rango.max)) {
        errores.fechaNacimiento = `La edad (${edad} años) no es coherente con el grado seleccionado (rango esperado: ${rango.min}–${rango.max} años).`;
      }
    }
  }

  if (!d.sede) errores.sede = "Seleccione la sede.";
  return errores;
}

function ConstanciaImprimible({ solicitud }: { solicitud: SolicitudGuardada }) {
  return (
    <div id="constancia-imprimible" className="p-10 text-stone-900 text-sm">
      <div className="flex items-start justify-between border-b-2 border-primary-700 pb-3 mb-4">
        <div>
          <p className="font-display text-xl font-bold text-primary-700">Colegio Vanguardia</p>
          <p className="text-stone-500 text-xs">Constancia de solicitud de inscripción</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-stone-500">Número de solicitud</p>
          <p className="font-display font-bold tabular-nums text-primary-700">{solicitud.numero}</p>
        </div>
      </div>

      <p className="text-xs text-stone-500 mb-4">Fecha de emisión: {formatearFecha(solicitud.fechaSolicitud)}</p>

      <section className="mb-4">
        <h3 className="font-display text-lg font-bold text-stone-900 pb-2 mb-3 border-b-[1.5px] border-stone-200">Datos del encargado</h3>
        <p>Nombre: {solicitud.encargado.nombres} {solicitud.encargado.apellidos}</p>
        <p>DPI: {solicitud.encargado.dpi}</p>
        <p>Teléfono: {solicitud.encargado.telefono}</p>
        <p>Correo electrónico: {solicitud.encargado.correo}</p>
        <p>Parentesco con el alumno: {solicitud.encargado.parentesco}</p>
      </section>

      <section className="mb-4">
        <h3 className="font-display text-lg font-bold text-stone-900 pb-2 mb-3 border-b-[1.5px] border-stone-200">Datos del alumno</h3>
        <p>Nombre: {solicitud.alumno.nombres} {solicitud.alumno.apellidos}</p>
        <p>Fecha de nacimiento: {formatearFecha(solicitud.alumno.fechaNacimiento)}</p>
        <p>Nivel: {solicitud.alumno.nivel}</p>
        {solicitud.alumno.carrera && <p>Carrera: {solicitud.alumno.carrera}</p>}
        <p>Grado / año solicitado: {etiquetaGradoSolicitud(solicitud.alumno)}</p>
        <p>Sede: {solicitud.alumno.sede}</p>
      </section>

      <section className="mb-4">
        <h3 className="font-display text-lg font-bold text-stone-900 pb-2 mb-3 border-b-[1.5px] border-stone-200">Documentos a presentar en la sede</h3>
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

export default function SolicitudInscripcion({ modo, conCuenta = false, onFinalizar, onCancelar }: SolicitudInscripcionProps) {
  const [step, setStep] = useState(0);
  const [numeroSolicitud] = useState(generarNumeroSolicitud);
  const [fechaLimite] = useState(calcularFechaLimite);
  const [solicitudGuardada, setSolicitudGuardada] = useState<SolicitudGuardada | null>(null);
  const [cargandoEmail, setCargandoEmail] = useState(false);
  const [info, setInfo] = useState<InfoInicioDto | null>(null);
  const [errorCarga, setErrorCarga] = useState("");
  // Con cuenta: datos que ya tiene el encargado. Lo que falte (DPI, teléfono o parentesco) se le pide una vez
  const [faltantes, setFaltantes] = useState<Set<keyof DatosEncargado> | null>(null);

  const [encargado, setEncargado] = useState<DatosEncargado>({
    nombres: "", apellidos: "", dpi: "", telefono: "", correo: "", parentesco: "",
  });
  const [erroresEncargado, setErroresEncargado] = useState<Partial<Record<keyof DatosEncargado, string>>>({});

  const [alumno, setAlumno] = useState<DatosAlumno>({
    nombres: "", apellidos: "", fechaNacimiento: "", nivel: "", grado: "", sede: "",
  });
  const [erroresAlumno, setErroresAlumno] = useState<Partial<Record<keyof DatosAlumno, string>>>({});
  const [salud, setSalud] = useState<DatosSaludDto>(SALUD_VACIA);

  const [documentos, setDocumentos] = useState<Record<string, boolean>>({});
  const [observaciones, setObservaciones] = useState("");
  const [errorDocumentos, setErrorDocumentos] = useState("");

  const sedes = info?.sedes ?? [];
  const niveles = info?.niveles ?? [];
  const gradosDelNivel = niveles.find((n) => n.nivel === alumno.nivel)?.grados ?? [];
  const documentosAlumno = documentosRequeridos(alumno.nivel);

  function actualizarEncargado<K extends keyof DatosEncargado>(campo: K, valor: string) {
    setEncargado((prev) => ({ ...prev, [campo]: valor }));
    setErroresEncargado((prev) => ({ ...prev, [campo]: undefined }));
  }

  function actualizarAlumno<K extends keyof DatosAlumno>(campo: K, valor: string) {
    setAlumno((prev) => ({ ...prev, [campo]: valor }));
    setErroresAlumno((prev) => ({ ...prev, [campo]: undefined }));
  }

  function cambiarNivel(valor: string) {
    setAlumno((prev) => ({ ...prev, nivel: valor, grado: "" }));
    setErroresAlumno((prev) => ({ ...prev, nivel: undefined, grado: undefined }));
  }

  function marcarDocumento(id: string, valor: boolean) {
    setDocumentos((prev) => ({ ...prev, [id]: valor }));
    setErrorDocumentos("");
  }

  async function irSiguiente() {
    if (step === 0 && conCuenta) {
      const errores = validarEncargado(encargado);
      setErroresEncargado(errores);
      if (Object.values(errores).some(Boolean)) return;
    } else if (step === 0) {

      const errores = validarEncargado(encargado);
      setErroresEncargado(errores);
      if (Object.values(errores).some(Boolean)) return;

      //Validacion de que no exista el correo ya en la DB
      setCargandoEmail(true);
      try{
        const response = await axios.get(`${API_URL}/api/usuarios/verificar-email`, {
          params: { email: encargado.correo.trim()}
        })
        
        if(response.data.exists){
          setErroresEncargado((prev) => ({
            ...prev,
            correo: "Este correo ya esta registrado en nuestro sistema."
          }));
          setCargandoEmail(false);
          return;
        }
      } catch (error) {
        setErroresEncargado((prev) => ({
          ...prev,
          correo: "No se pudo verificar disponibilidad del correo. Intente de nuevo."
        }));
        setCargandoEmail(false);
        console.error()
        return;
      }
      setCargandoEmail(false)
    } else if (step === 1) {
      const errores = validarAlumno(alumno, niveles);
      setErroresAlumno(errores);
      if (Object.values(errores).some(Boolean)) return;
    } else if (step === 2) {
      const faltanDocumentos = documentosAlumno.some((doc) => !documentos[doc.id]);
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
          nivel: alumno.nivel,
          grado: alumno.grado,
          sede: alumno.sede,
          necesidadesApoyo: salud.necesidadesApoyo?.trim() || null,
          alergias: salud.alergias?.trim() || null,
          medicamentos: salud.medicamentos?.trim() || null,
        },
        documentos: documentosAlumno.map((d) => d.label),
        observaciones: modo === "presencial" ? observaciones.trim() || undefined : undefined,
        fechaSolicitud: new Date().toISOString(),
        fechaLimite: fechaLimite.toISOString(),
      };

      try{
        if (conCuenta) {
          await crearSolicitudPropia({
            numero: registro.numero,
            alumno: { ...registro.alumno },
            documentos: registro.documentos,
            fechaSolicitud: registro.fechaSolicitud,
            fechaLimite: registro.fechaLimite,
            dpi: encargado.dpi,
            telefono: encargado.telefono,
            parentesco: encargado.parentesco,
          });
        } else {
          await guardarSolicitud(registro);
        }
        setSolicitudGuardada(registro);
        setStep((s) => Math.min(s+1, STEPS.length - 1))
        return;
      } catch (error) {
        console.error("Error al guardar la solicitud:", error);
        setErrorDocumentos(error instanceof Error ? error.message : "Ocurrió un error al guardar la solicitud en el servidor. Vuelva a intentar.")
        return;
      }
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function irAnterior() {
    setStep((s) => Math.max(s - 1, 0));
  }

  useEffect(() => {
    getInfoInicio()
      .then(setInfo)
      .catch(() => setErrorCarga("No se pudieron cargar las sedes y los grados. Recargue la página e intente de nuevo."));
  }, []);

  useEffect(() => {
    if (!conCuenta) return;
    getMisDatosSolicitud()
      .then((datos) => {
        setEncargado(datos);
        const falta = new Set<keyof DatosEncargado>(
          (["dpi", "telefono", "parentesco"] as const).filter((campo) => !datos[campo]),
        );
        setFaltantes(falta);
        // Si ya tiene todo, empieza directo con los datos del alumno
        if (falta.size === 0) setStep(1);
      })
      .catch(() => setErrorCarga("No se pudieron cargar sus datos. Recargue la página e intente de nuevo."));
  }, [conCuenta]);

  // Con cuenta y sin datos faltantes, el paso "Encargado" no se muestra
  const saltaEncargado = conCuenta && faltantes?.size === 0;
  const pasos = saltaEncargado ? STEPS.slice(1) : STEPS;
  const pasoVisible = saltaEncargado ? step - 1 : step;

  const fechaLimiteTexto = formatearFecha(fechaLimite);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-bold text-stone-900 mb-1">Solicitud de inscripción</h2>
        <p className="text-stone-500 text-sm">
          {modo === "publico"
            ? "Complete los siguientes pasos para solicitar el cupo de su hijo. La documentación se entrega físicamente en la sede."
            : "Registre los datos de la solicitud recibida en ventanilla."}
        </p>
      </div>

      <Stepper steps={pasos} current={pasoVisible} />

      {conCuenta && (
        <div className="px-4 py-3 rounded-xl bg-sand-50 border border-stone-200 text-sm text-stone-600">
          La solicitud queda a nombre de su cuenta: <span className="font-semibold text-stone-900">{encargado.nombres} {encargado.apellidos}</span> ({encargado.correo})
          {encargado.parentesco && !faltantes?.has("parentesco") && <>, como <span className="font-semibold text-stone-900">{encargado.parentesco}</span></>}.
          Al aprobarla, el alumno aparecerá junto a sus otros hijos.
        </div>
      )}

      {step === 0 && conCuenta && (
        faltantes === null ? (
          errorCarga ? <AlertBanner type="error" message={errorCarga} /> : <p className="text-sm text-stone-500">Cargando sus datos…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="sm:col-span-2 text-sm text-stone-500">Complete estos datos una sola vez; se usarán en sus próximas solicitudes.</p>
            {faltantes.has("dpi") && (
              <Input
                label="DPI" value={encargado.dpi} inputMode="numeric" placeholder="0000000000000"
                onChange={(e) => actualizarEncargado("dpi", e.target.value.replace(/\D/g, "").slice(0, 13))}
                error={erroresEncargado.dpi} hint={!erroresEncargado.dpi ? "13 dígitos, sin espacios ni guiones" : undefined}
              />
            )}
            {faltantes.has("telefono") && (
              <Input
                label="Teléfono" value={encargado.telefono} inputMode="numeric" placeholder="00000000"
                onChange={(e) => actualizarEncargado("telefono", e.target.value.replace(/\D/g, "").slice(0, 8))}
                error={erroresEncargado.telefono}
              />
            )}
            {faltantes.has("parentesco") && (
              <div className="sm:col-span-2">
                <Select label="Parentesco con el alumno" value={encargado.parentesco} onChange={(e) => actualizarEncargado("parentesco", e.target.value)} error={erroresEncargado.parentesco}>
                  <option value="">Seleccione…</option>
                  {PARENTESCOS.map((p) => <option key={p} value={p}>{p}</option>)}
                </Select>
              </div>
            )}
          </div>
        )
      )}

      {step === 0 && !conCuenta && (
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

      {step === 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Nombres del alumno" value={alumno.nombres} onChange={(e) => actualizarAlumno("nombres", e.target.value)} error={erroresAlumno.nombres} />
          <Input label="Apellidos del alumno" value={alumno.apellidos} onChange={(e) => actualizarAlumno("apellidos", e.target.value)} error={erroresAlumno.apellidos} />
          <Input label="Fecha de nacimiento" type="date" value={alumno.fechaNacimiento} onChange={(e) => actualizarAlumno("fechaNacimiento", e.target.value)} error={erroresAlumno.fechaNacimiento} />
          <Select label="Sede" value={alumno.sede} onChange={(e) => actualizarAlumno("sede", e.target.value)} error={erroresAlumno.sede}>
            <option value="">Seleccione…</option>
            {sedes.map((s) => (
              <option key={s.sedeId} value={s.nombre}>
                {s.nombre}
              </option>
            ))}
          </Select>

          <Select label="Nivel educativo" value={alumno.nivel} onChange={(e) => cambiarNivel(e.target.value)} error={erroresAlumno.nivel}>
            <option value="">Seleccione…</option>
            {niveles.map((n) => <option key={n.nivel} value={n.nivel}>{n.nivel}</option>)}
          </Select>

          {alumno.nivel && (
            <Select label="Grado al que aplica" value={alumno.grado} onChange={(e) => actualizarAlumno("grado", e.target.value)} error={erroresAlumno.grado}>
              <option value="">Seleccione…</option>
              {gradosDelNivel.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          )}

          {errorCarga && <div className="sm:col-span-2"><AlertBanner type="error" message={errorCarga} /></div>}

          <div className="sm:col-span-2 pt-4 mt-2 border-t border-stone-200 space-y-4">
            <div>
              <h3 className="font-display font-bold text-stone-900">Salud y necesidades de apoyo <span className="text-sm font-normal text-stone-500">(opcional)</span></h3>
              <p className="text-sm text-stone-500 mt-1">
                Si el alumno tiene alguna discapacidad, condición de salud, alergias o toma
                medicamentos, indíquelo para que el colegio prepare los apoyos y sepa cómo atenderlo en una emergencia.
                Esta información no influye en la aprobación de la solicitud.
              </p>
            </div>
            <CamposSalud valor={salud} onChange={setSalud} />
          </div>
        </div>
      )}

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
            {documentosAlumno.map((doc) => (
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

      {step === 3 && solicitudGuardada && (
        <div className="text-center py-2 space-y-5">
          <div className="w-14 h-14 rounded-full bg-success-100 text-success-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-7 h-7" />
          </div>

          <div>
            <p className="text-sm text-stone-500">Número de solicitud</p>
            <p className="font-display text-2xl font-bold text-primary-700 font-mono-data">{solicitudGuardada.numero}</p>
          </div>

          <div className="px-4 py-3 bg-warning-50 border border-warning-200 rounded-lg text-left">
            <p className="text-sm font-semibold text-warning-800">Fecha límite para entregar los documentos: {formatearFecha(solicitudGuardada.fechaLimite)}</p>
            <p className="text-xs text-warning-800 mt-1">Si no se presentan a tiempo en la sede, la solicitud pasará automáticamente a estado VENCIDA.</p>
          </div>

          <AlertBanner
            type="info"
            title="¿Qué sigue?"
            message={conCuenta
              ? "El resultado de la solicitud se resuelve en un plazo de 5 días hábiles. Si es aprobada, el alumno aparecerá en su cuenta junto a sus otros hijos."
              : `Le enviamos esta constancia a ${solicitudGuardada.encargado.correo}. El resultado de la solicitud se resuelve en un plazo de 5 días hábiles.`}
          />

          {!conCuenta && (
            <AlertBanner
              type="warning"
              title="Esto todavía no es un acceso al sistema"
              message="Esta solicitud no le da acceso al portal. Si es aprobada, le enviaremos sus credenciales por ese mismo correo; mientras tanto, no podrá iniciar sesión."
            />
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Btn variant="outline" size="md" className="justify-center" icon={<Download className="w-4 h-4" />} onClick={() => generarConstanciaPdf(solicitudGuardada)}>
              Descargar constancia
            </Btn>
            <Btn variant="outline" size="md" className="justify-center" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>
              Imprimir constancia
            </Btn>
          </div>

          <Btn variant="primary" size="lg" className="w-full justify-center" onClick={onFinalizar}>
            {conCuenta ? "Volver a matrícula" : modo === "publico" ? "Volver al inicio de sesión" : "Finalizar"}
          </Btn>
        </div>
      )}

      {step < 3 && (
        <div className="flex items-center justify-between pt-2">
          {step === 0 || (saltaEncargado && step === 1) ? (
            <button type="button" onClick={onCancelar} className="text-sm text-stone-500 hover:text-stone-700 py-1">
              ← Cancelar
            </button>
          ) : (
            <Btn variant="outline" size="md" onClick={irAnterior}>Anterior</Btn>
          )}
          <Btn variant="primary" size="md" onClick={irSiguiente} disabled={cargandoEmail || (conCuenta && faltantes === null)}>
            { cargandoEmail ? "Verificando..." : step === 2 ? "Enviar solicitud" : "Siguiente"}
          </Btn>
        </div>
      )}

      {solicitudGuardada && <ConstanciaImprimible solicitud={solicitudGuardada} />}
    </div>
  );
}

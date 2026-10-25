import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  CreditCard, ShoppingCart, CheckCircle2, AlertCircle, AlertTriangle, Download, ChevronRight, User, Bell, BookOpen,
  KeyRound, ShieldCheck, UserPlus, School, Laptop, Clock, Heart,
} from "../components/Iconos";
import type { AppUser, View } from "../types";
import {
  getEstadoCuenta, getMisHijos, getHijosEncargado, getBoletinHijo, getOpcionesMatricula, crearMatricula,
  getAsistenciaHijos, setNotificacionesHijo, cambiarPassword, restablecerPasswordHijo, setSaludHijo, getHorarioHijo, getEventos,
  type EstadoCuentaDto, type HijoDto, type MesEstadoCuentaDto, type HijoEncargadoDto, type BoletinHijoDto,
  type OpcionesMatriculaDto, type SeccionMatriculaDto, type MatriculaCreadaResponse,
  type AsistenciaHijoDto, type ClaseAlumnoDto, type EventoDto, type DatosSaludDto,
} from "../lib/api";
import { ModalSalud, tieneSalud } from "../components/InfoSalud";
import { generarBoletinPdf } from "../lib/boletinPdf";
import { PagoColegiaturaModal, formatoQ } from "../components/PagoColegiatura";
import { CarritoBoton, claveColegiatura, useCarrito } from "../components/Carrito";
import SolicitudInscripcion from "../components/SolicitudInscripcion";
import CalendarioEventos from "../components/CalendarioEventos";
import HorarioSemanal, { asuetosDeLaSemana, diaSemanaHoy, jornadaPorDia } from "../components/HorarioSemanal";
import {
  Card, MetricCard, SectionHeader, Btn, Badge, PagoBadge, EstadoBadge,
  AlertBanner, Stepper, TH, TD, Select, EmptyState, Input, Toggle, Modal,
  CursoMarca, Anillo, CardTitulo, LinkAccion,
} from "../components/Ui";
import AvisosPadre from "./AvisosPadre";
import AsistenciaPadre from "./AsistenciaPadre";
import BecasPadre from "./BecasPadre";
import EventosPadre from "./EventosPadre";

const errorDe = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

// ─── Hijos a cargo (compartido por las pantallas) ────────────────────────────

function useHijosEncargado() {
  const [hijos, setHijos] = useState<HijoEncargadoDto[] | null>(null);
  const [error, setError] = useState("");

  const recargar = useCallback(() => {
    return getHijosEncargado()
      .then(setHijos)
      .catch((e) => setError(errorDe(e, "No se pudieron cargar los alumnos a su cargo.")));
  }, []);

  useEffect(() => { recargar(); }, [recargar]);

  return { hijos, setHijos, error, recargar };
}

function SelectorHijo({ hijos, value, onChange }: { hijos: HijoEncargadoDto[]; value: number | null; onChange: (id: number) => void }) {
  if (hijos.length <= 1) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-full bg-white border-[1.5px] border-stone-200" role="group" aria-label="Alumno que está viendo">
      {hijos.map((h) => {
        const on = value === h.alumnoId;
        return (
          <button key={h.alumnoId} onClick={() => onChange(h.alumnoId)} aria-pressed={on}
            className={`flex items-center gap-2 pl-1 pr-3.5 py-1 rounded-full text-sm font-semibold transition-colors cursor-pointer
              ${on ? "bg-primary-800 text-white" : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"}`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${on ? "bg-subject-social text-stone-900" : "bg-stone-100 text-stone-600"}`}>
              {h.nombre.charAt(0)}
            </span>
            {h.nombre.split(" ").slice(0, 2).join(" ")}{h.retirado ? " (retirado)" : ""}
          </button>
        );
      })}
    </div>
  );
}

function SinHijos({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <SectionHeader title={title} />
      <EmptyState icon={<User className="w-10 h-10" />} title="Sin alumnos asociados"
        description="Su cuenta no tiene alumnos a cargo. Comuníquese con la administración del colegio." />
    </div>
  );
}

function Cargando({ filas = 3 }: { filas?: number }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: filas }, (_, i) => <div key={i} className="h-28 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}
    </div>
  );
}

const colorNota = (n: number | null, minimo = 61) =>
  n === null ? "text-stone-300" : n >= minimo ? "text-success-700" : "text-danger-700";

// ─── Dashboard ───────────────────────────────────────────────────────────────

function DashboardPadre({ user, onNavigate }: { user?: AppUser; onNavigate?: (v: View) => void }) {
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const { hijos, error: errorHijos } = useHijosEncargado();
  const [hijoId, setHijoId] = useState<number | null>(null);
  const [boletin, setBoletin] = useState<BoletinHijoDto | null>(null);
  const [cuenta, setCuenta] = useState<EstadoCuentaDto | null>(null);
  const [asistencia, setAsistencia] = useState<Map<number, AsistenciaHijoDto>>(new Map());
  const [clases, setClases] = useState<ClaseAlumnoDto[]>([]);
  const [eventos, setEventos] = useState<EventoDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hijos && hijoId === null && hijos.length) setHijoId(hijos[0].alumnoId);
  }, [hijos, hijoId]);

  // La asistencia viene de todos los hijos en una sola llamada
  useEffect(() => {
    getAsistenciaHijos()
      .then((data) => setAsistencia(new Map(data.map((h) => [h.alumnoId, h]))))
      .catch(() => setAsistencia(new Map()));
    getEventos().then(setEventos).catch(() => setEventos([]));
  }, []);

  const hijo = hijos?.find((h) => h.alumnoId === hijoId) ?? null;

  useEffect(() => {
    if (!hijo) return;
    let cancelado = false;
    setCargando(true);
    setError("");
    setBoletin(null);
    setCuenta(null);
    setClases([]);
    Promise.all([
      hijo.puedeVerNotas ? getBoletinHijo(hijo.alumnoId) : Promise.resolve(null),
      hijo.puedeVerPagos ? getEstadoCuenta(hijo.alumnoId, anio) : Promise.resolve(null),
      getHorarioHijo(hijo.alumnoId).catch(() => [] as ClaseAlumnoDto[]),
    ])
      .then(([b, c, h]) => { if (!cancelado) { setBoletin(b); setCuenta(c); setClases(h); } })
      .catch((e) => { if (!cancelado) setError(errorDe(e, "No se pudo cargar el resumen.")); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [hijo, anio]);

  if (hijos && hijos.length === 0) return <SinHijos title="Panel del Encargado" />;

  const meses = cuenta?.detalle.map((m) => ({ ...m, ui: estadoMesUi(m, anio) })) ?? [];
  const vencidos = meses.filter((m) => m.ui === "vencido");
  const saldoVencido = vencidos.reduce((s, m) => s + m.montoAPagar, 0);
  const proximo = vencidos[0] ?? meses.find((m) => m.ui === "pendiente" && m.mes >= mesActual) ?? null;
  const recientes = meses.filter((m) => m.mes <= Math.max(mesActual, meses[0]?.mes ?? 1)).slice(-5);
  const asistenciaHijo = hijo ? asistencia.get(hijo.alumnoId) : undefined;
  const porcentajeAsistencia = asistenciaHijo?.resumen.porcentaje;
  const primerNombre = hijo?.nombre.split(" ")[0] ?? "";

  // Lo que pasa hoy: asueto, horario de entrada/salida y faltas ya registradas
  const hoyDia = diaSemanaHoy();
  const asuetoHoy = hijo ? asuetosDeLaSemana(eventos, hijo.sedeId).get(hoyDia) : undefined;
  const jornadaHoy = jornadaPorDia(clases).get(hoyDia);
  const ahora = new Date();
  const hoyIso = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, "0")}-${String(ahora.getDate()).padStart(2, "0")}`;
  const faltasHoy = asistenciaHijo?.dias.find((x) => x.fecha === hoyIso)?.clases.filter((c) => c.estado === "Ausente" || c.estado === "Tarde") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end gap-4">
        <SectionHeader title={`Hola, ${user?.name.split(" ")[0] ?? ""}`} subtitle="Así va todo con sus hijos en el colegio" />
        <div className="lg:ml-auto shrink-0">
          {hijos && <SelectorHijo hijos={hijos} value={hijoId} onChange={setHijoId} />}
        </div>
      </div>

      {(errorHijos || error) && <AlertBanner type="error" message={errorHijos || error} />}

      {hijo && (
        <div className="flex flex-col md:flex-row md:items-center gap-4 p-5 rounded-[20px] bg-primary-800 textile-pattern text-white">
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <span className="w-14 h-14 rounded-2xl bg-subject-social text-stone-900 font-display font-extrabold text-2xl flex items-center justify-center shrink-0 rotate-[-3deg]">
              {hijo.nombre.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="font-display font-bold text-2xl leading-tight truncate">{hijo.nombre}</p>
              <p className="text-white/70 text-sm mt-0.5">{hijo.grado}, sección {hijo.seccion}. {hijo.sede}</p>
            </div>
          </div>
          {!hijo.retirado && (
            <div className="flex items-center gap-3 md:pl-5 md:border-l border-white/15">
              <Clock className="w-5 h-5 text-subject-social shrink-0" />
              {asuetoHoy ? <p className="text-sm font-semibold">Hoy no hay clases: {asuetoHoy}</p>
                : jornadaHoy ? (
                  <div className="flex gap-5">
                    <div><p className="text-xs text-white/60">Entrada hoy</p><p className="font-display font-bold text-xl tabular-nums">{jornadaHoy.entrada}</p></div>
                    <div><p className="text-xs text-white/60">Salida</p><p className="font-display font-bold text-xl tabular-nums">{jornadaHoy.salida}</p></div>
                  </div>
                )
                : <p className="text-sm font-semibold text-white/80">Hoy no tiene clases programadas</p>}
            </div>
          )}
        </div>
      )}

      {hijo?.retirado && (
        <AlertBanner type="info" title={`${primerNombre} figura como retirado del ciclo ${hijo.anioLectivo}`}
          message="Puede consultar su historial de notas y pagos. Para reincorporarlo, use Matrícula o comuníquese con la administración." />
      )}

      {hijo && !hijo.autorizadoRecoger && !hijo.retirado && (
        <AlertBanner type="warning" message={`Usted no figura como autorizado para recoger a ${primerNombre}. Si necesita hacerlo, la persona autorizada o la administración de la sede deben gestionarlo antes.`} />
      )}

      {faltasHoy.length > 0 && (
        <AlertBanner type="warning" title={`Asistencia de hoy de ${primerNombre}`}
          message={`${faltasHoy.map((c) => `${c.estado === "Ausente" ? "Ausente" : "Tarde"} en ${c.curso}`).join(", ")}. Si hubo un motivo, puede solicitar la justificación en Asistencia.`} />
      )}

      {saldoVencido > 0 && (
        <AlertBanner type="error" title={`${primerNombre} tiene pagos vencidos`}
          message={`Tiene ${vencidos.length} ${vencidos.length === 1 ? "cuota vencida" : "cuotas vencidas"} por ${formatoQ(saldoVencido)}. La más antigua es ${vencidos[0].nombreMes} ${anio}. Regularice su cuenta para evitar recargos.`} />
      )}

      {!hijos || cargando ? <Cargando filas={3} /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <Card className="p-6">
            <p className="text-sm font-semibold text-stone-500">Promedio general</p>
            <p className={`font-display font-bold text-[3.75rem] leading-none tabular-nums tracking-tight mt-2 ${boletin?.promedioGeneral == null ? "text-stone-300" : boletin.promedioGeneral >= boletin.notaAprobacion ? "text-stone-900" : "text-danger-700"}`}>
              {boletin?.promedioGeneral != null ? Math.round(boletin.promedioGeneral) : "—"}
            </p>
            {boletin && boletin.cursos.length > 0 ? (
              <>
                <div className="flex gap-1 mt-5" aria-hidden="true">
                  {boletin.cursos.map((c) => (
                    <span key={c.cursoSeccionId} title={c.curso} className={`h-2.5 flex-1 rounded-full ${c.aprobado === null ? "bg-stone-200" : c.aprobado ? "bg-primary-700" : "bg-danger-600"}`} />
                  ))}
                </div>
                <p className="text-[13px] text-stone-500 mt-2"><span className="font-bold text-stone-900">{boletin.cursosAprobados} de {boletin.cursos.length}</span> cursos aprobados</p>
              </>
            ) : <p className="text-[13px] text-stone-500 mt-3">{hijo?.puedeVerNotas ? "Sin notas aún" : "Sin acceso a notas"}</p>}
          </Card>

          <Card className="p-6 flex items-center gap-5">
            <Anillo valor={porcentajeAsistencia ?? 0} size={104} grosor={11} color={porcentajeAsistencia === undefined ? "#d2c8b7" : porcentajeAsistencia >= 80 ? "#0f7b5f" : "#d99e00"}>
              <span className="font-display font-bold text-2xl tabular-nums text-stone-900">{porcentajeAsistencia !== undefined ? `${Math.round(porcentajeAsistencia)}%` : "—"}</span>
            </Anillo>
            <div>
              <p className="font-display font-bold text-lg text-stone-900 leading-tight">Asistencia</p>
              <p className="text-[13px] text-stone-500 mt-1">En lo que va del ciclo</p>
              {asistenciaHijo && <p className="text-[13px] text-stone-600 mt-2"><span className="font-bold">{asistenciaHijo.resumen.ausentes}</span> ausencias, <span className="font-bold">{asistenciaHijo.resumen.tardes}</span> tardes</p>}
            </div>
          </Card>

          <div className={`rounded-[20px] p-6 flex flex-col ${!hijo?.puedeVerPagos ? "bg-white border border-stone-200/80" : proximo?.ui === "vencido" ? "bg-danger-600 text-white" : proximo ? "bg-subject-social text-stone-900" : "bg-success-600 text-white"}`}>
            <p className="text-sm font-semibold opacity-80 flex items-center gap-1.5"><CreditCard className="w-4 h-4" />Próximo pago</p>
            <p className="font-display font-bold text-[2.6rem] leading-none tabular-nums tracking-tight mt-3">
              {!hijo?.puedeVerPagos ? "—" : proximo ? formatoQ(proximo.montoAPagar) : "Al día"}
            </p>
            <p className="text-[13px] font-medium opacity-85 mt-auto pt-3">
              {!hijo?.puedeVerPagos ? "Sin acceso a pagos"
                : proximo ? `${proximo.nombreMes} ${anio}, ${proximo.ui === "vencido" ? "vencido" : "pendiente"}${proximo.descuentoPorcentaje > 0 ? `. Beca de ${proximo.descuentoPorcentaje}% aplicada` : ""}`
                : "No hay cuotas pendientes"}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="p-6 lg:col-span-3">
          <CardTitulo titulo="Resumen académico" accion={onNavigate && hijo?.puedeVerNotas && <LinkAccion onClick={() => onNavigate("pad-notas")}>Ver notas y boletas</LinkAccion>} />
          {!hijo?.puedeVerNotas ? (
            <p className="text-sm text-stone-500">Su vínculo con este alumno no incluye la consulta de notas.</p>
          ) : !boletin || boletin.cursos.length === 0 ? (
            <p className="text-sm text-stone-500">{cargando ? "Cargando…" : "El alumno aún no tiene cursos asignados."}</p>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              {boletin.cursos.slice(0, 8).map((c) => (
                <li key={c.cursoSeccionId} className="flex items-center gap-3 py-2.5 border-b border-stone-100">
                  <CursoMarca nombre={c.curso} size="sm" />
                  <span className="text-[15px] font-medium text-stone-800 flex-1 min-w-0 truncate">{c.curso}</span>
                  {c.promedio !== null
                    ? <span className={`font-display font-bold text-lg tabular-nums ${colorNota(c.promedio, boletin.notaAprobacion)}`} aria-label={c.aprobado ? "aprobado" : "reprobado"}>{Math.round(c.promedio)}</span>
                    : <span className="text-xs text-stone-400">Sin notas</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="p-6 lg:col-span-2">
          <CardTitulo titulo="Colegiaturas" accion={onNavigate && hijo?.puedeVerPagos && <LinkAccion onClick={() => onNavigate("pad-pagos")}>Ir a pagos</LinkAccion>} />
          {!hijo?.puedeVerPagos ? (
            <p className="text-sm text-stone-500">Su vínculo con este alumno no incluye la consulta de pagos.</p>
          ) : recientes.length === 0 ? (
            <p className="text-sm text-stone-500">{cargando ? "Cargando…" : "No hay colegiaturas registradas para este ciclo."}</p>
          ) : (
            <ol className="relative">
              {recientes.map((m, i) => (
                <li key={m.mes} className="flex items-center gap-3.5 py-2">
                  <span className="relative flex flex-col items-center self-stretch">
                    <span className={`w-3.5 h-3.5 rounded-full mt-1.5 ring-4 ring-white z-10 ${m.ui === "pagado" ? "bg-success-600" : m.ui === "vencido" ? "bg-danger-600" : "bg-warning-600"}`} />
                    {i < recientes.length - 1 && <span className="absolute top-4 -bottom-4 w-0.5 bg-stone-200" />}
                  </span>
                  <span className="text-[15px] font-medium text-stone-800 flex-1">{m.nombreMes}</span>
                  <span className="text-sm font-semibold text-stone-700 tabular-nums">{formatoQ(m.ui === "pagado" && m.monto !== null ? m.monto : m.montoAPagar)}</span>
                  <EstadoMesBadge estado={m.ui} />
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}

// ─── Horario ─────────────────────────────────────────────────────────────────

function HorarioHijo() {
  const { hijos, error: errorHijos } = useHijosEncargado();
  const [hijoId, setHijoId] = useState<number | null>(null);
  const [clases, setClases] = useState<ClaseAlumnoDto[] | null>(null);
  const [eventos, setEventos] = useState<EventoDto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hijos && hijoId === null && hijos.length) setHijoId(hijos[0].alumnoId);
  }, [hijos, hijoId]);

  useEffect(() => { getEventos().then(setEventos).catch(() => setEventos([])); }, []);

  useEffect(() => {
    if (hijoId === null) return;
    let cancelado = false;
    setClases(null);
    setError("");
    getHorarioHijo(hijoId)
      .then((c) => { if (!cancelado) setClases(c); })
      .catch((e) => { if (!cancelado) setError(errorDe(e, "No se pudo cargar el horario.")); });
    return () => { cancelado = true; };
  }, [hijoId]);

  if (hijos && hijos.length === 0) return <SinHijos title="Horario" />;

  const hijo = hijos?.find((h) => h.alumnoId === hijoId) ?? null;
  const primerNombre = hijo?.nombre.split(" ")[0] ?? "";

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SectionHeader title="Horario" subtitle={hijo ? `${hijo.nombre} · ${hijo.grado} ${hijo.seccion} · ${hijo.sede}` : undefined} />
        <div className="sm:ml-auto">{hijos && <SelectorHijo hijos={hijos} value={hijoId} onChange={setHijoId} />}</div>
      </div>

      {(errorHijos || error) && <AlertBanner type="error" message={errorHijos || error} />}

      {hijo?.retirado && (
        <AlertBanner type="info" message={`${primerNombre} figura como retirado; este era el horario de su última sección.`} />
      )}
      {hijo && !hijo.autorizadoRecoger && (
        <AlertBanner type="warning" message={`Usted no figura como autorizado para recoger a ${primerNombre} a la hora de salida.`} />
      )}

      {!clases ? <Cargando filas={2} /> : (
        <HorarioSemanal clases={clases} asuetos={asuetosDeLaSemana(eventos, hijo?.sedeId)} mostrarJornada />
      )}
    </div>
  );
}

// ─── Matrícula ───────────────────────────────────────────────────────────────

type MatriculaStep = 0 | 1 | 2 | 3;

function MatriculaView({ user }: { user?: AppUser }) {
  const { hijos, error: errorHijos } = useHijosEncargado();
  const [modoNuevo, setModoNuevo] = useState(false);
  const [step, setStep] = useState<MatriculaStep>(0);
  const [hijoId, setHijoId] = useState<number | null>(null);
  const [opciones, setOpciones] = useState<OpcionesMatriculaDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [anio, setAnio] = useState<number | null>(null);
  const [sedeId, setSedeId] = useState<number | null>(null);
  const [gradoId, setGradoId] = useState<number | null>(null);
  const [seccionId, setSeccionId] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<MatriculaCreadaResponse | null>(null);

  useEffect(() => {
    if (hijos && hijoId === null && hijos.length) setHijoId(hijos[0].alumnoId);
  }, [hijos, hijoId]);

  const cargarOpciones = useCallback(async (alumnoId: number) => {
    setCargando(true);
    setError("");
    try {
      const data = await getOpcionesMatricula(alumnoId);
      setOpciones(data);
      const anios = [...new Set(data.secciones.map((s) => s.anioLectivo))];
      // Por defecto el primer año en el que aún no tiene matrícula activa
      const libre = anios.find((a) => !data.matriculas.some((m) => m.anioLectivo === a && m.estado === "Activa"));
      setAnio(libre ?? anios[0] ?? null);
    } catch (e) {
      setError(errorDe(e, "No se pudieron cargar las opciones de matrícula."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (hijoId === null) return;
    setStep(0);
    setSedeId(null);
    setGradoId(null);
    setSeccionId(null);
    setResultado(null);
    cargarOpciones(hijoId);
  }, [hijoId, cargarOpciones]);

  if (modoNuevo) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Inscribir a un alumno nuevo" subtitle="La solicitud la revisa la administración de la sede antes de crear la cuenta del alumno."
          action={<Btn variant="ghost" size="sm" onClick={() => setModoNuevo(false)}>← Volver a matrícula</Btn>} />
        <SolicitudInscripcion modo="publico" onFinalizar={() => setModoNuevo(false)} onCancelar={() => setModoNuevo(false)} />
      </div>
    );
  }

  const accionNuevo = (
    <Btn variant="outline" size="sm" icon={<UserPlus className="w-4 h-4" />} onClick={() => setModoNuevo(true)}>Alumno nuevo</Btn>
  );

  if (hijos && hijos.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Matrícula" action={accionNuevo} />
        <EmptyState icon={<User className="w-10 h-10" />} title="Sin alumnos asociados"
          description="Para inscribir a un alumno que aún no estudia en el colegio, envíe una solicitud de inscripción." />
      </div>
    );
  }

  const hijo = hijos?.find((h) => h.alumnoId === hijoId) ?? null;
  const secciones = opciones?.secciones ?? [];
  const anios = [...new Set(secciones.map((s) => s.anioLectivo))];
  const delAnio = secciones.filter((s) => s.anioLectivo === anio);
  const sedes = [...new Map(delAnio.map((s) => [s.sede.sedeId, s.sede])).values()];
  const grados = [...new Map(delAnio.filter((s) => s.sede.sedeId === sedeId).map((s) => [s.grado.gradoId, s.grado])).values()]
    .sort((a, b) => a.orden - b.orden);
  const seccionesGrado = delAnio.filter((s) => s.sede.sedeId === sedeId && s.grado.gradoId === gradoId);
  const seccion: SeccionMatriculaDto | null = secciones.find((s) => s.seccionId === seccionId) ?? null;
  const yaMatriculado = opciones?.matriculas.find((m) => m.anioLectivo === anio && m.estado === "Activa");

  async function confirmar() {
    if (!hijo || !seccion || !user) return;
    setEnviando(true);
    setError("");
    try {
      const res = await crearMatricula({ alumnoId: hijo.alumnoId, seccionId: seccion.seccionId, encargadoId: Number(user.id), anioLectivo: seccion.anioLectivo });
      setResultado(res);
      await cargarOpciones(hijo.alumnoId);
      setStep(3);
    } catch (e) {
      setError(errorDe(e, "No se pudo completar la matrícula."));
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setStep(0);
    setSedeId(null);
    setGradoId(null);
    setSeccionId(null);
    setResultado(null);
  }

  const pasos = ["Alumno y ciclo", "Sede y grado", "Confirmar malla", "Listo"];

  return (
    <div className="space-y-6">
      <SectionHeader title="Matrícula" subtitle="Inscriba a sus hijos en el ciclo escolar" action={accionNuevo} />

      {(errorHijos || error) && <AlertBanner type="error" message={errorHijos || error} onClose={error ? () => setError("") : undefined} />}

      {!hijos || (cargando && !opciones) ? <Cargando filas={2} /> : (
        <>
          <Stepper steps={pasos} current={step} />

          {step === 0 && (
            <Card className="p-6 space-y-5">
              <div>
                <h3 className="font-display font-bold text-stone-900 text-lg mb-1">Alumno y ciclo escolar</h3>
                <p className="text-stone-500 text-sm">Seleccione a quién desea matricular y para qué ciclo.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Select label="Alumno" value={hijoId ?? ""} onChange={(e) => setHijoId(Number(e.target.value))}>
                  {hijos.map((h) => <option key={h.alumnoId} value={h.alumnoId}>{h.nombre}</option>)}
                </Select>
                <Select label="Ciclo escolar" value={anio ?? ""} disabled={anios.length === 0}
                  onChange={(e) => { setAnio(Number(e.target.value)); setSedeId(null); setGradoId(null); setSeccionId(null); }}>
                  {anios.length === 0 && <option value="">Sin ciclos abiertos</option>}
                  {anios.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>

              {hijo && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-sm">
                  <p className="text-stone-500 mb-1">Inscripción actual</p>
                  <p className="font-semibold text-stone-900 text-[15px]">{hijo.grado} sección {hijo.seccion} · {hijo.sede} · Ciclo {hijo.anioLectivo}</p>
                </div>
              )}

              {opciones && opciones.matriculas.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-stone-700 mb-2">Historial de matrículas</p>
                  <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
                    {opciones.matriculas.map((m) => (
                      <div key={m.matriculaId} className="flex items-center justify-between px-4 py-2.5 text-sm">
                        <span className="text-stone-700"><span className="font-mono-data">{m.anioLectivo}</span> · {m.grado} {m.seccion} · {m.sede}</span>
                        <Badge variant={m.estado === "Activa" ? "success" : "neutral"}>{m.estado}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {opciones && !opciones.puedeMatricular && (
                <AlertBanner type="warning" message="Solo el contacto principal o el responsable de pagos del alumno puede matricularlo. Comuníquese con la administración si necesita hacerlo." />
              )}
              {yaMatriculado && (
                <AlertBanner type="info" message={`${hijo?.nombre.split(" ")[0]} ya está matriculado en ${yaMatriculado.anioLectivo} (${yaMatriculado.grado} ${yaMatriculado.seccion}, ${yaMatriculado.sede}). Para cambiar de sección solicite un traslado en la administración.`} />
              )}
              {opciones && anios.length === 0 && (
                <AlertBanner type="info" message="Aún no hay secciones abiertas para inscripción. Vuelva a intentarlo cuando la sede publique el nuevo ciclo." />
              )}

              <div className="flex justify-end">
                <Btn variant="primary" disabled={!opciones?.puedeMatricular || !!yaMatriculado || anio === null} onClick={() => setStep(1)}>
                  Continuar <ChevronRight className="w-4 h-4" />
                </Btn>
              </div>
            </Card>
          )}

          {step === 1 && (
            <Card className="p-6">
              <h3 className="font-display font-bold text-stone-900 text-lg mb-1">Sede y grado</h3>
              <p className="text-stone-500 text-sm mb-5">Los cursos se asignan automáticamente según la malla del grado.</p>
              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-sm font-medium text-stone-700 block mb-2">Sede</label>
                  <div className="space-y-2">
                    {sedes.map((s) => (
                      <button key={s.sedeId} onClick={() => { setSedeId(s.sedeId); setGradoId(null); setSeccionId(null); }}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer text-left
                          ${sedeId === s.sedeId ? "border-primary-700 bg-primary-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${sedeId === s.sedeId ? "border-primary-700" : "border-stone-300"}`}>
                          {sedeId === s.sedeId && <div className="w-2 h-2 rounded-full bg-primary-700" />}
                        </div>
                        <School className="w-4 h-4 text-stone-400" />
                        <span className="text-sm font-medium text-stone-800">{s.nombre}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Select label="Grado" value={gradoId ?? ""} disabled={sedeId === null}
                    onChange={(e) => { setGradoId(Number(e.target.value) || null); setSeccionId(null); }}>
                    <option value="">Seleccione…</option>
                    {grados.map((g) => <option key={g.gradoId} value={g.gradoId}>{g.nombre} — {g.nivel}</option>)}
                  </Select>
                  <Select label="Sección" value={seccionId ?? ""} disabled={gradoId === null}
                    onChange={(e) => setSeccionId(Number(e.target.value) || null)}>
                    <option value="">Seleccione…</option>
                    {seccionesGrado.map((s) => <option key={s.seccionId} value={s.seccionId}>Sección {s.nombre} ({s.alumnos} alumnos)</option>)}
                  </Select>
                </div>
              </div>
              <div className="flex justify-between">
                <Btn variant="ghost" onClick={() => setStep(0)}>← Volver</Btn>
                <Btn variant="primary" disabled={!seccion} onClick={() => setStep(2)}>Continuar <ChevronRight className="w-4 h-4" /></Btn>
              </div>
            </Card>
          )}

          {step === 2 && seccion && hijo && (
            <Card className="p-6">
              <h3 className="font-display font-bold text-stone-900 text-lg mb-1">Malla curricular de {seccion.grado.nombre}</h3>
              <p className="text-stone-500 text-sm mb-5">El alumno quedará inscrito en los siguientes cursos. No se pueden seleccionar cursos individuales.</p>
              {seccion.cursos.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                  {seccion.cursos.map((c) => (
                    <div key={c} className="flex items-center gap-2.5 px-3 py-2.5 bg-primary-50 border border-primary-100 rounded-xl">
                      <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0" />
                      <span className="text-sm font-medium text-primary-900">{c}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-500 mb-5">La sede aún no ha publicado los cursos de este grado.</p>
              )}
              <AlertBanner type="info" message={`Confirma la inscripción de ${hijo.nombre} en ${seccion.grado.nombre} sección ${seccion.nombre} — ${seccion.sede.nombre}, ciclo ${seccion.anioLectivo}. Las colegiaturas se pagan mes a mes desde la sección Pagos.`} />
              <div className="flex justify-between mt-4">
                <Btn variant="ghost" onClick={() => setStep(1)}>← Volver</Btn>
                <Btn variant="primary" loading={enviando} onClick={confirmar}>Confirmar matrícula</Btn>
              </div>
            </Card>
          )}

          {step === 3 && resultado && (
            <Card className="p-6">
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-success-600" />
                </div>
                <h3 className="font-display text-2xl font-bold text-success-800 mb-2">¡Matrícula completada!</h3>
                <p className="text-stone-600 mb-6">{resultado.message}</p>
                {resultado.data.cursosAsignados.length > 0 && (
                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left text-sm mb-6 max-w-md mx-auto">
                    <p className="font-medium text-stone-700 mb-2">Cursos asignados</p>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-stone-600">
                      {resultado.data.cursosAsignados.map((c) => <li key={c.cursoSeccionId}>• {c.nombre}</li>)}
                    </ul>
                  </div>
                )}
                <Btn variant="outline" onClick={reiniciar}>Volver al inicio</Btn>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Notas ───────────────────────────────────────────────────────────────────

function NotasHijo() {
  const { hijos: todos, error: errorHijos } = useHijosEncargado();
  const hijos = todos?.filter((h) => h.puedeVerNotas) ?? null;
  const [hijoId, setHijoId] = useState<number | null>(null);
  const [boletin, setBoletin] = useState<BoletinHijoDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hijos && hijoId === null && hijos.length) setHijoId(hijos[0].alumnoId);
  }, [hijos, hijoId]);

  useEffect(() => {
    if (hijoId === null) return;
    let cancelado = false;
    setCargando(true);
    setError("");
    getBoletinHijo(hijoId)
      .then((b) => { if (!cancelado) setBoletin(b); })
      .catch((e) => { if (!cancelado) setError(errorDe(e, "No se pudieron cargar las notas.")); })
      .finally(() => { if (!cancelado) setCargando(false); });
    return () => { cancelado = true; };
  }, [hijoId]);

  if (hijos && hijos.length === 0) return <SinHijos title="Notas y Reportes" />;

  const minimo = boletin?.notaAprobacion ?? 61;
  const romanos = ["I", "II", "III", "IV"];

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SectionHeader title="Notas y Reportes"
          subtitle={boletin ? `${boletin.nombre} · ${boletin.grado} ${boletin.seccion} · Ciclo ${boletin.anioLectivo}` : undefined} />
        <div className="flex items-center gap-3 sm:ml-auto flex-wrap">
          {hijos && <SelectorHijo hijos={hijos} value={hijoId} onChange={setHijoId} />}
          <Btn variant="outline" size="sm" icon={<Download className="w-4 h-4" />} disabled={!boletin || boletin.cursos.length === 0}
            onClick={() => boletin && generarBoletinPdf(boletin)}>
            Descargar PDF
          </Btn>
        </div>
      </div>

      {(errorHijos || error) && <AlertBanner type="error" message={errorHijos || error} />}

      {!hijos || (cargando && !boletin) ? <Cargando filas={3} /> : boletin && (
        boletin.cursos.length === 0 ? (
          <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados" description="La sección del alumno todavía no tiene cursos registrados." />
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <MetricCard label="Promedio general" value={boletin.promedioGeneral !== null ? Math.round(boletin.promedioGeneral) : "—"}
                variant={boletin.promedioGeneral === null ? "default" : boletin.promedioGeneral >= minimo ? "success" : "danger"}
                sub={`Mínimo para aprobar: ${minimo}`} />
              <MetricCard label="Cursos aprobados" value={`${boletin.cursosAprobados}/${boletin.cursosEvaluados}`} sub="De los cursos ya evaluados" variant="success" />
              <MetricCard label="Cursos en riesgo" value={boletin.cursosEvaluados - boletin.cursosAprobados}
                sub="Promedio por debajo del mínimo" variant={boletin.cursosEvaluados - boletin.cursosAprobados > 0 ? "danger" : "default"} />
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-3">
              {boletin.cursos.map((c) => (
                <Card key={c.cursoSeccionId} className="p-4">
                  <div className="flex justify-between items-start gap-3 mb-4">
                    <div className="flex items-start gap-3 min-w-0">
                    <CursoMarca nombre={c.curso} />
                    <div className="min-w-0">
                      <p className="font-display font-bold text-[17px] leading-tight text-stone-900">{c.curso}</p>
                      <p className="text-xs text-stone-500">{c.catedratico}</p>
                      {c.seccionAnterior && <Badge variant="neutral" className="mt-1">Sección anterior: {c.seccionAnterior}</Badge>}
                    </div>
                    </div>
                    {c.aprobado !== null && <EstadoBadge aprobado={c.aprobado} />}
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    {c.unidades.map((u) => (
                      <div key={u.numero} className="text-center">
                        <p className="text-xs font-semibold text-stone-500 mb-1.5">Unidad {u.numero}</p>
                        <span className={`block font-display font-bold text-lg tabular-nums py-1.5 rounded-xl ${u.nota === null ? "border-[1.5px] border-dashed border-stone-200 text-stone-300" : u.nota >= minimo ? "bg-sand-100 text-stone-900" : "bg-danger-50 text-danger-700"}`}>{u.nota !== null ? Math.round(u.nota) : "—"}</span>
                      </div>
                    ))}
                  </div>
                  {c.promedio !== null && (
                    <div className="flex items-baseline justify-between text-sm border-t border-stone-100 pt-3 mt-3">
                      <span className="font-semibold text-stone-600">Promedio</span>
                      <span className={`font-display font-bold text-2xl tabular-nums ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            {/* Desktop table */}
            <Card className="hidden md:block overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <TH>Curso</TH>
                      {romanos.map((r) => <TH key={r} className="text-center">{r} Unidad</TH>)}
                      <TH className="text-center">Promedio</TH>
                      <TH className="text-center">Estado</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {boletin.cursos.map((c) => (
                      <tr key={c.cursoSeccionId} className="hover:bg-sand-50 transition-colors">
                        <TD>
                          <div className="flex items-center gap-3">
                            <CursoMarca nombre={c.curso} size="sm" />
                            <div className="min-w-0">
                              <p className="font-bold text-stone-900">{c.curso}</p>
                              <p className="text-[13px] text-stone-500">{c.catedratico}</p>
                            </div>
                            {c.seccionAnterior && <Badge variant="neutral">Sección anterior: {c.seccionAnterior}</Badge>}
                          </div>
                        </TD>
                        {c.unidades.map((u) => (
                          <TD key={u.numero} className="text-center">
                            {u.nota !== null ? (
                              <span title={`Zona ${u.zona ?? 0} + Examen ${u.examen ?? 0}`}
                                className={`inline-flex items-center justify-center min-w-11 h-9 px-2 font-display font-bold text-base tabular-nums rounded-xl
                                  ${u.nota >= minimo ? "bg-sand-100 text-stone-900" : "bg-danger-50 text-danger-700"}`}
                                aria-label={u.nota >= minimo ? `${u.nota}, aprobado` : `${u.nota}, reprobado`}>
                                {Math.round(u.nota)}
                              </span>
                            ) : <span className="text-stone-300 font-mono-data">—</span>}
                          </TD>
                        ))}
                        <TD className="text-center">
                          {c.promedio !== null
                            ? <span className={`font-display font-bold text-2xl tabular-nums ${colorNota(c.promedio, minimo)}`}>{Math.round(c.promedio)}</span>
                            : "—"}
                        </TD>
                        <TD className="text-center">
                          {c.aprobado !== null ? <EstadoBadge aprobado={c.aprobado} /> : <span className="text-xs text-stone-400">Pendiente</span>}
                        </TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
            <p className="text-xs text-stone-500">Cada unidad se califica sobre 100 puntos (zona + examen). El promedio considera solo las unidades ya evaluadas.</p>
          </>
        )
      )}
    </div>
  );
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

type EstadoMesUi = "pagado" | "pendiente" | "vencido" | "reembolsado" | "becado" | "procesando";

/**
 * El backend solo sabe si hay pago o no; "vencido" se calcula aquí: un mes
 * sin pagar cuyo periodo ya pasó. "becado" es un mes que la beca cubre al
 * 100%: no hay nada que cobrar (el backend rechaza un pago de Q0.00).
 */
function estadoMesUi(m: MesEstadoCuentaDto, anio: number): EstadoMesUi {
  if (m.estado === "Pagado") return "pagado";
  if (m.estado === "Reembolsado") return "reembolsado";
  if (m.estado === "Exonerado" || m.montoAPagar <= 0) return "becado";
  const hoy = new Date();
  const mesActual = anio < hoy.getFullYear() ? 13 : anio > hoy.getFullYear() ? 0 : hoy.getMonth() + 1;
  return m.mes < mesActual ? "vencido" : "pendiente";
}

function PagosView() {
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;

  const [hijos, setHijos] = useState<HijoDto[] | null>(null);
  const [hijoId, setHijoId] = useState<number | null>(null);
  const [estadoCuenta, setEstadoCuenta] = useState<EstadoCuentaDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<{ alumnoId: number; anioLectivo: number; mes: number } | null>(null);
  const [mesPagado, setMesPagado] = useState<string | null>(null);
  // Meses cuyo cobro el banco sigue procesando. El backend los tiene como
  // "Pendiente" hasta que llegue el webhook, así que sin esto se volvería a
  // ofrecer "Pagar" (y el backend respondería 409).
  const [enProceso, setEnProceso] = useState<Set<string>>(new Set());
  const carrito = useCarrito();

  useEffect(() => {
    getMisHijos()
      .then((data) => {
        setHijos(data);
        setHijoId(data[0]?.alumnoId ?? null);
        if (data.length === 0) setCargando(false);
      })
      .catch((e: Error) => { setError(e.message); setCargando(false); });
  }, []);

  const cargarEstadoCuenta = useCallback(async (alumnoId: number) => {
    setCargando(true);
    setError(null);
    try {
      setEstadoCuenta(await getEstadoCuenta(alumnoId, anio));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCargando(false);
    }
  }, [anio]);

  useEffect(() => {
    if (hijoId !== null) cargarEstadoCuenta(hijoId);
  }, [hijoId, cargarEstadoCuenta]);

  const hijo = hijos?.find((h) => h.alumnoId === hijoId) ?? null;

  if (hijos && hijos.length === 0) {
    return (
      <div className="space-y-5">
        <SectionHeader title="Pagos y Estado de Cuenta" />
        <EmptyState icon={<User className="w-10 h-10" />} title="Sin alumnos asociados" description="Su cuenta no tiene alumnos a cargo. Comuníquese con la administración del colegio." />
      </div>
    );
  }

  const claveMes = (alumnoId: number, mes: number) => `${alumnoId}-${anio}-${mes}`;
  const meses = estadoCuenta?.detalle.map((m) => {
    const ui = estadoMesUi(m, anio);
    const procesando = hijoId !== null && ui !== "pagado" && enProceso.has(claveMes(hijoId, m.mes));
    return { ...m, ui: procesando ? "procesando" as const : ui };
  }) ?? [];
  const adeudados = meses.filter((m) => m.ui === "vencido");
  const saldoVencido = adeudados.reduce((suma, m) => suma + m.montoAPagar, 0);
  // Lo primero que se le ofrece pagar: el mes vencido más antiguo, o el del mes en curso
  const siguiente = adeudados[0] ?? meses.find((m) => m.ui === "pendiente" && m.mes === mesActual);
  const mensualidad = meses.find((m) => m.mes === Math.min(mesActual, 10));

  function pagar(mes: number) {
    if (hijoId === null) return;
    setMesPagado(null);
    setPeriodo({ alumnoId: hijoId, anioLectivo: anio, mes });
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Pagos y Estado de Cuenta"
        subtitle={hijo ? `${hijo.nombre} · ${hijo.grado} sección ${hijo.seccion}` : undefined}
        action={
          <div className="flex items-center gap-2">
            {hijos && hijos.length > 1 && (
              <Select aria-label="Alumno" value={hijoId ?? ""} onChange={(e) => setHijoId(Number(e.target.value))}>
                {hijos.map((h) => <option key={h.alumnoId} value={h.alumnoId}>{h.nombre}</option>)}
              </Select>
            )}
            <CarritoBoton onPagado={() => { if (hijoId !== null) cargarEstadoCuenta(hijoId); }} />
          </div>
        }
      />

      {mesPagado && (
        <AlertBanner type="success" title="Pago realizado exitosamente" message={`La colegiatura de ${mesPagado} quedó registrada como pagada.`} onClose={() => setMesPagado(null)} />
      )}

      {error && (
        <AlertBanner type="error" title="No se pudo cargar el estado de cuenta" message={error} />
      )}

      {cargando && !estadoCuenta ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}
        </div>
      ) : estadoCuenta && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricCard
              label="Saldo vencido"
              value={formatoQ(saldoVencido)}
              sub={adeudados.length > 0 ? `${adeudados.length} ${adeudados.length === 1 ? "cuota vencida" : "cuotas vencidas"}` : "Al día"}
              variant={saldoVencido > 0 ? "danger" : "success"}
            />
            <MetricCard
              label="Mensualidad"
              value={mensualidad ? formatoQ(mensualidad.montoAPagar) : "—"}
              sub={mensualidad && mensualidad.descuentoPorcentaje > 0
                ? `Beca ${mensualidad.descuentoPorcentaje}% aplicada (−${formatoQ(mensualidad.montoBase - mensualidad.montoAPagar)})`
                : "Sin beca"}
            />
            <MetricCard
              label={`Pagado en ${anio}`}
              value={formatoQ(estadoCuenta.totalPagado)}
              sub={`${estadoCuenta.mesesPagados} de 10 meses`}
              variant="success"
            />
          </div>

          {siguiente && (
            <div className={`relative overflow-hidden rounded-[20px] p-6 ${siguiente.ui === "vencido" ? "bg-danger-600 text-white" : "bg-subject-social text-stone-900"}`}>
              <div className="absolute right-0 top-0 bottom-0 w-40 opacity-20 textile-pattern" aria-hidden="true" />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                <div>
                  <p className="text-sm font-semibold opacity-85 flex items-center gap-1.5">
                    {siguiente.ui === "vencido" ? <AlertCircle className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                    {siguiente.ui === "vencido" ? "Cuota vencida" : "Cuota del mes"}: {siguiente.nombreMes} {anio}
                  </p>
                  <p className="font-display font-bold text-5xl leading-none tabular-nums mt-3">{formatoQ(siguiente.montoAPagar)}</p>
                </div>
                <button
                  onClick={() => pagar(siguiente.mes)}
                  className={`inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-bold text-[15px] transition-transform active:scale-[0.98] cursor-pointer
                    ${siguiente.ui === "vencido" ? "bg-white text-danger-700 hover:bg-danger-50" : "bg-stone-900 text-white hover:bg-stone-800"}`}
                >
                  <CreditCard className="w-5 h-5" />
                  Pagar ahora
                </button>
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-1">
              <h3 className="font-display font-bold text-lg text-stone-900">Colegiaturas del ciclo {anio}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr><TH>Mes</TH><TH className="text-right">Mensualidad</TH><TH className="text-right">Beca</TH><TH className="text-right">Total</TH><TH>Estado</TH><TH>Fecha de pago</TH><TH className="text-right">Acciones</TH></tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {meses.map((m) => {
                    const total = m.ui === "pagado" && m.monto !== null ? m.monto : m.montoAPagar;
                    return (
                      <tr key={m.mes} className="hover:bg-sand-50 transition-colors">
                        <TD><span className="font-semibold text-stone-900">{m.nombreMes}</span></TD>
                        <TD className="text-right"><span className="font-mono-data text-stone-700">{formatoQ(m.montoBase)}</span></TD>
                        <TD className="text-right">
                          {m.montoBase - total > 0
                            ? <span className="font-mono-data text-success-700">−{formatoQ(m.montoBase - total)}</span>
                            : <span className="text-stone-400">—</span>}
                        </TD>
                        <TD className="text-right"><span className="font-display font-bold tabular-nums text-stone-900">{formatoQ(total)}</span></TD>
                        <TD>
                          {m.ui === "reembolsado" ? <Badge variant="info">Reembolsado</Badge>
                            : m.ui === "becado" ? <Badge variant="success">Cubierto por beca</Badge>
                            : m.ui === "procesando" ? <Badge variant="warning">En proceso</Badge>
                            : <PagoBadge estado={m.ui} />}
                        </TD>
                        <TD>
                          <span className="text-[13px] text-stone-500 tabular-nums">
                            {m.fechaPago ? new Date(m.fechaPago).toLocaleDateString("es-GT") : "—"}
                          </span>
                        </TD>
                        <TD className="text-right">
                          {m.ui === "pagado" || m.ui === "reembolsado" || m.ui === "becado" || m.ui === "procesando" || !hijo ? null : (
                            <div className="flex items-center justify-end gap-1.5">
                              {carrito.contiene(claveColegiatura(hijo.alumnoId, anio, m.mes)) ? (
                                <Btn variant="ghost" size="sm" onClick={() => carrito.quitar(claveColegiatura(hijo.alumnoId, anio, m.mes))} aria-label={`Quitar ${m.nombreMes} del carrito`}>
                                  <ShoppingCart className="w-4 h-4 text-primary-700" />Quitar
                                </Btn>
                              ) : (
                                <Btn
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Agregar ${m.nombreMes} al carrito`}
                                  title="Agregar al carrito"
                                  onClick={() => carrito.agregar({
                                    clave: claveColegiatura(hijo.alumnoId, anio, m.mes),
                                    tipo: "colegiatura",
                                    alumnoId: hijo.alumnoId,
                                    anioLectivo: anio,
                                    mes: m.mes,
                                    alumno: hijo.nombre,
                                    descripcion: `Colegiatura ${m.nombreMes} ${anio}`,
                                    monto: m.montoAPagar,
                                  })}
                                >
                                  <ShoppingCart className="w-4 h-4" />
                                </Btn>
                              )}
                              <Btn
                                variant={m.ui === "vencido" ? "secondary" : "outline"}
                                size="sm"
                                onClick={() => pagar(m.mes)}
                              >
                                {m.mes > mesActual ? "Adelantar" : "Pagar"}
                              </Btn>
                            </div>
                          )}
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      <PagoColegiaturaModal
        periodo={periodo}
        onClose={() => setPeriodo(null)}
        onTerminado={(tipo) => {
          if (periodo && tipo === "exitoso") setMesPagado(`${MESES_NOMBRE[periodo.mes - 1]} ${periodo.anioLectivo}`);
          if (periodo) carrito.quitar(claveColegiatura(periodo.alumnoId, periodo.anioLectivo, periodo.mes));
          if (periodo && tipo === "procesando") {
            setEnProceso((prev) => new Set(prev).add(claveMes(periodo.alumnoId, periodo.mes)));
          }
          if (hijoId !== null) cargarEstadoCuenta(hijoId);
        }}
      />
    </div>
  );
}

const MESES_NOMBRE = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

function EstadoMesBadge({ estado }: { estado: EstadoMesUi }) {
  if (estado === "reembolsado") return <Badge variant="info">Reembolsado</Badge>;
  if (estado === "becado") return <Badge variant="success">Cubierto por beca</Badge>;
  if (estado === "procesando") return <Badge variant="warning">En proceso</Badge>;
  return <PagoBadge estado={estado} />;
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

const passwordVacio = { actual: "", nueva: "", confirmar: "" };

function Permiso({ activo, children }: { activo: boolean; children: ReactNode }) {
  return <Badge variant={activo ? "success" : "neutral"}>{children}</Badge>;
}

function PerfilView({ user }: { user?: AppUser }) {
  const { hijos, setHijos, error: errorHijos } = useHijosEncargado();
  const [aviso, setAviso] = useState<{ tipo: "success" | "error"; texto: string } | null>(null);
  const [guardandoId, setGuardandoId] = useState<number | null>(null);

  const [pass, setPass] = useState(passwordVacio);
  const [passError, setPassError] = useState("");
  const [passOk, setPassOk] = useState("");
  const [guardandoPass, setGuardandoPass] = useState(false);

  // Contraseña del portal de un hijo (los alumnos sin correo propio no pueden recuperarla solos)
  const [passHijo, setPassHijo] = useState<HijoEncargadoDto | null>(null);
  const [nuevaHijo, setNuevaHijo] = useState({ nueva: "", confirmar: "" });
  const [errorHijo, setErrorHijo] = useState("");
  const [guardandoHijo, setGuardandoHijo] = useState(false);
  const [saludHijo, setSaludHijoAbierto] = useState<HijoEncargadoDto | null>(null);

  async function guardarSaludHijo(datos: DatosSaludDto) {
    if (!saludHijo) return;
    const res = await setSaludHijo(saludHijo.alumnoId, datos);
    setHijos((prev) => prev?.map((h) => (h.alumnoId === saludHijo.alumnoId ? { ...h, ...datos } : h)) ?? prev);
    setAviso({ tipo: "success", texto: `${saludHijo.nombre.split(" ")[0]}: ${res.message}` });
  }

  function abrirPassHijo(h: HijoEncargadoDto) {
    setPassHijo(h);
    setNuevaHijo({ nueva: "", confirmar: "" });
    setErrorHijo("");
  }

  async function guardarPassHijo() {
    if (!passHijo) return;
    if (nuevaHijo.nueva.length < 8) return setErrorHijo("La contraseña debe tener al menos 8 caracteres.");
    if (nuevaHijo.nueva !== nuevaHijo.confirmar) return setErrorHijo("La confirmación no coincide.");
    setGuardandoHijo(true);
    setErrorHijo("");
    try {
      const res = await restablecerPasswordHijo(passHijo.alumnoId, nuevaHijo.nueva);
      setAviso({ tipo: "success", texto: `${passHijo.nombre.split(" ")[0]}: ${res.message}` });
      setPassHijo(null);
    } catch (e) {
      setErrorHijo(errorDe(e, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardandoHijo(false);
    }
  }

  async function cambiarNotificaciones(hijo: HijoEncargadoDto, valor: boolean) {
    setGuardandoId(hijo.alumnoId);
    setAviso(null);
    try {
      const res = await setNotificacionesHijo(hijo.alumnoId, valor);
      setHijos((prev) => prev?.map((h) => (h.alumnoId === hijo.alumnoId ? { ...h, recibeNotificaciones: valor } : h)) ?? prev);
      setAviso({ tipo: "success", texto: `${hijo.nombre.split(" ")[0]}: ${res.message}` });
    } catch (e) {
      setAviso({ tipo: "error", texto: errorDe(e, "No se pudo guardar la preferencia.") });
    } finally {
      setGuardandoId(null);
    }
  }

  async function guardarPassword() {
    setPassError("");
    setPassOk("");
    if (!pass.actual || !pass.nueva) return setPassError("Complete la contraseña actual y la nueva.");
    if (pass.nueva.length < 8) return setPassError("La nueva contraseña debe tener al menos 8 caracteres.");
    if (pass.nueva !== pass.confirmar) return setPassError("La confirmación no coincide con la nueva contraseña.");
    setGuardandoPass(true);
    try {
      const res = await cambiarPassword(pass.actual, pass.nueva);
      setPassOk(res.message);
      setPass(passwordVacio);
    } catch (e) {
      setPassError(errorDe(e, "No se pudo cambiar la contraseña."));
    } finally {
      setGuardandoPass(false);
    }
  }

  const datos: [string, string | undefined][] = [
    ["Nombre completo", user?.name],
    ["Correo electrónico", user?.email],
    ["Rol", user?.roleName ?? "Encargado"],
    ["Sede", user?.sede],
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Perfil y Preferencias" subtitle="Sus datos, sus alumnos a cargo y las notificaciones que recibe" />

      {errorHijos && <AlertBanner type="error" message={errorHijos} />}
      {aviso && <AlertBanner type={aviso.tipo} message={aviso.texto} onClose={() => setAviso(null)} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <h3 className="font-display font-bold text-stone-900 mb-4">Datos personales</h3>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-[22px] rotate-[-3deg] bg-subject-social flex items-center justify-center text-stone-900 font-display font-extrabold text-2xl">{user?.initials}</div>
            <div>
              <p className="font-semibold text-stone-900">{user?.name}</p>
              <p className="text-sm text-stone-500">{user?.email}</p>
              <p className="text-xs text-stone-400 mt-0.5">Padre / Encargado</p>
            </div>
          </div>
          <dl className="space-y-3">
            {datos.filter(([, v]) => v).map(([k, v]) => (
              <div key={k}>
                <dt className="text-[13px] font-semibold text-stone-500">{k}</dt>
                <dd className="text-sm text-stone-900">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-stone-400 mt-4">Si algún dato es incorrecto, solicite la corrección a la administración de la sede.</p>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-bold text-lg text-stone-900 mb-1 flex items-center gap-2"><KeyRound className="w-[18px] h-[18px] text-action-500" />Cambiar contraseña</h3>
          <p className="text-sm text-stone-500 mb-4">Use al menos 8 caracteres.</p>
          <div className="space-y-3">
            <Input label="Contraseña actual" type="password" autoComplete="current-password" value={pass.actual}
              onChange={(e) => setPass((p) => ({ ...p, actual: e.target.value }))} />
            <Input label="Nueva contraseña" type="password" autoComplete="new-password" value={pass.nueva}
              onChange={(e) => setPass((p) => ({ ...p, nueva: e.target.value }))} />
            <Input label="Confirmar nueva contraseña" type="password" autoComplete="new-password" value={pass.confirmar}
              onChange={(e) => setPass((p) => ({ ...p, confirmar: e.target.value }))} />
          </div>
          {passError && <div className="mt-3"><AlertBanner type="error" message={passError} /></div>}
          {passOk && <div className="mt-3"><AlertBanner type="success" message={passOk} /></div>}
          <div className="flex justify-end mt-4">
            <Btn variant="primary" size="sm" loading={guardandoPass} onClick={guardarPassword}>Actualizar contraseña</Btn>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="font-display font-bold text-lg text-stone-900 mb-1 flex items-center gap-2"><Bell className="w-[18px] h-[18px] text-action-500" />Alumnos a cargo y notificaciones</h3>
        <p className="text-sm text-stone-500 mb-4">
          Elija de qué alumnos desea recibir avisos por correo (notas, ausencias, conducta y comunicados). Los permisos de su vínculo los administra la sede.
        </p>
        {!hijos ? <div className="h-24 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" /> : hijos.length === 0 ? (
          <p className="text-sm text-stone-500">Su cuenta no tiene alumnos a cargo.</p>
        ) : (
          <div className="divide-y divide-stone-100">
            {hijos.map((h) => (
              <div key={h.alumnoId} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-subject-social text-stone-900 font-display font-extrabold text-lg flex items-center justify-center shrink-0">
                    {h.nombre.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-[15px] text-stone-900">{h.nombre}</p>
                    <p className="text-xs text-stone-500">
                      {h.grado} sección {h.seccion} · {h.sede}{h.parentesco ? ` · ${h.parentesco}` : ""}
                      {h.vigenteHasta ? ` · Vínculo vigente hasta ${new Date(h.vigenteHasta + "T00:00:00").toLocaleDateString("es-GT")}` : ""}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {h.esPrincipal && <Badge variant="primary"><ShieldCheck className="w-3 h-3" />Contacto principal</Badge>}
                      {h.responsableFinanciero && <Badge variant="primary"><CreditCard className="w-3 h-3" />Responsable de pagos</Badge>}
                      <Permiso activo={h.puedeVerNotas}>Notas</Permiso>
                      <Permiso activo={h.puedeVerPagos}>Pagos</Permiso>
                      <Permiso activo={h.autorizadoRecoger}>Autorizado a recoger</Permiso>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-stone-600">
                      <span className="flex items-center gap-1">
                        <Laptop className="w-3.5 h-3.5 text-stone-400" />
                        {h.accesoPortal
                          ? <>Entra al portal con <span className="font-mono-data text-stone-800">{h.usuarioPortal}</span></>
                          : h.accesoPorNivel ? "La sede deshabilitó su acceso al portal" : "Sin acceso al portal por su nivel (usted consulta su información)"}
                      </span>
                      {h.accesoPortal && (h.esPrincipal || h.responsableFinanciero) && (
                        <button onClick={() => abrirPassHijo(h)} className="text-primary-700 hover:underline font-medium cursor-pointer">
                          Asignar contraseña
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-stone-600">
                      <span className="flex items-center gap-1">
                        <Heart className={`w-3.5 h-3.5 ${tieneSalud(h) ? "text-danger-600" : "text-stone-400"}`} />
                        {tieneSalud(h) ? "Tiene información de salud registrada" : "Sin información de salud registrada"}
                      </span>
                      <button onClick={() => setSaludHijoAbierto(h)} className="text-primary-700 hover:underline font-medium cursor-pointer">
                        {h.esPrincipal || h.responsableFinanciero ? (tieneSalud(h) ? "Ver o actualizar" : "Agregar") : "Ver"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className={`shrink-0 ${guardandoId === h.alumnoId ? "opacity-50 pointer-events-none" : ""}`}>
                  <Toggle checked={h.recibeNotificaciones} onChange={(v) => cambiarNotificaciones(h, v)}
                    label={h.recibeNotificaciones ? "Recibe correos" : "Sin correos"} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <ModalSalud alumno={saludHijo?.nombre ?? null} salud={saludHijo ?? {}} onCerrar={() => setSaludHijoAbierto(null)}
        onGuardar={saludHijo && (saludHijo.esPrincipal || saludHijo.responsableFinanciero) ? guardarSaludHijo : undefined} />

      <Modal open={!!passHijo} onClose={() => !guardandoHijo && setPassHijo(null)} title={`Contraseña de ${passHijo?.nombre.split(" ")[0] ?? ""}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setPassHijo(null)} disabled={guardandoHijo}>Cancelar</Btn>
          <Btn variant="primary" loading={guardandoHijo} onClick={guardarPassHijo}>Guardar</Btn>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-stone-600">
            Usuario: <span className="font-mono-data text-stone-900">{passHijo?.usuarioPortal}</span>. Entréguele la nueva contraseña al alumno; la anterior deja de funcionar.
          </p>
          <Input label="Nueva contraseña" type="password" autoComplete="new-password" value={nuevaHijo.nueva}
            onChange={(e) => setNuevaHijo((p) => ({ ...p, nueva: e.target.value }))} />
          <Input label="Confirmar contraseña" type="password" autoComplete="new-password" value={nuevaHijo.confirmar}
            onChange={(e) => setNuevaHijo((p) => ({ ...p, confirmar: e.target.value }))} />
          {errorHijo && <AlertBanner type="error" message={errorHijo} />}
        </div>
      </Modal>
    </div>
  );
}

export default function Padre({ view, user, onNavigate }: { view: View; user?: AppUser; onNavigate?: (v: View) => void }) {
  if (view === "pad-matricula") return <MatriculaView user={user} />;
  if (view === "pad-notas") return <NotasHijo />;
  if (view === "pad-pagos") return <PagosView />;
  if (view === "pad-eventos") return <EventosPadre />;
  if (view === "pad-becas") return <BecasPadre />;
  if (view === "pad-avisos") return <AvisosPadre />;
  if (view === "pad-asistencia") return <AsistenciaPadre />;
  if (view === "pad-horario") return <HorarioHijo />;
  if (view === "pad-calendario") return <CalendarioEventos subtitle="Eventos de las sedes de sus hijos y eventos generales" />;
  if (view === "pad-perfil") return <PerfilView user={user} />;
  return <DashboardPadre user={user} onNavigate={onNavigate} />;
}

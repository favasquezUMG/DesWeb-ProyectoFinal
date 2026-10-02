import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus, Edit, Ban, History, PauseCircle, PlayCircle, RefreshCw, ClipboardCheck, Check, X, Award, Inbox, Wallet, Receipt,
} from "lucide-react";
import {
  Card, SectionHeader, Btn, Badge, TH, TD, AlertBanner, Modal, Drawer, Tabs, MetricCard, Select, Input, Textarea,
} from "../../components/Ui";
import HistorialBeca from "../../components/HistorialBeca";
import ProgramasBeca from "./becas/ProgramasBeca";
import PoliticaBecas from "./becas/PoliticaBecas";
import {
  getBecas,
  getBecaById,
  getAlumnos,
  getProgramasBeca,
  getResumenBecas,
  createBeca,
  updateBeca,
  cambiarEstadoBeca,
  renovarBeca,
  evaluarBecas,
  type AlumnoDto,
  type BecaDto,
  type EstadoBeca,
  type ProgramaBecaDto,
  type ResumenBecasDto,
} from "../../lib/api";
import { ESTADO_BECA_BADGE, formatFecha, formatQ, nombreDe } from "../../lib/becas";

const ANIO_ACTUAL = new Date().getFullYear();
const ANIOS = [ANIO_ACTUAL - 1, ANIO_ACTUAL, ANIO_ACTUAL + 1];

const FILTROS: { label: string; estados: string }[] = [
  { label: "Vigentes", estados: "Activa,Suspendida" },
  { label: "Activas", estados: "Activa" },
  { label: "Suspendidas", estados: "Suspendida" },
  { label: "Finalizadas", estados: "Finalizada" },
  { label: "Revocadas / rechazadas", estados: "Revocada,Rechazada" },
  { label: "Todas", estados: "" },
];

function gradoSeccion(s: { nombre: string; grado: { nombre: string } }): string {
  return `${s.grado.nombre} "${s.nombre}"`;
}

// Acción que pide un motivo antes de ejecutarse
interface AccionEstado {
  beca: BecaDto;
  estado: EstadoBeca;
  titulo: string;
  boton: string;
  variante: "primary" | "destructive";
  motivoSugerido: string;
}

interface FormAsignar {
  alumnoId: string;
  programaId: string;
  porcentaje: string;
  descripcion: string;
}

interface FormEditar {
  porcentaje: string;
  descripcion: string;
  fechaInicio: string;
  fechaFin: string;
}

export default function BecasView() {
  const [anio, setAnio] = useState(ANIO_ACTUAL);
  const [tab, setTab] = useState("Becas");
  const [filtro, setFiltro] = useState(FILTROS[0]);

  const [becas, setBecas] = useState<BecaDto[]>([]);
  const [solicitudes, setSolicitudes] = useState<BecaDto[]>([]);
  const [programas, setProgramas] = useState<ProgramaBecaDto[]>([]);
  const [resumen, setResumen] = useState<ResumenBecasDto | null>(null);
  const [alumnos, setAlumnos] = useState<AlumnoDto[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [asignando, setAsignando] = useState(false);
  const [formAsignar, setFormAsignar] = useState<FormAsignar>({ alumnoId: "", programaId: "", porcentaje: "", descripcion: "" });
  const [editando, setEditando] = useState<BecaDto | null>(null);
  const [formEditar, setFormEditar] = useState<FormEditar>({ porcentaje: "", descripcion: "", fechaInicio: "", fechaFin: "" });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [accion, setAccion] = useState<AccionEstado | null>(null);
  const [motivo, setMotivo] = useState("");
  const [accionError, setAccionError] = useState("");

  const [historialDe, setHistorialDe] = useState<BecaDto | null>(null);
  const [evaluando, setEvaluando] = useState(false);

  const cargar = useCallback(async () => {
    const [becasData, solicitudesData, programasData, resumenData] = await Promise.all([
      getBecas({ anioLectivo: anio, estado: filtro.estados }),
      getBecas({ anioLectivo: anio, estado: "Solicitada" }),
      getProgramasBeca(anio, true),
      getResumenBecas(anio),
    ]);
    setBecas(becasData);
    setSolicitudes(solicitudesData);
    setProgramas(programasData);
    setResumen(resumenData);
  }, [anio, filtro]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([cargar(), alumnos.length ? Promise.resolve() : getAlumnos().then((a) => { if (!cancelled) setAlumnos(a); })])
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar las becas."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargar]);

  async function recargarCon(mensaje: string) {
    setSuccessMessage(mensaje);
    setError("");
    await cargar();
  }

  const colegiatura = resumen?.colegiaturaMensual ?? 0;
  const programasAbiertos = programas.filter((p) => p.activo);
  const programaElegido = programas.find((p) => String(p.programaId) === formAsignar.programaId);

  // Alumnos que ya tienen beca vigente o solicitud en el ciclo no se ofrecen para asignar
  const alumnosConBeca = useMemo(
    () => new Set([...becas.filter((b) => b.estado === "Activa" || b.estado === "Suspendida"), ...solicitudes].map((b) => b.alumnoId)),
    [becas, solicitudes]
  );

  // ---------- Asignar / editar ----------

  function abrirAsignar() {
    setEditando(null);
    setAsignando(true);
    setFormError("");
    const primero = programasAbiertos[0];
    setFormAsignar({ alumnoId: "", programaId: primero ? String(primero.programaId) : "", porcentaje: primero ? String(Number(primero.porcentaje)) : "", descripcion: "" });
  }

  function abrirEditar(b: BecaDto) {
    setAsignando(false);
    setEditando(b);
    setFormError("");
    setFormEditar({
      porcentaje: String(Number(b.porcentaje)),
      descripcion: b.descripcion ?? "",
      fechaInicio: b.fechaInicio.slice(0, 10),
      fechaFin: b.fechaFin.slice(0, 10),
    });
  }

  function cerrarFormularios() {
    setAsignando(false);
    setEditando(null);
    setFormError("");
  }

  async function guardarAsignacion() {
    if (!formAsignar.alumnoId || !formAsignar.programaId) {
      setFormError("Seleccione el alumno y el programa.");
      return;
    }
    setSubmitting(true);
    setFormError("");
    try {
      await createBeca({
        alumnoId: Number(formAsignar.alumnoId),
        programaId: Number(formAsignar.programaId),
        porcentaje: formAsignar.porcentaje ? Number(formAsignar.porcentaje) : undefined,
        descripcion: formAsignar.descripcion || undefined,
      });
      cerrarFormularios();
      await recargarCon("Beca asignada. Se notificó a los encargados del alumno.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo asignar la beca.");
    } finally {
      setSubmitting(false);
    }
  }

  async function guardarEdicion() {
    if (!editando) return;
    setSubmitting(true);
    setFormError("");
    try {
      await updateBeca(editando.becaId, {
        porcentaje: Number(formEditar.porcentaje),
        descripcion: formEditar.descripcion,
        fechaInicio: formEditar.fechaInicio,
        fechaFin: formEditar.fechaFin,
      });
      cerrarFormularios();
      await recargarCon("Beca actualizada.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la beca.");
    } finally {
      setSubmitting(false);
    }
  }

  // ---------- Cambios de estado ----------

  function pedirAccion(a: AccionEstado) {
    setAccion(a);
    setMotivo(a.motivoSugerido);
    setAccionError("");
  }

  async function confirmarAccion() {
    if (!accion) return;
    if (motivo.trim().length < 5) {
      setAccionError("Indique el motivo (mínimo 5 caracteres). Se enviará al encargado.");
      return;
    }
    setSubmitting(true);
    setAccionError("");
    try {
      const res = await cambiarEstadoBeca(accion.beca.becaId, accion.estado, motivo.trim());
      setAccion(null);
      await recargarCon(`${res.message} ${nombreDe(accion.beca.alumno.usuario)}.`);
    } catch (err) {
      setAccionError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setSubmitting(false);
    }
  }

  async function renovar(b: BecaDto) {
    setError("");
    try {
      const nueva = await renovarBeca(b.becaId);
      await recargarCon(`Beca de ${nombreDe(b.alumno.usuario)} renovada para ${nueva.anioLectivo}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo renovar la beca.");
    }
  }

  async function evaluar() {
    setEvaluando(true);
    setError("");
    try {
      const res = await evaluarBecas(anio);
      const detalle = res.data.suspendidas.map((s) => `${s.alumno}: ${s.motivo}`).join(" · ");
      await recargarCon(detalle ? `${res.message} ${detalle}` : res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron evaluar las becas.");
    } finally {
      setEvaluando(false);
    }
  }

  async function verHistorial(b: BecaDto) {
    setHistorialDe(b);
    try {
      setHistorialDe(await getBecaById(b.becaId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el historial.");
    }
  }

  // ---------- Render ----------

  const politica = resumen?.politica;
  const presupuestoTexto = politica?.presupuestoMensual != null
    ? `${formatQ(resumen!.presupuestoUsado)} / ${formatQ(politica.presupuestoMensual)}`
    : formatQ(resumen?.presupuestoUsado ?? 0);
  const presupuestoCritico = politica?.presupuestoMensual != null && resumen!.presupuestoDisponible! < colegiatura * 0.25;

  const tabs = ["Becas", `Solicitudes${solicitudes.length ? ` (${solicitudes.length})` : ""}`, "Programas", "Política"];
  const tabActiva = tab === "Solicitudes" ? tabs[1] : tab;

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Becas"
        subtitle="Programas con cupos, solicitudes de encargados y descuentos sobre la colegiatura"
        action={
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} aria-label="Ciclo lectivo"
              className="border border-stone-300 rounded-md bg-white text-sm py-1.5 px-2 focus:outline-none focus:ring-2 focus:ring-primary-700">
              {ANIOS.map((a) => <option key={a} value={a}>Ciclo {a}</option>)}
            </select>
            <Btn variant="outline" size="sm" loading={evaluando} icon={<ClipboardCheck className="w-4 h-4" />} onClick={evaluar}>Evaluar requisitos</Btn>
            <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={abrirAsignar}>Asignar beca</Btn>
          </div>
        }
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMessage && <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}

      {resumen && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard label="Becas activas" value={resumen.porEstado.Activa} sub={`${resumen.porEstado.Suspendida} suspendidas`} icon={<Award className="w-5 h-5" />} />
          <MetricCard label="Solicitudes" value={resumen.porEstado.Solicitada} sub="pendientes de revisión" icon={<Inbox className="w-5 h-5" />}
            variant={resumen.porEstado.Solicitada > 0 ? "warning" : "default"} />
          <MetricCard label="Presupuesto mensual" value={presupuestoTexto}
            sub={politica?.presupuestoMensual != null ? `Disponible ${formatQ(resumen.presupuestoDisponible ?? 0)}` : "Sin límite definido"}
            icon={<Wallet className="w-5 h-5" />} variant={presupuestoCritico ? "danger" : "default"} />
          <MetricCard label="Colegiatura" value={formatQ(colegiatura)} sub={`Hermanos: ${politica?.descuentoHermanos ?? 0}% · Tope ${politica?.descuentoMaximo ?? 100}%`} icon={<Receipt className="w-5 h-5" />} />
        </div>
      )}

      {(asignando || editando) && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">
            {editando ? `Editar beca de ${nombreDe(editando.alumno.usuario)}` : `Asignar beca — ciclo ${anio}`}
          </h3>
          {formError && <div className="mb-4"><AlertBanner type="error" message={formError} /></div>}

          {asignando && (
            programasAbiertos.length === 0 ? (
              <AlertBanner type="warning" message={`No hay programas abiertos para ${anio}. Créelos en la pestaña Programas.`} />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <Select label="Alumno" value={formAsignar.alumnoId} onChange={(e) => setFormAsignar((f) => ({ ...f, alumnoId: e.target.value }))}>
                    <option value="">Seleccionar alumno…</option>
                    {alumnos.filter((a) => !alumnosConBeca.has(a.alumnoId)).map((a) => (
                      <option key={a.alumnoId} value={a.alumnoId}>{nombreDe(a.usuario)} — {gradoSeccion(a.seccion)}</option>
                    ))}
                  </Select>
                </div>
                <Select label="Programa" value={formAsignar.programaId}
                  onChange={(e) => {
                    const p = programas.find((x) => String(x.programaId) === e.target.value);
                    setFormAsignar((f) => ({ ...f, programaId: e.target.value, porcentaje: p ? String(Number(p.porcentaje)) : f.porcentaje }));
                  }}>
                  {programasAbiertos.map((p) => (
                    <option key={p.programaId} value={p.programaId} disabled={p.cuposDisponibles === 0}>
                      {p.nombre} ({Number(p.porcentaje)}%){p.cupos !== null ? ` — ${p.cuposDisponibles} cupos` : ""}
                    </option>
                  ))}
                </Select>
                <Input label="Descuento" type="number" min="1" max="100" value={formAsignar.porcentaje}
                  onChange={(e) => setFormAsignar((f) => ({ ...f, porcentaje: e.target.value }))} suffix={<span className="text-sm">%</span>} />
                <div className="md:col-span-2">
                  <Input label="Observación (opcional)" value={formAsignar.descripcion}
                    onChange={(e) => setFormAsignar((f) => ({ ...f, descripcion: e.target.value }))} placeholder="Ej. Estudio socioeconómico No. 45" />
                </div>
                {programaElegido && (
                  <p className="md:col-span-3 text-xs text-stone-500">
                    Vigente hasta el 31/12/{anio}. {programaElegido.promedioMinimo !== null && `Exige promedio mínimo de ${Number(programaElegido.promedioMinimo)}. `}
                    Total a pagar: <strong className="text-primary-700">{formatQ(colegiatura * (1 - Number(formAsignar.porcentaje || 0) / 100))}</strong> al mes (sin contar descuento por hermanos).
                  </p>
                )}
              </div>
            )
          )}

          {editando && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Input label="Descuento" type="number" min="1" max="100" value={formEditar.porcentaje}
                onChange={(e) => setFormEditar((f) => ({ ...f, porcentaje: e.target.value }))} suffix={<span className="text-sm">%</span>} />
              <Input label="Desde" type="date" value={formEditar.fechaInicio} onChange={(e) => setFormEditar((f) => ({ ...f, fechaInicio: e.target.value }))} />
              <Input label="Hasta" type="date" value={formEditar.fechaFin} onChange={(e) => setFormEditar((f) => ({ ...f, fechaFin: e.target.value }))} />
              <Input label="Observación" value={formEditar.descripcion} onChange={(e) => setFormEditar((f) => ({ ...f, descripcion: e.target.value }))} />
              <p className="md:col-span-4 text-xs text-stone-500">Para cambiar de alumno o de programa, revoque esta beca y asigne una nueva. Los cambios quedan en el historial.</p>
            </div>
          )}

          <div className="flex gap-2 justify-end mt-4">
            <Btn variant="outline" size="sm" onClick={cerrarFormularios} disabled={submitting}>Cancelar</Btn>
            {(editando || programasAbiertos.length > 0) && (
              <Btn variant="primary" size="sm" loading={submitting} onClick={editando ? guardarEdicion : guardarAsignacion}>
                {editando ? "Guardar cambios" : "Asignar beca"}
              </Btn>
            )}
          </div>
        </Card>
      )}

      <Tabs tabs={tabs} active={tabActiva} onChange={(t) => setTab(t.startsWith("Solicitudes") ? "Solicitudes" : t)} />

      {loading ? (
        <Card className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
          Cargando becas…
        </Card>
      ) : (
        <>
          {tab === "Becas" && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {FILTROS.map((f) => (
                  <button key={f.label} onClick={() => setFiltro(f)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer
                      ${filtro.label === f.label ? "bg-primary-700 text-white border-primary-700" : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"}`}>
                    {f.label}
                  </button>
                ))}
              </div>
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr><TH>Alumno</TH><TH>Programa</TH><TH>Descuento</TH><TH>Total a pagar</TH><TH>Vigencia</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {becas.map((b) => {
                        const porcentaje = Number(b.porcentaje);
                        const vigente = b.estado === "Activa" || b.estado === "Suspendida";
                        return (
                          <tr key={b.becaId} className="hover:bg-stone-50 transition-colors">
                            <TD>
                              <p className="font-medium text-stone-900 text-sm">{nombreDe(b.alumno.usuario)}</p>
                              <p className="text-xs text-stone-500">{gradoSeccion(b.alumno.seccion)}</p>
                            </TD>
                            <TD>
                              <p className="text-sm">{b.programa?.nombre ?? <span className="text-stone-400">Sin programa</span>}</p>
                              {b.descripcion && <p className="text-xs text-stone-500 max-w-[14rem] truncate" title={b.descripcion}>{b.descripcion}</p>}
                            </TD>
                            <TD><Badge variant="success">{porcentaje}%</Badge></TD>
                            <TD><span className="font-mono-data font-semibold text-primary-700">{formatQ(colegiatura * (1 - porcentaje / 100))}</span></TD>
                            <TD><span className="text-stone-500 text-xs whitespace-nowrap">{formatFecha(b.fechaInicio)} – {formatFecha(b.fechaFin)}</span></TD>
                            <TD><Badge variant={ESTADO_BECA_BADGE[b.estado]}>{b.estado}</Badge></TD>
                            <TD className="text-right whitespace-nowrap">
                              <IconBtn label="Ver historial" onClick={() => verHistorial(b)}><History className="w-3.5 h-3.5" /></IconBtn>
                              {vigente && <IconBtn label="Editar" onClick={() => abrirEditar(b)}><Edit className="w-3.5 h-3.5" /></IconBtn>}
                              {b.estado === "Activa" && (
                                <IconBtn label="Suspender" tone="warning" onClick={() => pedirAccion({
                                  beca: b, estado: "Suspendida", titulo: "Suspender beca", boton: "Suspender", variante: "destructive",
                                  motivoSugerido: "",
                                })}><PauseCircle className="w-3.5 h-3.5" /></IconBtn>
                              )}
                              {b.estado === "Suspendida" && (
                                <IconBtn label="Reactivar" onClick={() => pedirAccion({
                                  beca: b, estado: "Activa", titulo: "Reactivar beca", boton: "Reactivar", variante: "primary",
                                  motivoSugerido: "El alumno volvió a cumplir los requisitos del programa.",
                                })}><PlayCircle className="w-3.5 h-3.5" /></IconBtn>
                              )}
                              {(b.estado === "Activa" || b.estado === "Finalizada") && (
                                <IconBtn label={`Renovar para ${b.anioLectivo + 1}`} onClick={() => renovar(b)}><RefreshCw className="w-3.5 h-3.5" /></IconBtn>
                              )}
                              {vigente && (
                                <IconBtn label="Revocar" tone="danger" onClick={() => pedirAccion({
                                  beca: b, estado: "Revocada", titulo: "Revocar beca", boton: "Revocar", variante: "destructive",
                                  motivoSugerido: "",
                                })}><Ban className="w-3.5 h-3.5" /></IconBtn>
                              )}
                            </TD>
                          </tr>
                        );
                      })}
                      {becas.length === 0 && (
                        <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">No hay becas {filtro.label.toLowerCase()} en el ciclo {anio}.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}

          {tab === "Solicitudes" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr><TH>Alumno</TH><TH>Programa</TH><TH>Cupos</TH><TH>Solicitada por</TH><TH>Justificación</TH><TH className="text-right">Resolución</TH></tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {solicitudes.map((s) => {
                      const programa = programas.find((p) => p.programaId === s.programaId);
                      const sinCupo = programa?.cuposDisponibles === 0;
                      return (
                        <tr key={s.becaId} className="hover:bg-stone-50 transition-colors align-top">
                          <TD>
                            <p className="font-medium text-stone-900 text-sm">{nombreDe(s.alumno.usuario)}</p>
                            <p className="text-xs text-stone-500">{gradoSeccion(s.alumno.seccion)}</p>
                          </TD>
                          <TD>
                            <p className="text-sm">{s.programa?.nombre}</p>
                            <p className="text-xs text-stone-500">{Number(s.porcentaje)}%</p>
                          </TD>
                          <TD>
                            {programa?.cupos == null
                              ? <span className="text-xs text-stone-500">Sin límite</span>
                              : <Badge variant={sinCupo ? "danger" : "neutral"}>{programa.cuposDisponibles} disponibles</Badge>}
                          </TD>
                          <TD>
                            <p className="text-sm">{s.solicitadaPor ? nombreDe(s.solicitadaPor) : "—"}</p>
                            <p className="text-xs text-stone-500">{formatFecha(s.createdAt)}</p>
                          </TD>
                          <TD><p className="text-xs text-stone-600 max-w-xs">{s.descripcion ?? "—"}</p></TD>
                          <TD className="text-right whitespace-nowrap">
                            <div className="flex gap-1.5 justify-end">
                              <Btn variant="primary" size="sm" icon={<Check className="w-3.5 h-3.5" />} disabled={sinCupo}
                                onClick={() => pedirAccion({
                                  beca: s, estado: "Activa", titulo: "Aprobar solicitud", boton: "Aprobar", variante: "primary",
                                  motivoSugerido: "Cumple con los requisitos del programa.",
                                })}>Aprobar</Btn>
                              <Btn variant="outline" size="sm" icon={<X className="w-3.5 h-3.5" />}
                                onClick={() => pedirAccion({
                                  beca: s, estado: "Rechazada", titulo: "Rechazar solicitud", boton: "Rechazar", variante: "destructive",
                                  motivoSugerido: "",
                                })}>Rechazar</Btn>
                            </div>
                          </TD>
                        </tr>
                      );
                    })}
                    {solicitudes.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-stone-500">No hay solicitudes pendientes para el ciclo {anio}.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "Programas" && (
            <ProgramasBeca programas={programas} anioLectivo={anio} colegiatura={colegiatura} onCambio={recargarCon} />
          )}

          {tab === "Política" && resumen && <PoliticaBecas resumen={resumen} onCambio={recargarCon} />}
        </>
      )}

      <Modal
        open={!!accion}
        onClose={() => { if (!submitting) setAccion(null); }}
        title={accion?.titulo ?? ""}
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setAccion(null)} disabled={submitting}>Cancelar</Btn>
            <Btn variant={accion?.variante ?? "primary"} size="sm" loading={submitting} onClick={confirmarAccion}>{accion?.boton}</Btn>
          </>
        }
      >
        {accion && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              {accion.titulo} de <strong>{nombreDe(accion.beca.alumno.usuario)}</strong>
              {accion.beca.programa && <> ({accion.beca.programa.nombre}, {Number(accion.beca.porcentaje)}%)</>}.
              {accion.estado === "Revocada" && " La revocación es definitiva y libera el cupo."}
              {accion.estado === "Suspendida" && " Mientras esté suspendida no se aplica el descuento, pero conserva el cupo."}
              {accion.estado === "Activa" && " Se validarán cupos, presupuesto y requisitos."}
            </p>
            {accionError && <AlertBanner type="error" message={accionError} />}
            <Textarea label="Motivo (se enviará al encargado)" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
      </Modal>

      <Drawer open={!!historialDe} onClose={() => setHistorialDe(null)} title="Historial de la beca">
        {historialDe && (
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-stone-900">{nombreDe(historialDe.alumno.usuario)}</p>
              <p className="text-sm text-stone-500">
                {historialDe.programa?.nombre ?? "Sin programa"} · {Number(historialDe.porcentaje)}% · Ciclo {historialDe.anioLectivo}
              </p>
              <div className="mt-2"><Badge variant={ESTADO_BECA_BADGE[historialDe.estado]}>{historialDe.estado}</Badge></div>
            </div>
            {historialDe.historial
              ? <HistorialBeca historial={historialDe.historial} />
              : <p className="text-sm text-stone-500">Cargando…</p>}
          </div>
        )}
      </Drawer>
    </div>
  );
}

function IconBtn({ label, onClick, children, tone = "primary" }: {
  label: string; onClick: () => void; children: React.ReactNode; tone?: "primary" | "warning" | "danger";
}) {
  const hover = { primary: "hover:text-primary-700", warning: "hover:text-warning-700", danger: "hover:text-danger-700" }[tone];
  return (
    <button onClick={onClick} className={`p-1.5 text-stone-400 ${hover} rounded transition-colors cursor-pointer`} aria-label={label} title={label}>
      {children}
    </button>
  );
}

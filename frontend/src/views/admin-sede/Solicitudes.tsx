import { useEffect, useState } from "react";
import { Search, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, UserCheck, Copy, Printer, Heart } from "../../components/Iconos";
import { DetalleSalud, tieneSalud } from "../../components/InfoSalud";
import { Card, SectionHeader, Badge, Btn, Drawer, Modal, AlertBanner, Select, Textarea, TH, TD, EmptyState, TablaResponsiva } from "../../components/Ui";
import {
  getSolicitudesAdmin, getOpcionesAprobacion, marcarSolicitud, aprobarSolicitud, rechazarSolicitud,
  type SolicitudDto, type EstadoSolicitudDto, type OpcionesAprobacionDto, type AprobacionDto,
} from "../../lib/api";
import { formatFecha } from "../../lib/becas";

type Filtro = "abiertas" | EstadoSolicitudDto | "todas";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "abiertas", label: "Por resolver" },
  { id: "APROBADA", label: "Aprobadas" },
  { id: "RECHAZADA", label: "Rechazadas" },
  { id: "VENCIDA", label: "Vencidas" },
  { id: "todas", label: "Todas" },
];

const vencida = (s: SolicitudDto) => (s.estado === "PENDIENTE" || s.estado === "REVISION") && new Date(s.fechaLimite) < new Date();

function EstadoBadgeSolicitud({ s }: { s: SolicitudDto }) {
  if (vencida(s)) return <Badge variant="warning"><Clock className="w-3 h-3" />Plazo vencido</Badge>;
  const cfg = {
    PENDIENTE: { v: "neutral", t: "Pendiente" },
    REVISION: { v: "info", t: "En revisión" },
    APROBADA: { v: "success", t: "Aprobada" },
    RECHAZADA: { v: "danger", t: "Rechazada" },
    VENCIDA: { v: "warning", t: "Vencida" },
  } as const;
  const c = cfg[s.estado];
  return <Badge variant={c.v}>{c.t}</Badge>;
}

const gradoPedido = (s: SolicitudDto) =>
  s.alumnoGrado || [s.alumnoAnio, s.alumnoCarrera].filter(Boolean).join(" — ") || s.alumnoNivel;

const nombreAlumno = (s: SolicitudDto) => `${s.alumnoNombres} ${s.alumnoApellidos}`;
const nombreEncargado = (s: SolicitudDto) => `${s.encargadoNombres} ${s.encargadoApellidos}`;

function edad(fechaIso: string) {
  const n = new Date(fechaIso);
  const hoy = new Date();
  let e = hoy.getFullYear() - n.getUTCFullYear();
  if (hoy.getMonth() < n.getUTCMonth() || (hoy.getMonth() === n.getUTCMonth() && hoy.getDate() < n.getUTCDate())) e--;
  return e;
}

export default function SolicitudesView() {
  const [filtro, setFiltro] = useState<Filtro>("abiertas");
  const [q, setQ] = useState("");
  const [solicitudes, setSolicitudes] = useState<SolicitudDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [abierta, setAbierta] = useState<SolicitudDto | null>(null);

  async function cargar() {
    setLoading(true);
    setError("");
    try {
      const estado = filtro === "abiertas" || filtro === "todas" ? undefined : filtro;
      let data = await getSolicitudesAdmin({ estado, q: q.trim() || undefined });
      if (filtro === "abiertas") data = data.filter((s) => s.estado === "PENDIENTE" || s.estado === "REVISION");
      setSolicitudes(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las solicitudes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const t = setTimeout(cargar, q ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro, q]);

  const vencidas = solicitudes.filter(vencida).length;

  return (
    <div className="space-y-5">
      <SectionHeader title="Solicitudes de inscripción" subtitle="Revise los documentos, asigne la sección y cree las cuentas del alumno y su encargado" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}
      {filtro === "abiertas" && vencidas > 0 && (
        <AlertBanner type="warning" message={`${vencidas} solicitud(es) pasaron la fecha límite para entregar documentos. Puede aprobarlas si los recibió tarde, o marcarlas como vencidas.`} />
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 p-4 border-b border-stone-100">
          <div className="flex gap-1 flex-wrap">
            {FILTROS.map((f) => (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors
                  ${filtro === f.id ? "bg-primary-700 text-white" : "bg-white border border-stone-200 text-stone-700 hover:border-primary-300"}`}>
                {f.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 lg:max-w-sm lg:ml-auto">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, alumno, encargado o correo…"
              className="w-full pl-10 pr-3.5 py-2.5 text-[15px] border-[1.5px] border-stone-200 hover:border-stone-300 rounded-xl focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 bg-white" />
          </div>
        </div>

        <TablaResponsiva>
          <table className="w-full">
            <thead>
              <tr><TH>Solicitud</TH><TH>Alumno</TH><TH>Grado solicitado</TH><TH>Encargado</TH><TH>Fecha límite</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-stone-500">Cargando solicitudes…</td></tr>
              ) : solicitudes.length === 0 ? (
                <tr><td colSpan={7}><EmptyState icon={<FileText className="w-10 h-10" />} title="No hay solicitudes" description="No hay solicitudes con este filtro." /></td></tr>
              ) : solicitudes.map((s) => (
                <tr key={s.solicitudId} className="hover:bg-sand-50 transition-colors">
                  <TD>
                    <p className="font-mono-data text-xs font-semibold text-stone-900">{s.numero}</p>
                    <p className="text-[11px] text-stone-400">{s.modo === "PUBLICO" ? "En línea" : "Presencial"} · {formatFecha(s.fechaSolicitud)}</p>
                  </TD>
                  <TD>
                    <p className="font-semibold text-stone-900 text-[15px]">{nombreAlumno(s)}</p>
                    <p className="text-xs text-stone-400">{edad(s.alumnoFechaNacimiento)} años</p>
                  </TD>
                  <TD><span className="text-sm text-stone-700">{gradoPedido(s)}</span><p className="text-xs text-stone-400">{s.sede?.nombre ?? "Sin sede"}</p></TD>
                  <TD><span className="text-sm">{nombreEncargado(s)}</span><p className="text-xs text-stone-400">{s.encargadoCorreo}</p></TD>
                  <TD><span className={`text-xs font-mono-data ${vencida(s) ? "text-warning-700 font-semibold" : "text-stone-600"}`}>{formatFecha(s.fechaLimite)}</span></TD>
                  <TD><EstadoBadgeSolicitud s={s} /></TD>
                  <TD className="text-right">
                    <button onClick={() => setAbierta(s)} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 rounded-lg cursor-pointer">
                      <FileText className="w-3.5 h-3.5" />{s.estado === "PENDIENTE" || s.estado === "REVISION" ? "Revisar" : "Ver"}
                    </button>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaResponsiva>
      </Card>

      <Drawer open={!!abierta} onClose={() => setAbierta(null)} title={abierta ? `Solicitud ${abierta.numero}` : ""}>
        {abierta && (
          <DetalleSolicitud key={abierta.solicitudId} solicitud={abierta}
            onResuelta={(mensaje) => { setAviso(mensaje); cargar(); }}
            onCambio={(s) => { setAbierta(s); cargar(); }} />
        )}
      </Drawer>
    </div>
  );
}

const saludDe = (s: SolicitudDto) => ({
  necesidadesApoyo: s.alumnoNecesidadesApoyo,
  alergias: s.alumnoAlergias,
  medicamentos: s.alumnoMedicamentos,
});

function Dato({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-medium text-stone-500">{k}</dt>
      <dd className="text-sm text-stone-900">{v || "—"}</dd>
    </div>
  );
}

function DetalleSolicitud({ solicitud: s, onResuelta, onCambio }: {
  solicitud: SolicitudDto;
  onResuelta: (mensaje: string) => void;
  onCambio: (s: SolicitudDto) => void;
}) {
  const abierta = s.estado === "PENDIENTE" || s.estado === "REVISION";
  const [opciones, setOpciones] = useState<OpcionesAprobacionDto | null>(null);
  const [error, setError] = useState("");
  const [seccionId, setSeccionId] = useState<number | null>(null);
  const [acceso, setAcceso] = useState<"nivel" | "si" | "no">("nivel");
  const [docs, setDocs] = useState<Record<string, boolean>>({});
  const [confirmarDuplicado, setConfirmarDuplicado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{ mensaje: string; data: AprobacionDto } | null>(null);
  const [rechazo, setRechazo] = useState(false);
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    if (!abierta) return;
    getOpcionesAprobacion(s.solicitudId)
      .then((o) => {
        setOpciones(o);
        const sugerida = o.secciones.find((x) => x.sugerida);
        if (sugerida) setSeccionId(sugerida.seccionId);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar las opciones."));
  }, [s.solicitudId, abierta]);

  const seccion = opciones?.secciones.find((x) => x.seccionId === seccionId) ?? null;
  const todosDocs = s.documentos.every((d) => docs[d]);
  const hayDuplicados = (opciones?.duplicados.length ?? 0) > 0;
  const bloqueoCuenta = opciones?.cuentaEncargado && (opciones.cuentaEncargado.dadoDeBaja || opciones.cuentaEncargado.esAlumno);
  const puedeAprobar = !!seccion && todosDocs && (!hayDuplicados || confirmarDuplicado) && !bloqueoCuenta;

  async function cambiarEstado(estado: "REVISION" | "VENCIDA" | "PENDIENTE") {
    setError("");
    try {
      const res = await marcarSolicitud(s.solicitudId, estado);
      onCambio(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cambiar el estado.");
    }
  }

  async function aprobar() {
    if (!seccion) return;
    setEnviando(true);
    setError("");
    try {
      const res = await aprobarSolicitud(s.solicitudId, {
        seccionId: seccion.seccionId,
        accesoPortal: acceso === "nivel" ? null : acceso === "si",
        confirmarDuplicado,
      });
      setResultado({ mensaje: res.message, data: res.data });
      onResuelta(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo aprobar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  async function rechazar() {
    setEnviando(true);
    setError("");
    try {
      const res = await rechazarSolicitud(s.solicitudId, motivo.trim());
      setRechazo(false);
      onResuelta(res.message);
      onCambio({ ...s, estado: "RECHAZADA", motivoResolucion: motivo.trim(), fechaResolucion: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo rechazar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) return <ResultadoAprobacion resultado={resultado} solicitud={s} />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <EstadoBadgeSolicitud s={s} />
        <span className="text-xs text-stone-400">{s.modo === "PUBLICO" ? "Enviada en línea" : "Registrada en ventanilla"} · {formatFecha(s.fechaSolicitud)}</span>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <section>
        <h3 className="text-sm font-semibold text-stone-800 mb-2">Alumno</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Dato k="Nombre" v={nombreAlumno(s)} />
          <Dato k="Nacimiento" v={`${formatFecha(s.alumnoFechaNacimiento)} (${edad(s.alumnoFechaNacimiento)} años)`} />
          <Dato k="Grado solicitado" v={gradoPedido(s)} />
          <Dato k="Sede" v={s.sede?.nombre} />
        </dl>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-stone-800 mb-2 flex items-center gap-2">
          Salud y necesidades de apoyo
          {tieneSalud(saludDe(s)) && <Badge variant="danger"><Heart className="w-3 h-3" />Requiere atención</Badge>}
        </h3>
        {tieneSalud(saludDe(s)) ? <DetalleSalud salud={saludDe(s)} /> : <p className="text-sm text-stone-400">El encargado no indicó información de salud.</p>}
        <p className="text-xs text-stone-400 mt-2">Al aprobar la solicitud, esta información pasa a la ficha del alumno.</p>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-stone-800 mb-2">Encargado</h3>
        <dl className="grid grid-cols-2 gap-3">
          <Dato k="Nombre" v={nombreEncargado(s)} />
          <Dato k="Parentesco" v={s.encargadoParentesco} />
          <Dato k="DPI" v={s.encargadoDpi} />
          <Dato k="Teléfono" v={s.encargadoTelefono} />
          <div className="col-span-2"><Dato k="Correo" v={s.encargadoCorreo} /></div>
        </dl>
      </section>

      {s.observaciones && (
        <section>
          <h3 className="text-sm font-semibold text-stone-800 mb-1">Observaciones</h3>
          <p className="text-sm text-stone-600 whitespace-pre-line">{s.observaciones}</p>
        </section>
      )}

      {!abierta ? (
        <section className="border-t border-stone-100 pt-4 space-y-2 text-sm">
          {s.estado === "APROBADA" && <AlertBanner type="success" message={`Aprobada el ${s.fechaResolucion ? formatFecha(s.fechaResolucion) : "—"}. El alumno ya tiene su cuenta y matrícula.`} />}
          {s.estado === "RECHAZADA" && <AlertBanner type="error" title="Rechazada" message={s.motivoResolucion ?? "Sin motivo registrado."} />}
          {s.estado === "VENCIDA" && (
            <>
              <AlertBanner type="warning" message="Se venció el plazo para entregar documentos." />
              <Btn variant="outline" size="sm" onClick={() => cambiarEstado("PENDIENTE")}>Reabrir (entregó los documentos)</Btn>
            </>
          )}
        </section>
      ) : (
        <>
          <section className="border-t border-stone-100 pt-4">
            <h3 className="text-sm font-semibold text-stone-800 mb-2">Documentos recibidos en ventanilla</h3>
            <div className="space-y-2">
              {s.documentos.map((d) => (
                <label key={d} className="flex items-start gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 mt-0.5 accent-primary-700" checked={!!docs[d]} onChange={(e) => setDocs((p) => ({ ...p, [d]: e.target.checked }))} />
                  {d}
                </label>
              ))}
            </div>
            {opciones?.vencida && <p className="text-xs text-warning-700 mt-2">El plazo venció el {formatFecha(s.fechaLimite)}; apruebe solo si recibió los documentos.</p>}
          </section>

          <section className="border-t border-stone-100 pt-4 space-y-3">
            <h3 className="text-sm font-semibold text-stone-800">Asignación</h3>
            {!opciones ? <div className="h-20 rounded-lg bg-stone-100 animate-pulse" /> : (
              <>
                <Select label="Sección" value={seccionId ?? ""} onChange={(e) => setSeccionId(Number(e.target.value) || null)}>
                  <option value="">Seleccione…</option>
                  {opciones.secciones.some((x) => x.sugerida) && (
                    <optgroup label="Coinciden con lo solicitado">
                      {opciones.secciones.filter((x) => x.sugerida).map((x) => (
                        <option key={x.seccionId} value={x.seccionId}>{x.grado.nombre} {x.nombre} · {x.sede.nombre} · {x.anioLectivo} ({x.alumnos} alumnos)</option>
                      ))}
                    </optgroup>
                  )}
                  <optgroup label="Todas las secciones abiertas">
                    {opciones.secciones.filter((x) => !x.sugerida).map((x) => (
                      <option key={x.seccionId} value={x.seccionId}>{x.grado.nombre} {x.nombre} · {x.sede.nombre} · {x.anioLectivo} ({x.alumnos} alumnos)</option>
                    ))}
                  </optgroup>
                </Select>
                {opciones.secciones.length === 0 && <AlertBanner type="warning" message="No hay secciones abiertas para el ciclo actual o el siguiente. Créelas en Grados y secciones." />}

                <Select label="Acceso del alumno al portal" value={acceso} onChange={(e) => setAcceso(e.target.value as typeof acceso)}>
                  <option value="nivel">Según el nivel ({seccion ? (seccion.accesoPorNivel ? "sí" : "no, es " + seccion.grado.nivel) : "elija la sección"})</option>
                  <option value="si">Habilitado (tiene dispositivo / correo)</option>
                  <option value="no">Deshabilitado</option>
                </Select>

                {opciones.cuentaEncargado && (
                  opciones.cuentaEncargado.dadoDeBaja || opciones.cuentaEncargado.esAlumno ? (
                    <AlertBanner type="error" message={opciones.cuentaEncargado.esAlumno
                      ? `El correo ${opciones.cuentaEncargado.email} es de un alumno. Pida al encargado otro correo antes de aprobar.`
                      : `El correo ${opciones.cuentaEncargado.email} es de una cuenta dada de baja. Reactívela en Usuarios antes de aprobar.`} />
                  ) : (
                    <AlertBanner type="info" message={`${opciones.cuentaEncargado.nombre} ya tiene cuenta (${opciones.cuentaEncargado.roles.join(", ")}). ${opciones.cuentaEncargado.yaEsEncargado ? "El alumno se agregará a sus hijos" : "Se le agregará el rol Encargado"}; conserva su contraseña.`} />
                  )
                )}

                {hayDuplicados && (
                  <div className="space-y-2">
                    <AlertBanner type="warning" title="Posible alumno duplicado"
                      message={opciones.duplicados.map((d) => `${d.usuario.nombres} ${d.usuario.apellidos} — ${d.seccion.grado.nombre} ${d.seccion.nombre}, ${d.seccion.sede.nombre} (${d.seccion.anioLectivo})${d.usuario.deletedAt ? ", dado de baja" : ""}`).join("; ")
                        + ". Si es el mismo alumno, rechace esta solicitud y use Matrícula o reactive su cuenta."} />
                    <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={confirmarDuplicado} onChange={(e) => setConfirmarDuplicado(e.target.checked)} />
                      Verifiqué que es otra persona
                    </label>
                  </div>
                )}
              </>
            )}
          </section>

          <div className="flex flex-wrap gap-2 justify-end border-t border-stone-100 pt-4">
            {s.estado === "PENDIENTE" && <Btn variant="ghost" size="sm" icon={<Clock className="w-4 h-4" />} onClick={() => cambiarEstado("REVISION")}>Marcar en revisión</Btn>}
            {opciones?.vencida && <Btn variant="ghost" size="sm" icon={<AlertTriangle className="w-4 h-4" />} onClick={() => cambiarEstado("VENCIDA")}>Marcar vencida</Btn>}
            <Btn variant="outline" size="sm" icon={<XCircle className="w-4 h-4" />} onClick={() => { setMotivo(""); setRechazo(true); }}>Rechazar</Btn>
            <Btn variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} loading={enviando} disabled={!puedeAprobar} onClick={aprobar}>Aprobar e inscribir</Btn>
          </div>
          {!puedeAprobar && opciones && (
            <p className="text-xs text-stone-500 text-right">
              {!todosDocs ? "Marque todos los documentos como recibidos. " : ""}
              {!seccion ? "Seleccione la sección. " : ""}
              {hayDuplicados && !confirmarDuplicado ? "Confirme el posible duplicado." : ""}
            </p>
          )}
        </>
      )}

      <Modal open={rechazo} onClose={() => !enviando && setRechazo(false)} title="Rechazar solicitud"
        footer={<>
          <Btn variant="ghost" onClick={() => setRechazo(false)} disabled={enviando}>Cancelar</Btn>
          <Btn variant="destructive" loading={enviando} disabled={motivo.trim().length < 5} onClick={rechazar}>Rechazar</Btn>
        </>}>
        <div className="space-y-3">
          <p className="text-sm text-stone-600">El motivo se enviará por correo a {s.encargadoCorreo}.</p>
          <Textarea label="Motivo" rows={4} value={motivo} onChange={(e) => setMotivo(e.target.value)}
            placeholder="Ej. No hay cupo en el grado solicitado para este ciclo." />
        </div>
      </Modal>
    </div>
  );
}

function ResultadoAprobacion({ resultado, solicitud }: { resultado: { mensaje: string; data: AprobacionDto }; solicitud: SolicitudDto }) {
  const { data } = resultado;
  const [copiado, setCopiado] = useState(false);
  const texto = [
    `Inscripción ${solicitud.numero}`,
    `Encargado: ${data.encargado.usuario}${data.encargado.passwordTemporal ? ` / contraseña temporal: ${data.encargado.passwordTemporal}` : " (cuenta existente)"}`,
    `Alumno: ${data.alumno.usuario}${data.alumno.passwordTemporal ? ` / contraseña temporal: ${data.alumno.passwordTemporal}` : " (sin acceso al portal)"}`,
  ].join("\n");

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <UserCheck className="w-7 h-7 text-success-600" />
        </div>
        <p className="font-display text-lg font-bold text-success-800">Inscripción completada</p>
        <p className="text-sm text-stone-600 mt-1">{resultado.mensaje}</p>
      </div>

      {!data.correoEnviado && <AlertBanner type="warning" message="El correo no se envió. Entregue estos accesos impresos al encargado." />}

      <Card className="p-4 space-y-3 text-sm">
        <div>
          <p className="text-[13px] font-semibold text-stone-500">Encargado — {data.encargado.nombre}</p>
          <p>Usuario: <span className="font-mono-data">{data.encargado.usuario}</span></p>
          {data.encargado.passwordTemporal
            ? <p>Contraseña temporal: <span className="font-display font-bold tabular-nums">{data.encargado.passwordTemporal}</span></p>
            : <p className="text-stone-500">Ya tenía cuenta: usa su contraseña actual.</p>}
        </div>
        <div className="border-t border-stone-100 pt-3">
          <p className="text-[13px] font-semibold text-stone-500">Alumno — {data.alumno.nombre}</p>
          <p>Usuario: <span className="font-mono-data">{data.alumno.usuario}</span></p>
          {data.alumno.passwordTemporal
            ? <p>Contraseña temporal: <span className="font-display font-bold tabular-nums">{data.alumno.passwordTemporal}</span></p>
            : <p className="text-stone-500">Sin acceso al portal por su nivel; el encargado consulta su información.</p>}
        </div>
      </Card>

      <div className="flex gap-2 justify-end">
        <Btn variant="outline" size="sm" icon={<Copy className="w-4 h-4" />}
          onClick={() => navigator.clipboard?.writeText(texto).then(() => setCopiado(true)).catch(() => {})}>
          {copiado ? "Copiado" : "Copiar"}
        </Btn>
        <Btn variant="outline" size="sm" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Btn>
      </div>
    </div>
  );
}

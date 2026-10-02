import { useEffect, useState } from "react";
import { Award, Send, Users2, GraduationCap, ShieldAlert, History } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Select, Textarea, EmptyState, Drawer } from "../components/Ui";
import HistorialBeca from "../components/HistorialBeca";
import { getMisBecas, solicitarBeca, type HijoBecasDto, type MisBecasDto } from "../lib/api";
import { ESTADO_BECA_BADGE, TIPO_PROGRAMA_LABEL, formatFecha, formatQ } from "../lib/becas";

type BecaHijo = HijoBecasDto["becas"][number];

export default function BecasPadre() {
  const [datos, setDatos] = useState<MisBecasDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [solicitandoPara, setSolicitandoPara] = useState<HijoBecasDto | null>(null);
  const [programaId, setProgramaId] = useState("");
  const [justificacion, setJustificacion] = useState("");
  const [formError, setFormError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [historialDe, setHistorialDe] = useState<BecaHijo | null>(null);

  function cargar() {
    return getMisBecas().then(setDatos);
  }

  useEffect(() => {
    let cancelled = false;
    getMisBecas()
      .then((d) => { if (!cancelled) setDatos(d); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar las becas."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function abrirSolicitud(hijo: HijoBecasDto) {
    const disponible = hijo.programasDisponibles.find((p) => p.cuposDisponibles !== 0);
    setSolicitandoPara(hijo);
    setProgramaId(disponible ? String(disponible.programaId) : "");
    setJustificacion("");
    setFormError("");
  }

  async function enviar() {
    if (!solicitandoPara || !programaId) {
      setFormError("Seleccione un programa.");
      return;
    }
    if (justificacion.trim().length < 20) {
      setFormError("Explique brevemente por qué solicita la beca (mínimo 20 caracteres).");
      return;
    }
    setEnviando(true);
    setFormError("");
    try {
      const res = await solicitarBeca({ alumnoId: solicitandoPara.alumnoId, programaId: Number(programaId), justificacion: justificacion.trim() });
      setSolicitandoPara(null);
      setExito(res.message);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando becas…
      </div>
    );
  }

  const colegiatura = datos?.colegiaturaMensual ?? 0;
  const programaElegido = solicitandoPara?.programasDisponibles.find((p) => String(p.programaId) === programaId);

  return (
    <div className="space-y-5">
      <SectionHeader title="Becas" subtitle="Becas y descuentos de sus hijos, y solicitudes a los programas del colegio" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}

      {datos && datos.hijos.length === 0 && (
        <EmptyState icon={<Award className="w-10 h-10" />} title="Sin alumnos asociados" description="Su usuario no tiene alumnos registrados." />
      )}

      {datos?.hijos.map((hijo) => {
        const tieneVigenteOSolicitud = hijo.becas.some((b) => ["Activa", "Suspendida", "Solicitada"].includes(b.estado) && b.anioLectivo >= new Date().getFullYear());
        const d = hijo.descuento;
        return (
          <Card key={hijo.alumnoId} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-stone-100 textile-pattern-light">
              <div>
                <p className="font-display text-lg font-semibold text-stone-900">{hijo.nombre}</p>
                <p className="text-sm text-stone-500">{hijo.grado}</p>
              </div>
              {datos.puedeSolicitar && hijo.programasDisponibles.length > 0 && !tieneVigenteOSolicitud && (
                <Btn variant="primary" size="sm" icon={<Send className="w-4 h-4" />} onClick={() => abrirSolicitud(hijo)}>Solicitar beca</Btn>
              )}
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Descuento vigente sobre la colegiatura */}
              <div className="rounded-xl border border-stone-200 p-4 bg-sand-50">
                <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Colegiatura este mes</p>
                <p className="font-display text-3xl font-semibold text-primary-700 mt-1">{formatQ(colegiatura * (1 - d.total / 100))}</p>
                <dl className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between"><dt className="text-stone-500">Colegiatura base</dt><dd className="font-mono-data">{formatQ(colegiatura)}</dd></div>
                  {d.beca > 0 && <div className="flex justify-between"><dt className="text-stone-500">Beca {d.programa ? `(${d.programa})` : ""}</dt><dd className="font-mono-data text-success-700">−{d.beca}%</dd></div>}
                  {d.hermanos > 0 && <div className="flex justify-between"><dt className="text-stone-500 flex items-center gap-1"><Users2 className="w-3.5 h-3.5" />Hermanos</dt><dd className="font-mono-data text-success-700">−{d.hermanos}%</dd></div>}
                  {d.topeAplicado && <p className="text-xs text-warning-700">Se aplicó el tope de descuento combinado: {d.total}%.</p>}
                  {d.total === 0 && <p className="text-xs text-stone-500">Sin descuentos vigentes.</p>}
                  {d.total >= 100 && <p className="text-xs text-success-700 font-medium">Colegiatura exonerada.</p>}
                </dl>
              </div>

              {/* Becas del alumno */}
              <div className="lg:col-span-2">
                <p className="text-sm font-semibold text-stone-700 mb-2">Becas y solicitudes</p>
                {hijo.becas.length === 0 ? (
                  <p className="text-sm text-stone-500">No tiene becas registradas.</p>
                ) : (
                  <ul className="divide-y divide-stone-100 border border-stone-200 rounded-xl">
                    {hijo.becas.map((b) => {
                      const ultimo = b.historial[0];
                      return (
                        <li key={b.becaId} className="px-4 py-3 flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-stone-900 text-sm">{b.programa?.nombre ?? b.descripcion ?? "Beca"}</p>
                              <Badge variant={ESTADO_BECA_BADGE[b.estado]}>{b.estado}</Badge>
                            </div>
                            <p className="text-xs text-stone-500 mt-0.5">
                              {Number(b.porcentaje)}% · Ciclo {b.anioLectivo} · {formatFecha(b.fechaInicio)} – {formatFecha(b.fechaFin)}
                            </p>
                            {ultimo && b.estado !== "Activa" && <p className="text-xs text-stone-600 mt-1">{ultimo.motivo}</p>}
                          </div>
                          <button onClick={() => setHistorialDe(b)} className="text-xs text-primary-700 hover:underline flex items-center gap-1 cursor-pointer shrink-0">
                            <History className="w-3.5 h-3.5" /> Historial
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {datos.puedeSolicitar && hijo.programasDisponibles.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-stone-700 mb-2">Programas disponibles en su sede</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {hijo.programasDisponibles.map((p) => (
                        <div key={p.programaId} className="rounded-lg border border-stone-200 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium text-stone-900">{p.nombre}</p>
                            <span className="font-mono-data text-sm text-primary-700">{Number(p.porcentaje)}%</span>
                          </div>
                          <p className="text-xs text-stone-500">
                            {TIPO_PROGRAMA_LABEL[p.tipo]} · Ciclo {p.anioLectivo} ·{" "}
                            {p.cuposDisponibles === null ? "cupos abiertos" : p.cuposDisponibles === 0 ? <span className="text-danger-700">sin cupos</span> : `${p.cuposDisponibles} cupos`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}

      <Drawer
        open={!!solicitandoPara}
        onClose={() => { if (!enviando) setSolicitandoPara(null); }}
        title="Solicitar beca"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setSolicitandoPara(null)} disabled={enviando}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={enviando} icon={<Send className="w-4 h-4" />} onClick={enviar}>Enviar solicitud</Btn>
          </>
        }
      >
        {solicitandoPara && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">Solicitud para <strong>{solicitandoPara.nombre}</strong> ({solicitandoPara.grado}).</p>
            {formError && <AlertBanner type="error" message={formError} />}

            <Select label="Programa" value={programaId} onChange={(e) => setProgramaId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {solicitandoPara.programasDisponibles.map((p) => (
                <option key={p.programaId} value={p.programaId} disabled={p.cuposDisponibles === 0}>
                  {p.nombre} — {Number(p.porcentaje)}% (ciclo {p.anioLectivo}){p.cuposDisponibles === 0 ? " — sin cupos" : ""}
                </option>
              ))}
            </Select>

            {programaElegido && (
              <div className="rounded-lg bg-sand-50 border border-stone-200 p-3 text-xs text-stone-600 space-y-1.5">
                {programaElegido.descripcion && <p>{programaElegido.descripcion}</p>}
                <p className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" />
                  {programaElegido.promedioMinimo === null ? "No exige promedio mínimo." : `Exige promedio mínimo de ${Number(programaElegido.promedioMinimo)} para obtenerla y mantenerla.`}
                </p>
                {programaElegido.pierdePorConductaGrave && (
                  <p className="flex items-center gap-1.5"><ShieldAlert className="w-3.5 h-3.5" />Se suspende si el alumno recibe un reporte de conducta grave.</p>
                )}
                <p>Con esta beca la colegiatura quedaría en <strong className="text-primary-700">{formatQ(colegiatura * (1 - Number(programaElegido.porcentaje) / 100))}</strong> al mes.</p>
              </div>
            )}

            <Textarea label="¿Por qué solicita la beca?" rows={5} value={justificacion} onChange={(e) => setJustificacion(e.target.value)}
              placeholder="Describa la situación de la familia o los logros del alumno. La administración podrá pedirle documentos de respaldo." />
            <p className="text-xs text-stone-500">La administración de la sede revisará la solicitud y le notificaremos la resolución por correo.</p>
          </div>
        )}
      </Drawer>

      <Drawer open={!!historialDe} onClose={() => setHistorialDe(null)} title="Historial de la beca">
        {historialDe && (
          <div className="space-y-4">
            <div>
              <p className="font-semibold text-stone-900">{historialDe.programa?.nombre ?? "Beca"}</p>
              <p className="text-sm text-stone-500">{Number(historialDe.porcentaje)}% · Ciclo {historialDe.anioLectivo}</p>
            </div>
            <HistorialBeca historial={historialDe.historial} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

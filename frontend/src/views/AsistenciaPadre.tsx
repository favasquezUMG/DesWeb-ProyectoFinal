import { useEffect, useState } from "react";
import { CalendarX2, CheckCircle2, Clock, FileCheck2, Send, Trash2, XCircle } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal, Input, Textarea, EmptyState, MetricCard } from "../components/Ui";
import {
  getAsistenciaHijos, solicitarJustificacion, cancelarJustificacion,
  type AsistenciaHijoDto, type EstadoAsistencia, type JustificacionDto,
} from "../lib/api";

const ESTADO_CLASE: Record<EstadoAsistencia, { variant: "success" | "warning" | "danger" | "info"; label: string }> = {
  Presente: { variant: "success", label: "Presente" },
  Tarde: { variant: "warning", label: "Tarde" },
  Ausente: { variant: "danger", label: "Ausente" },
  Justificado: { variant: "info", label: "Justificado" },
};

const ESTADO_SOLICITUD = {
  Pendiente: { variant: "neutral", icon: <Clock className="w-3 h-3" />, label: "En revisión" },
  Aprobada: { variant: "success", icon: <CheckCircle2 className="w-3 h-3" />, label: "Justificada" },
  Rechazada: { variant: "danger", icon: <XCircle className="w-3 h-3" />, label: "Rechazada" },
} as const;

const formatDia = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
};

function hoyISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface Solicitud { hijo: AsistenciaHijoDto; fecha: string; fechaFija: boolean }

export default function AsistenciaPadre() {
  const [hijos, setHijos] = useState<AsistenciaHijoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [solicitud, setSolicitud] = useState<Solicitud | null>(null);
  const [motivo, setMotivo] = useState("");
  const [formError, setFormError] = useState("");
  const [enviando, setEnviando] = useState(false);

  const [aRetirar, setARetirar] = useState<JustificacionDto | null>(null);
  const [retirando, setRetirando] = useState(false);

  const cargar = () => getAsistenciaHijos().then(setHijos);

  useEffect(() => {
    let cancelled = false;
    getAsistenciaHijos()
      .then((data) => { if (!cancelled) setHijos(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudo cargar la asistencia."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function abrir(hijo: AsistenciaHijoDto, fecha?: string) {
    setSolicitud({ hijo, fecha: fecha ?? hoyISO(), fechaFija: !!fecha });
    setMotivo("");
    setFormError("");
  }

  async function handleEnviar() {
    if (!solicitud) return;
    if (!solicitud.fecha || !motivo.trim()) {
      setFormError("Indique la fecha y el motivo de la ausencia.");
      return;
    }
    setEnviando(true);
    setFormError("");
    try {
      const res = await solicitarJustificacion({ alumnoId: solicitud.hijo.alumnoId, fecha: solicitud.fecha, motivo: motivo.trim() });
      setExito(res.message);
      setSolicitud(null);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  async function handleRetirar() {
    if (!aRetirar) return;
    setRetirando(true);
    try {
      await cancelarJustificacion(aRetirar.justificacionId);
      setARetirar(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo retirar la solicitud.");
      setARetirar(null);
    } finally {
      setRetirando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando asistencia…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Asistencia" subtitle="Faltas y tardanzas de sus hijos, y justificación de ausencias" />
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}

      {hijos.length === 0 && (
        <EmptyState icon={<CalendarX2 className="w-10 h-10" />} title="Sin información" description="No hay alumnos vinculados a su cuenta con acceso a la información académica." />
      )}

      {hijos.map((hijo) => {
        const porFecha = new Map(hijo.justificaciones.map((j) => [j.fecha, j]));
        // Días con faltas + solicitudes de días sin registro (ausencias avisadas con anticipación)
        const fechas = [...new Set([...hijo.dias.map((d) => d.fecha), ...hijo.justificaciones.map((j) => j.fecha)])].sort().reverse();
        const clasesDe = new Map(hijo.dias.map((d) => [d.fecha, d.clases]));
        const r = hijo.resumen;

        return (
          <Card key={hijo.alumnoId} className="overflow-hidden">
            <div className="p-5 border-b border-stone-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-display text-lg font-semibold text-stone-900">{hijo.nombre}</p>
                <p className="text-sm text-stone-500">{hijo.grado}</p>
              </div>
              <Btn variant="outline" size="sm" icon={<FileCheck2 className="w-4 h-4" />} onClick={() => abrir(hijo)}>
                Justificar una ausencia
              </Btn>
            </div>

            <div className="p-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard label="Asistencia" value={`${r.porcentaje}%`} variant={r.porcentaje >= 80 ? "success" : "warning"} />
              <MetricCard label="Faltas" value={r.ausentes} sub="sin justificar" />
              <MetricCard label="Justificadas" value={r.justificados} />
              <MetricCard label="Tardanzas" value={r.tardes} />
            </div>

            <div className="px-5 pb-5">
              {fechas.length === 0 ? (
                <p className="text-sm text-stone-500 flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-success-600" />Sin faltas ni tardanzas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {fechas.map((fecha) => {
                    const clases = clasesDe.get(fecha) ?? [];
                    const j = porFecha.get(fecha);
                    const tieneFaltas = clases.some((c) => c.estado === "Ausente");
                    const puedeSolicitar = tieneFaltas && (!j || j.estado === "Rechazada");
                    return (
                      <div key={fecha} className="p-3 bg-stone-50 border border-stone-100 rounded-xl">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 capitalize">{formatDia(fecha)}</p>
                            {clases.length > 0 ? (
                              <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {clases.map((c, i) => (
                                  <Badge key={i} variant={ESTADO_CLASE[c.estado].variant}>{c.curso}: {ESTADO_CLASE[c.estado].label}</Badge>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-stone-500 mt-1">Ausencia avisada con anticipación.</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {j && (
                              <Badge variant={ESTADO_SOLICITUD[j.estado].variant}>{ESTADO_SOLICITUD[j.estado].icon}{ESTADO_SOLICITUD[j.estado].label}</Badge>
                            )}
                            {puedeSolicitar && (
                              <Btn variant="secondary" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => abrir(hijo, fecha)}>
                                {j ? "Volver a solicitar" : "Justificar"}
                              </Btn>
                            )}
                            {j?.estado === "Pendiente" && (
                              <button onClick={() => setARetirar(j)} className="p-1.5 text-stone-400 hover:text-danger-700 rounded cursor-pointer" aria-label="Retirar solicitud">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {j && (
                          <div className="mt-2 text-xs text-stone-600 space-y-1">
                            <p><span className="font-medium">Motivo:</span> {j.motivo}</p>
                            {j.comentario && <p><span className="font-medium">Respuesta de la sede:</span> {j.comentario}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        );
      })}

      <Modal
        open={!!solicitud}
        onClose={() => { if (!enviando) setSolicitud(null); }}
        title="Justificar ausencia"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setSolicitud(null)} disabled={enviando}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={enviando} icon={<Send className="w-4 h-4" />} onClick={handleEnviar}>Enviar solicitud</Btn>
          </>
        }
      >
        {solicitud && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              La justificación aplica a todas las clases de <strong>{solicitud.hijo.nombre}</strong> en ese día.
              La administración de la sede la revisará y le avisaremos por correo.
            </p>
            {formError && <AlertBanner type="error" message={formError} />}
            <Input label="Fecha de la ausencia" type="date" value={solicitud.fecha} disabled={solicitud.fechaFija}
              hint="Puede justificar faltas del último mes o avisar de una ausencia del próximo mes."
              onChange={(e) => setSolicitud((s) => (s ? { ...s, fecha: e.target.value } : s))} />
            <Textarea label="Motivo" rows={4} maxLength={500} value={motivo}
              placeholder="Ej. Cita médica en el IGSS; presentaré la constancia en secretaría."
              onChange={(e) => setMotivo(e.target.value)} />
          </div>
        )}
      </Modal>

      <Modal
        open={!!aRetirar}
        onClose={() => { if (!retirando) setARetirar(null); }}
        title="Retirar solicitud"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setARetirar(null)} disabled={retirando}>Cancelar</Btn>
            <Btn variant="destructive" size="sm" loading={retirando} onClick={handleRetirar}>Retirar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">¿Retirar la solicitud de justificación del <strong>{aRetirar ? formatDia(aRetirar.fecha) : ""}</strong>?</p>
      </Modal>
    </div>
  );
}

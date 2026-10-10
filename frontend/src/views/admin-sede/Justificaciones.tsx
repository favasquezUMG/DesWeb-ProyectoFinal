import { useEffect, useState } from "react";
import { CheckCircle2, FileCheck2, XCircle } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal, Tabs, Textarea, EmptyState } from "../../components/Ui";
import { getJustificaciones, revisarJustificacion, type EstadoJustificacion, type JustificacionAdminDto } from "../../lib/api";

const TABS: Array<{ label: string; estado: EstadoJustificacion }> = [
  { label: "Pendientes", estado: "Pendiente" },
  { label: "Aprobadas", estado: "Aprobada" },
  { label: "Rechazadas", estado: "Rechazada" },
];

const formatDia = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleString("es-GT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function JustificacionesView() {
  const [tab, setTab] = useState(TABS[0].label);
  const [lista, setLista] = useState<JustificacionAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [revision, setRevision] = useState<{ j: JustificacionAdminDto; aprobar: boolean } | null>(null);
  const [comentario, setComentario] = useState("");
  const [formError, setFormError] = useState("");
  const [guardando, setGuardando] = useState(false);

  const estado = TABS.find((t) => t.label === tab)!.estado;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJustificaciones(estado)
      .then((data) => { if (!cancelled) setLista(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar las solicitudes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [estado]);

  function abrir(j: JustificacionAdminDto, aprobar: boolean) {
    setRevision({ j, aprobar });
    setComentario("");
    setFormError("");
  }

  async function handleRevisar() {
    if (!revision) return;
    if (!revision.aprobar && !comentario.trim()) {
      setFormError("Indique el motivo del rechazo; el encargado lo verá.");
      return;
    }
    setGuardando(true);
    setFormError("");
    try {
      const res = await revisarJustificacion(revision.j.justificacionId, revision.aprobar ? "Aprobada" : "Rechazada", comentario.trim() || undefined);
      setExito(res.message);
      setLista((prev) => prev.filter((x) => x.justificacionId !== revision.j.justificacionId));
      setRevision(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la revisión.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Justificación de ausencias" subtitle="Solicitudes de los encargados para justificar las faltas de un día" />
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}

      <Tabs tabs={TABS.map((t) => t.label)} active={tab} onChange={(t) => { setTab(t); setExito(""); }} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
          Cargando solicitudes…
        </div>
      ) : lista.length === 0 ? (
        <EmptyState icon={<FileCheck2 className="w-10 h-10" />} title="Sin solicitudes" description={estado === "Pendiente" ? "No hay solicitudes por revisar." : "No hay solicitudes en esta categoría."} />
      ) : (
        <div className="space-y-3">
          {lista.map((j) => (
            <Card key={j.justificacionId} className="p-4">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                <div className="min-w-0 space-y-1.5">
                  <p className="font-semibold text-stone-900">
                    {j.alumno.usuario.nombres} {j.alumno.usuario.apellidos}
                    <span className="font-normal text-stone-500 text-sm"> · {j.alumno.seccion.grado.nombre} "{j.alumno.seccion.nombre}"</span>
                  </p>
                  <p className="text-sm text-stone-700 capitalize">{formatDia(j.fecha)}</p>
                  <p className="text-sm text-stone-600 whitespace-pre-line"><span className="font-medium">Motivo:</span> {j.motivo}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {j.clases.length === 0 ? (
                      <span className="text-xs text-stone-500">Aún no hay asistencia registrada ese día (aviso anticipado).</span>
                    ) : j.clases.map((c, i) => (
                      <Badge key={i} variant={c.estado === "Ausente" ? "danger" : c.estado === "Justificado" ? "info" : c.estado === "Tarde" ? "warning" : "success"}>
                        {c.curso}: {c.estado}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-stone-400">
                    Solicitó {j.solicitante.nombres} {j.solicitante.apellidos} el {formatFechaHora(j.fechaSolicitud)}
                    {j.revisor && j.fechaRevision && <> · Revisó {j.revisor.nombres} {j.revisor.apellidos} el {formatFechaHora(j.fechaRevision)}</>}
                  </p>
                  {j.comentario && <p className="text-xs text-stone-600"><span className="font-medium">Comentario:</span> {j.comentario}</p>}
                </div>
                {j.estado === "Pendiente" && (
                  <div className="flex gap-2 shrink-0">
                    <Btn variant="outline" size="sm" icon={<XCircle className="w-4 h-4" />} onClick={() => abrir(j, false)}>Rechazar</Btn>
                    <Btn variant="primary" size="sm" icon={<CheckCircle2 className="w-4 h-4" />} onClick={() => abrir(j, true)}>Aprobar</Btn>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!revision}
        onClose={() => { if (!guardando) setRevision(null); }}
        title={revision?.aprobar ? "Aprobar justificación" : "Rechazar justificación"}
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setRevision(null)} disabled={guardando}>Cancelar</Btn>
            <Btn variant={revision?.aprobar ? "primary" : "destructive"} size="sm" loading={guardando} onClick={handleRevisar}>
              {revision?.aprobar ? "Aprobar" : "Rechazar"}
            </Btn>
          </>
        }
      >
        {revision && (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">
              {revision.aprobar
                ? <>Las faltas de <strong>{revision.j.alumno.usuario.nombres}</strong> del {formatDia(revision.j.fecha)} quedarán como justificadas, también las que se registren después ese día.</>
                : <>Se avisará al encargado que la justificación del {formatDia(revision.j.fecha)} no fue aceptada.</>}
            </p>
            {formError && <AlertBanner type="error" message={formError} />}
            <Textarea label={revision.aprobar ? "Comentario (opcional)" : "Motivo del rechazo"} rows={3} maxLength={300}
              value={comentario} onChange={(e) => setComentario(e.target.value)}
              placeholder={revision.aprobar ? "" : "Ej. Falta presentar la constancia médica."} />
          </div>
        )}
      </Modal>
    </div>
  );
}

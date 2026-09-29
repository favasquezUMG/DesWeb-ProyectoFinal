import { useEffect, useState } from "react";
import { Bell, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal, Tabs, EmptyState } from "../components/Ui";
import {
  getReportesConducta,
  revisarReporteConducta,
  getMisNotificaciones,
  marcarNotificacionLeida,
  type ReporteConductaDto,
  type NotificacionDto,
} from "../lib/api";
import { tipoConductaVariant, formatFecha } from "../lib/conducta";

function ReporteCard({ reporte, onRevisar }: { reporte: ReporteConductaDto; onRevisar?: () => void }) {
  return (
    <Card className={`p-4 ${!reporte.revisado && reporte.tipo !== "Positivo" ? "border-warning-300" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <Badge variant={tipoConductaVariant(reporte.tipo)}>{reporte.tipo}</Badge>
            <p className="font-semibold text-stone-900 text-sm">{reporte.titulo}</p>
          </div>
          <p className="text-xs text-stone-500 mb-2">
            {reporte.alumno.usuario.nombres} {reporte.alumno.usuario.apellidos} · Reportado por {reporte.autor.nombres} {reporte.autor.apellidos} · {formatFecha(reporte.fecha)}
          </p>
          <p className="text-sm text-stone-600 whitespace-pre-line">{reporte.descripcion}</p>
          {reporte.revisado && (
            <p className="text-xs text-success-700 mt-2 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Revisado el {reporte.fechaRevision ? formatFecha(reporte.fechaRevision) : ""}
              {reporte.comentarioEncargado && <span className="text-stone-600"> · "{reporte.comentarioEncargado}"</span>}
            </p>
          )}
        </div>
        {onRevisar && (
          <Btn variant="primary" size="sm" className="shrink-0" onClick={onRevisar}>Marcar como revisado</Btn>
        )}
      </div>
    </Card>
  );
}

function ConductaTab() {
  const [reportes, setReportes] = useState<ReporteConductaDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [target, setTarget] = useState<ReporteConductaDto | null>(null);
  const [comentario, setComentario] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getReportesConducta()
      .then((data) => { if (!cancelled) setReportes(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleRevisar() {
    if (!target) return;
    setSaving(true);
    try {
      const actualizado = await revisarReporteConducta(target.reporteId, comentario.trim() || undefined);
      setReportes((prev) => prev.map((r) => (r.reporteId === actualizado.reporteId ? actualizado : r)));
      setTarget(null);
      setComentario("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo marcar el reporte como revisado.");
      setTarget(null);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando reportes…
      </div>
    );
  }

  const pendientes = reportes.filter((r) => !r.revisado);
  const revisados = reportes.filter((r) => r.revisado);

  return (
    <div className="space-y-4">
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      {pendientes.length > 0 && (
        <AlertBanner
          type="warning"
          title={`${pendientes.length} reporte(s) pendiente(s) de revisión`}
          message="Lea cada reporte y márquelo como revisado. Puede dejar un comentario para el catedrático."
        />
      )}

      {reportes.length === 0 && (
        <EmptyState icon={<ShieldAlert className="w-10 h-10" />} title="Sin reportes de conducta" description="No hay reportes registrados para sus hijos." />
      )}

      {pendientes.map((r) => (
        <ReporteCard key={r.reporteId} reporte={r} onRevisar={() => { setTarget(r); setComentario(""); }} />
      ))}

      {revisados.length > 0 && (
        <>
          <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider pt-2">Revisados</h3>
          {revisados.map((r) => <ReporteCard key={r.reporteId} reporte={r} />)}
        </>
      )}

      <Modal
        open={!!target}
        onClose={() => { if (!saving) setTarget(null); }}
        title="Confirmar revisión"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setTarget(null)} disabled={saving}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={saving} onClick={handleRevisar}>Confirmar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600 mb-3">
          Confirma que leyó el reporte <strong>{target?.titulo}</strong>.
        </p>
        <label className="text-sm font-medium text-stone-700 block mb-1">Comentario para el catedrático (opcional)</label>
        <textarea
          rows={3}
          maxLength={500}
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 resize-none"
          placeholder="Ej. Ya hablamos con él en casa."
        />
      </Modal>
    </div>
  );
}

function NotificacionesTab() {
  const [notificaciones, setNotificaciones] = useState<NotificacionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getMisNotificaciones()
      .then((data) => { if (!cancelled) setNotificaciones(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los avisos."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  async function handleLeida(n: NotificacionDto) {
    if (n.leida) return;
    setNotificaciones((prev) => prev.map((x) => (x.notificacionId === n.notificacionId ? { ...x, leida: true } : x)));
    try {
      await marcarNotificacionLeida(n.notificacionId);
    } catch {
      setNotificaciones((prev) => prev.map((x) => (x.notificacionId === n.notificacionId ? { ...x, leida: false } : x)));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando avisos…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {notificaciones.length === 0 && (
        <EmptyState icon={<Bell className="w-10 h-10" />} title="Sin avisos" description="Aquí aparecerán los comunicados, recordatorios y notas que le envíe el colegio." />
      )}
      {notificaciones.map((n) => (
        <Card key={n.notificacionId} className={`p-4 flex items-start gap-4 ${n.leida ? "" : "border-primary-200 bg-primary-50/30"}`}>
          <div className={`p-2 rounded-lg shrink-0 ${n.tipo === "Sancion" || n.tipo === "Conducta" ? "bg-danger-50 text-danger-700" : n.tipo === "Evento" || n.tipo === "Asueto" ? "bg-warning-50 text-warning-700" : "bg-info-50 text-info-700"}`}>
            {n.tipo === "Conducta" ? <AlertTriangle className="w-4 h-4" /> : <Bell className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-1">
              <p className={`text-sm text-stone-900 ${n.leida ? "font-medium" : "font-semibold"}`}>{n.titulo}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="neutral">{n.tipo}</Badge>
                <span className="text-xs text-stone-400">{formatFecha(n.fechaEnvio)}</span>
              </div>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">{n.mensaje}</p>
            {!n.leida && (
              <button onClick={() => handleLeida(n)} className="text-xs text-primary-700 hover:underline mt-1.5">Marcar como leído</button>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default function AvisosPadre() {
  const [tab, setTab] = useState("Conducta");

  return (
    <div className="space-y-5">
      <SectionHeader title="Avisos y Conducta" subtitle="Reportes de conducta de sus hijos y avisos enviados por el colegio" />
      <Tabs tabs={["Conducta", "Avisos recibidos"]} active={tab} onChange={setTab} />
      {tab === "Conducta" ? <ConductaTab /> : <NotificacionesTab />}
    </div>
  );
}

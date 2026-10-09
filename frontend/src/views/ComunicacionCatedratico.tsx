import { useEffect, useState } from "react";
import { Plus, Send, Trash2, CheckCircle2, Clock, Mail } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal, Tabs, EmptyState } from "../components/Ui";
import { getSession } from "../lib/auth";
import {
  getCursosDeCatedratico,
  getAlumnos,
  getReportesConducta,
  createReporteConducta,
  deleteReporteConducta,
  enviarNotasAEncargados,
  type CursoSeccionDto,
  type AlumnoDto,
  type ReporteConductaDto,
  type TipoConducta,
} from "../lib/api";
import { TIPOS_CONDUCTA, tipoConductaVariant, formatFecha } from "../lib/conducta";

const nombreCurso = (c: CursoSeccionDto) => `${c.curso.nombre} — ${c.seccion.grado.nombre} "${c.seccion.nombre}"`;

const INPUT_CLS = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700";

interface FormState {
  seccionId: string;
  alumnoId: string;
  tipo: TipoConducta;
  titulo: string;
  descripcion: string;
}

const emptyForm = (): FormState => ({ seccionId: "", alumnoId: "", tipo: "Leve", titulo: "", descripcion: "" });

function ReportesConductaTab({ cursos }: { cursos: CursoSeccionDto[] }) {
  const [reportes, setReportes] = useState<ReporteConductaDto[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<ReporteConductaDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Un catedrático puede dar varios cursos en la misma sección; se listan secciones únicas
  const secciones = [...new Map(cursos.map((c) => [c.seccionId, c.seccion])).values()];

  useEffect(() => {
    let cancelled = false;
    getReportesConducta()
      .then((data) => { if (!cancelled) setReportes(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!form.seccionId) { setAlumnos([]); return; }
    let cancelled = false;
    getAlumnos({ seccionId: Number(form.seccionId) })
      .then((data) => { if (!cancelled) setAlumnos(data); })
      .catch(() => { if (!cancelled) setAlumnos([]); });
    return () => { cancelled = true; };
  }, [form.seccionId]);

  async function handleSubmit() {
    if (!form.alumnoId || !form.titulo.trim() || !form.descripcion.trim()) {
      setFormError("Seleccione un alumno y complete el título y la descripción.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const res = await createReporteConducta({
        alumnoId: Number(form.alumnoId),
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion.trim(),
      });
      setReportes((prev) => [res.data, ...prev]);
      setSuccessMessage(res.message);
      setShowForm(false);
      setForm(emptyForm());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo crear el reporte.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteReporteConducta(deleteTarget.reporteId);
      setReportes((prev) => prev.filter((r) => r.reporteId !== deleteTarget.reporteId));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el reporte.");
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowForm(true); setFormError(""); }}>
          Nuevo reporte
        </Btn>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMessage && <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}

      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-1">Nuevo reporte de conducta</h3>
          <p className="text-xs text-stone-500 mb-4">Se enviará por correo a los encargados del alumno y quedará pendiente de su revisión.</p>

          {formError && <div className="mb-4"><AlertBanner type="error" message={formError} /></div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Sección</label>
              <select className={INPUT_CLS} value={form.seccionId}
                onChange={(e) => setForm((f) => ({ ...f, seccionId: e.target.value, alumnoId: "" }))}>
                <option value="">Seleccionar sección…</option>
                {secciones.map((s) => (
                  <option key={s.seccionId} value={s.seccionId}>{s.grado.nombre} "{s.nombre}"</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Alumno</label>
              <select className={INPUT_CLS} value={form.alumnoId} disabled={!form.seccionId}
                onChange={(e) => setForm((f) => ({ ...f, alumnoId: e.target.value }))}>
                <option value="">Seleccionar alumno…</option>
                {alumnos.map((a) => (
                  <option key={a.alumnoId} value={a.alumnoId}>{a.usuario.nombres} {a.usuario.apellidos}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Tipo</label>
              <select className={INPUT_CLS} value={form.tipo}
                onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoConducta }))}>
                {TIPOS_CONDUCTA.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-stone-700 block mb-1">Título</label>
              <input className={INPUT_CLS} maxLength={150} value={form.titulo} placeholder="Ej. Uso del celular en clase"
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className="text-sm font-medium text-stone-700 block mb-1">Descripción</label>
              <textarea rows={4} maxLength={1000} className={`${INPUT_CLS} resize-none`} value={form.descripcion}
                placeholder="Describa lo sucedido y, si aplica, qué se espera del encargado…"
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Btn variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={submitting}>Cancelar</Btn>
            <Btn variant="secondary" size="sm" loading={submitting} icon={<Send className="w-4 h-4" />} onClick={handleSubmit}>
              Enviar reporte
            </Btn>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
          Cargando reportes…
        </div>
      ) : reportes.length === 0 ? (
        <EmptyState icon={<Mail className="w-10 h-10" />} title="Sin reportes" description="Aún no ha enviado reportes de conducta." />
      ) : (
        <div className="space-y-3">
          {reportes.map((r) => (
            <Card key={r.reporteId} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant={tipoConductaVariant(r.tipo)}>{r.tipo}</Badge>
                    <p className="font-semibold text-stone-900 text-sm">{r.titulo}</p>
                  </div>
                  <p className="text-xs text-stone-500 mb-2">
                    {r.alumno.usuario.nombres} {r.alumno.usuario.apellidos} · {r.alumno.seccion.grado.nombre} "{r.alumno.seccion.nombre}" · {formatFecha(r.fecha)}
                  </p>
                  <p className="text-sm text-stone-600 whitespace-pre-line">{r.descripcion}</p>
                  {r.comentarioEncargado && (
                    <p className="text-sm text-stone-700 mt-2 bg-stone-50 border border-stone-100 rounded-lg p-2">
                      <span className="font-medium">Comentario del encargado:</span> {r.comentarioEncargado}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {r.revisado ? (
                    <Badge variant="success"><CheckCircle2 className="w-3 h-3" />Revisado</Badge>
                  ) : (
                    <Badge variant="neutral"><Clock className="w-3 h-3" />Pendiente</Badge>
                  )}
                  <button onClick={() => setDeleteTarget(r)} className="p-1.5 text-stone-400 hover:text-danger-700 rounded transition-colors" aria-label="Eliminar reporte">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        onClose={() => { if (!deleting) setDeleteTarget(null); }}
        title="Eliminar reporte"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancelar</Btn>
            <Btn variant="destructive" size="sm" loading={deleting} onClick={handleDelete}>Eliminar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          ¿Eliminar el reporte <strong>{deleteTarget?.titulo}</strong>? Los encargados ya recibieron el correo; esto solo lo quita del sistema.
        </p>
      </Modal>
    </div>
  );
}

function EnviarNotasTab({ cursos }: { cursos: CursoSeccionDto[] }) {
  const [target, setTarget] = useState<CursoSeccionDto | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function handleEnviar() {
    if (!target) return;
    setSending(true);
    setError("");
    try {
      const res = await enviarNotasAEncargados({ cursoSeccionId: target.cursoSeccionId });
      const sinEncargado = res.data.alumnosSinEncargado;
      setSuccessMessage(
        sinEncargado.length > 0
          ? `${res.message} Sin encargado registrado: ${sinEncargado.join(", ")}.`
          : res.message
      );
      setTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar las notas.");
      setTarget(null);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500">
        Envía por correo a cada encargado las notas de su hijo en el curso seleccionado (punteo por unidad y total).
      </p>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMessage && <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}

      {cursos.length === 0 ? (
        <EmptyState title="Sin cursos asignados" description="No tiene cursos asignados en el ciclo actual." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cursos.map((c) => (
            <Card key={c.cursoSeccionId} className="p-4 flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-stone-900 text-sm">{c.curso.nombre}</p>
                <p className="text-xs text-stone-500">{c.seccion.grado.nombre} "{c.seccion.nombre}"</p>
              </div>
              <Btn variant="outline" size="sm" icon={<Send className="w-3.5 h-3.5" />} onClick={() => setTarget(c)}>
                Enviar notas
              </Btn>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={!!target}
        onClose={() => { if (!sending) setTarget(null); }}
        title="Enviar notas a encargados"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setTarget(null)} disabled={sending}>Cancelar</Btn>
            <Btn variant="secondary" size="sm" loading={sending} icon={<Send className="w-4 h-4" />} onClick={handleEnviar}>Enviar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Se enviará un correo a los encargados de todos los alumnos de <strong>{target ? nombreCurso(target) : ""}</strong> con
          las notas registradas hasta hoy. ¿Desea continuar?
        </p>
      </Modal>
    </div>
  );
}

export default function ComunicacionCatedratico() {
  const [tab, setTab] = useState("Reportes de conducta");
  const [cursos, setCursos] = useState<CursoSeccionDto[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const catedraticoId = Number(getSession()?.user.id);
    if (!catedraticoId) return;
    let cancelled = false;
    getCursosDeCatedratico(catedraticoId)
      .then((data) => { if (!cancelled) setCursos(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar sus cursos."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader title="Comunicación con padres" subtitle="Reportes de conducta y envío de notas por correo a los encargados" />
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      <Tabs tabs={["Reportes de conducta", "Enviar notas"]} active={tab} onChange={setTab} />
      {tab === "Reportes de conducta" ? <ReportesConductaTab cursos={cursos} /> : <EnviarNotasTab cursos={cursos} />}
    </div>
  );
}

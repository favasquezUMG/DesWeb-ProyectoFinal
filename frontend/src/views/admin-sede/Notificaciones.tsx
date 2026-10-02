import { useEffect, useState } from "react";
import { Plus, Bell, Send, FileText } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal } from "../../components/Ui";
import {
  getComunicados,
  enviarComunicado,
  enviarNotasAEncargados,
  getAlumnos,
  type ComunicadoDto,
  type TipoComunicado,
  type DestinoComunicado,
  type AlumnoDto,
} from "../../lib/api";
import { formatFecha } from "../../lib/conducta";

const TIPOS: { value: TipoComunicado; label: string; variant: "neutral" | "danger" | "info" | "warning" }[] = [
  { value: "Aviso", label: "Aviso general", variant: "neutral" },
  { value: "Sancion", label: "Sanción", variant: "danger" },
  { value: "Actividad", label: "Actividad", variant: "info" },
  { value: "Asueto", label: "Asueto", variant: "warning" },
];

const DESTINOS: { value: DestinoComunicado; label: string }[] = [
  { value: "todos", label: "Toda la sede" },
  { value: "encargados", label: "Padres y encargados" },
  { value: "catedraticos", label: "Catedráticos" },
  { value: "alumnos", label: "Alumnos" },
  { value: "seccion", label: "Encargados de una sección…" },
];

const INPUT_CLS = "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700";

type Seccion = AlumnoDto["seccion"];

interface FormState {
  tipo: TipoComunicado;
  titulo: string;
  destino: DestinoComunicado;
  seccionId: string;
  mensaje: string;
}

const emptyForm = (): FormState => ({ tipo: "Aviso", titulo: "", destino: "encargados", seccionId: "", mensaje: "" });

const nombreSeccion = (s: Seccion) => `${s.grado.nombre} "${s.nombre}"`;

export default function NotificacionesView() {
  const [comunicados, setComunicados] = useState<ComunicadoDto[]>([]);
  const [secciones, setSecciones] = useState<Seccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [sending, setSending] = useState(false);

  const [boletaSeccionId, setBoletaSeccionId] = useState("");
  const [confirmBoletas, setConfirmBoletas] = useState(false);
  const [sendingBoletas, setSendingBoletas] = useState(false);

  useEffect(() => {
    let cancelled = false;

    Promise.all([getComunicados(), getAlumnos()])
      .then(([comunicadosData, alumnosData]) => {
        if (cancelled) return;
        setComunicados(comunicadosData);
        const unicas = new Map(alumnosData.map((a) => [a.seccion.seccionId, a.seccion]));
        setSecciones([...unicas.values()].sort((a, b) => nombreSeccion(a).localeCompare(nombreSeccion(b))));
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los comunicados."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  async function handleEnviar() {
    if (!form.titulo.trim() || !form.mensaje.trim()) {
      setFormError("Complete el asunto y el mensaje.");
      return;
    }
    if (form.destino === "seccion" && !form.seccionId) {
      setFormError("Seleccione la sección.");
      return;
    }

    setSending(true);
    setFormError("");
    try {
      const res = await enviarComunicado({
        tipo: form.tipo,
        titulo: form.titulo.trim(),
        mensaje: form.mensaje.trim(),
        destino: form.destino,
        seccionId: form.destino === "seccion" ? Number(form.seccionId) : undefined,
      });
      setSuccessMessage(res.message);
      setShowForm(false);
      setForm(emptyForm());
      setComunicados(await getComunicados());
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo enviar el comunicado.");
    } finally {
      setSending(false);
    }
  }

  async function handleEnviarBoletas() {
    setSendingBoletas(true);
    setError("");
    try {
      const res = await enviarNotasAEncargados({ seccionId: Number(boletaSeccionId) });
      const sinEncargado = res.data.alumnosSinEncargado;
      setSuccessMessage(
        sinEncargado.length > 0 ? `${res.message} Sin encargado registrado: ${sinEncargado.join(", ")}.` : res.message
      );
      setBoletaSeccionId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron enviar las boletas.");
    } finally {
      setSendingBoletas(false);
      setConfirmBoletas(false);
    }
  }

  const seccionBoleta = secciones.find((s) => String(s.seccionId) === boletaSeccionId);

  return (
    <div className="space-y-5">
      <SectionHeader title="Notificaciones" subtitle="Envío de avisos, sanciones y comunicados por correo a la comunidad"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setShowForm(true); setFormError(""); }}>Redactar notificación</Btn>}
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMessage && <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}

      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">Nueva notificación</h3>
          {formError && <div className="mb-4"><AlertBanner type="error" message={formError} /></div>}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Tipo</label>
                <select className={INPUT_CLS} value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as TipoComunicado }))}>
                  {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Destinatarios</label>
                <select className={INPUT_CLS} value={form.destino} onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value as DestinoComunicado }))}>
                  {DESTINOS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            {form.destino === "seccion" && (
              <div>
                <label className="text-sm font-medium text-stone-700 block mb-1">Sección</label>
                <select className={INPUT_CLS} value={form.seccionId} onChange={(e) => setForm((f) => ({ ...f, seccionId: e.target.value }))}>
                  <option value="">Seleccionar sección…</option>
                  {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{nombreSeccion(s)}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Asunto</label>
              <input className={INPUT_CLS} maxLength={150} placeholder="Asunto del aviso" value={form.titulo}
                onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))} />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Mensaje</label>
              <textarea rows={4} maxLength={2000} className={`${INPUT_CLS} resize-none`} placeholder="Redacte el mensaje…" value={form.mensaje}
                onChange={(e) => setForm((f) => ({ ...f, mensaje: e.target.value }))} />
            </div>
            <div className="flex gap-2 justify-end">
              <Btn variant="outline" size="sm" onClick={() => setShowForm(false)} disabled={sending}>Cancelar</Btn>
              <Btn variant="secondary" size="sm" loading={sending} icon={<Send className="w-4 h-4" />} onClick={handleEnviar}>Enviar notificación</Btn>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-col md:flex-row md:items-end gap-3">
          <div className="flex-1">
            <h3 className="font-semibold text-stone-800 flex items-center gap-2 mb-1"><FileText className="w-4 h-4 text-stone-400" />Enviar boletas de notas</h3>
            <p className="text-xs text-stone-500 mb-3">Envía a cada encargado la boleta completa de su hijo (todos los cursos de la sección).</p>
            <select className={INPUT_CLS} value={boletaSeccionId} onChange={(e) => setBoletaSeccionId(e.target.value)}>
              <option value="">Seleccionar sección…</option>
              {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{nombreSeccion(s)}</option>)}
            </select>
          </div>
          <Btn variant="outline" size="md" icon={<Send className="w-4 h-4" />} disabled={!boletaSeccionId} onClick={() => setConfirmBoletas(true)}>
            Enviar boletas
          </Btn>
        </div>
      </Card>

      <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">Historial de envíos</h3>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
          <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
          Cargando comunicados…
        </div>
      ) : comunicados.length === 0 ? (
        <Card className="p-10 text-center text-sm text-stone-500">Aún no se han enviado comunicados.</Card>
      ) : (
        <div className="space-y-3">
          {comunicados.map((n) => {
            const tipo = TIPOS.find((t) => t.value === n.tipo);
            return (
              <Card key={n.comunicadoId} className="p-4 flex items-start gap-4">
                <div className={`p-2 rounded-lg shrink-0 ${n.tipo === "Sancion" ? "bg-danger-50 text-danger-700" : n.tipo === "Asueto" ? "bg-warning-50 text-warning-700" : "bg-info-50 text-info-700"}`}>
                  <Bell className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="font-semibold text-stone-900 text-sm">{n.titulo}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={tipo?.variant ?? "neutral"}>{tipo?.label ?? n.tipo}</Badge>
                      <span className="text-xs text-stone-400">{formatFecha(n.fechaEnvio)}</span>
                    </div>
                  </div>
                  <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{n.mensaje}</p>
                  <p className="text-xs text-stone-400 mt-1.5">
                    Destinatarios: {n.destinatarios} ({n.totalDestinatarios}) · {n.sede?.nombre ?? "Todas las sedes"} · Enviado por {n.autor.nombres} {n.autor.apellidos}
                  </p>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal
        open={confirmBoletas}
        onClose={() => { if (!sendingBoletas) setConfirmBoletas(false); }}
        title="Enviar boletas de notas"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setConfirmBoletas(false)} disabled={sendingBoletas}>Cancelar</Btn>
            <Btn variant="secondary" size="sm" loading={sendingBoletas} icon={<Send className="w-4 h-4" />} onClick={handleEnviarBoletas}>Enviar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          Se enviará la boleta con las notas registradas hasta hoy a los encargados de todos los alumnos de <strong>{seccionBoleta ? nombreSeccion(seccionBoleta) : ""}</strong>. ¿Desea continuar?
        </p>
      </Modal>
    </div>
  );
}

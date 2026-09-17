import { useEffect, useState } from "react";
import { Plus, Edit, Ban } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, TH, TD, AlertBanner, Modal } from "../../components/Ui";
import {
  getBecas,
  getAlumnos,
  createBeca,
  updateBeca,
  desactivarBeca,
  type BecaDto,
  type AlumnoDto,
} from "../../lib/api";

// ─── Becas ────────────────────────────────────────────────────────────────────

// El backend todavía no modela una mensualidad/pago recurrente por alumno,
// así que se usa el monto base estándar del colegio (el mismo que aparece en
// el módulo de Pagos) solo para mostrar el total estimado con descuento.
const MENSUALIDAD_BASE = 1250;

const MOTIVOS = ["Rendimiento académico", "Situación socioeconómica", "Hermano inscrito", "Hijo de catedrático", "Otro"];

function nombreAlumno(a: { usuario: { nombres: string; apellidos: string } }): string {
  return `${a.usuario.nombres} ${a.usuario.apellidos}`;
}

function gradoSeccion(s: { nombre: string; grado: { nombre: string } }): string {
  return `${s.grado.nombre} "${s.nombre}"`;
}

function formatMesAnio(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

interface FormState {
  alumnoId: string;
  porcentaje: string;
  descripcion: string;
  fechaInicio: string;
}

function emptyForm(): FormState {
  return {
    alumnoId: "",
    porcentaje: "10",
    descripcion: MOTIVOS[0],
    fechaInicio: new Date().toISOString().slice(0, 10),
  };
}

export default function BecasView() {
  const [becas, setBecas] = useState<BecaDto[]>([]);
  const [alumnos, setAlumnos] = useState<AlumnoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingBeca, setEditingBeca] = useState<BecaDto | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [confirmTarget, setConfirmTarget] = useState<BecaDto | null>(null);
  const [deactivating, setDeactivating] = useState(false);

  function loadBecas() {
    return getBecas({ activa: true }).then(setBecas);
  }

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    Promise.all([getBecas({ activa: true }), getAlumnos()])
      .then(([becasData, alumnosData]) => {
        if (cancelled) return;
        setBecas(becasData);
        setAlumnos(alumnosData);
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar las becas."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  function openCreateForm() {
    setEditingBeca(null);
    setForm(emptyForm());
    setFormError("");
    setShowForm(true);
  }

  function openEditForm(beca: BecaDto) {
    setEditingBeca(beca);
    setForm({
      alumnoId: String(beca.alumnoId),
      porcentaje: String(Number(beca.porcentaje)),
      descripcion: beca.descripcion ?? MOTIVOS[0],
      fechaInicio: beca.fechaInicio.slice(0, 10),
    });
    setFormError("");
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingBeca(null);
    setFormError("");
  }

  async function handleSubmit() {
    if (!form.alumnoId) {
      setFormError("Seleccione un alumno.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    try {
      const input = {
        alumnoId: Number(form.alumnoId),
        porcentaje: Number(form.porcentaje),
        descripcion: form.descripcion,
        fechaInicio: form.fechaInicio,
      };

      if (editingBeca) {
        await updateBeca(editingBeca.becaId, input);
        setSuccessMessage("Beca actualizada correctamente.");
      } else {
        await createBeca(input);
        setSuccessMessage("Beca asignada correctamente.");
      }

      closeForm();
      await loadBecas();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar la beca.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeactivate() {
    if (!confirmTarget) return;

    setDeactivating(true);
    setError("");
    try {
      const alumnoNombre = nombreAlumno(confirmTarget.alumno);
      await desactivarBeca(confirmTarget.becaId);
      setConfirmTarget(null);
      setSuccessMessage(`Se desactivó la beca de ${alumnoNombre}.`);
      await loadBecas();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo desactivar la beca.");
    } finally {
      setDeactivating(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Becas" subtitle="Descuentos sobre la mensualidad asignados a alumnos"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={openCreateForm}>Asignar beca</Btn>}
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {successMessage && <AlertBanner type="success" message={successMessage} onClose={() => setSuccessMessage("")} />}

      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">{editingBeca ? "Editar beca" : "Nueva beca"}</h3>

          {formError && <div className="mb-4"><AlertBanner type="error" message={formError} /></div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-stone-700 block mb-1">Alumno</label>
              <select
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
                value={form.alumnoId}
                onChange={(e) => setForm((f) => ({ ...f, alumnoId: e.target.value }))}
              >
                <option value="">Seleccionar alumno…</option>
                {alumnos.map((a) => (
                  <option key={a.alumnoId} value={a.alumnoId}>
                    {nombreAlumno(a)} — {gradoSeccion(a.seccion)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Porcentaje de descuento</label>
              <div className="relative">
                <input
                  type="number" min="5" max="100" step="5"
                  value={form.porcentaje}
                  onChange={(e) => setForm((f) => ({ ...f, porcentaje: e.target.value }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-stone-700 block mb-1">Motivo</label>
              <select
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
                value={form.descripcion}
                onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              >
                {MOTIVOS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Desde</label>
              <input
                type="date"
                value={form.fechaInicio}
                onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Btn variant="outline" size="sm" onClick={closeForm} disabled={submitting}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={submitting} onClick={handleSubmit}>
              {editingBeca ? "Guardar cambios" : "Asignar beca"}
            </Btn>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
            Cargando becas…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr><TH>Alumno</TH><TH>Grado</TH><TH>Descuento</TH><TH>Mensualidad</TH><TH>Total a pagar</TH><TH>Desde</TH><TH>Motivo</TH><TH className="text-right">Acciones</TH></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {becas.map((b) => {
                  const porcentaje = Number(b.porcentaje);
                  const total = MENSUALIDAD_BASE * (1 - porcentaje / 100);
                  return (
                    <tr key={b.becaId} className="hover:bg-stone-50 transition-colors">
                      <TD><p className="font-medium text-stone-900 text-sm">{nombreAlumno(b.alumno)}</p></TD>
                      <TD><span className="text-stone-600">{gradoSeccion(b.alumno.seccion)}</span></TD>
                      <TD><Badge variant="success">{porcentaje}%</Badge></TD>
                      <TD><span className="font-mono-data">Q{MENSUALIDAD_BASE.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                      <TD><span className="font-mono-data font-semibold text-primary-700">Q{total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                      <TD><span className="text-stone-500 text-xs">{formatMesAnio(b.fechaInicio)}</span></TD>
                      <TD><span className="text-stone-500 text-xs">{b.descripcion ?? "—"}</span></TD>
                      <TD className="text-right">
                        <button onClick={() => openEditForm(b)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded transition-colors" aria-label="Editar beca">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => setConfirmTarget(b)} className="p-1.5 text-stone-400 hover:text-danger-700 rounded transition-colors" aria-label="Desactivar beca">
                          <Ban className="w-3.5 h-3.5" />
                        </button>
                      </TD>
                    </tr>
                  );
                })}
                {becas.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-stone-500">No hay becas activas registradas.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!confirmTarget}
        onClose={() => { if (!deactivating) setConfirmTarget(null); }}
        title="Desactivar beca"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setConfirmTarget(null)} disabled={deactivating}>Cancelar</Btn>
            <Btn variant="destructive" size="sm" loading={deactivating} onClick={handleDeactivate}>Desactivar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          ¿Desactivar la beca de <strong>{confirmTarget ? nombreAlumno(confirmTarget.alumno) : ""}</strong>? Esta acción no elimina el registro,
          pero deja de aplicarse el descuento a la mensualidad del alumno.
        </p>
      </Modal>
    </div>
  );
}

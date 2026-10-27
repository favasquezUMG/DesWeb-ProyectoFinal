import { useCallback, useEffect, useState } from "react";
import { Plus, MapPin, Edit, Phone, School, PauseCircle, PlayCircle, Trash2 } from "../../components/Iconos";
import { Card, SectionHeader, Btn, Modal, Input, AlertBanner, EmptyState, Badge } from "../../components/Ui";
import {
  getSedesAdmin, getSedesMetricas, getCatedraticosSede, createSede, updateSede, cambiarEstadoSede, eliminarSede,
  type SedeAdminDto, type SedeMetricaDto,
} from "../../lib/api";

interface Form { sedeId?: number; nombre: string; direccion: string; telefono: string }

// Acción que se confirma antes de ejecutar
type Confirmacion = { tipo: "desactivar" | "eliminar"; sede: SedeAdminDto };

export default function SedesView() {
  const [sedes, setSedes] = useState<SedeAdminDto[]>([]);
  const [metricas, setMetricas] = useState<SedeMetricaDto[]>([]);
  const [catedraticosPorSede, setCatedraticosPorSede] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [errorConfirmar, setErrorConfirmar] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [s, m, c] = await Promise.all([getSedesAdmin(), getSedesMetricas().catch(() => []), getCatedraticosSede().catch(() => [])]);
      setSedes(s);
      setMetricas(m);
      const conteo = new Map<string, number>();
      for (const cat of c) if (cat.sede) conteo.set(cat.sede, (conteo.get(cat.sede) ?? 0) + 1);
      setCatedraticosPorSede(conteo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar las sedes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  async function guardar() {
    if (!form) return;
    if (!form.nombre.trim()) return setErrorForm("El nombre es obligatorio.");
    setGuardando(true);
    setErrorForm("");
    const payload = { nombre: form.nombre.trim(), direccion: form.direccion.trim(), telefono: form.telefono.trim() };
    try {
      if (form.sedeId) await updateSede(form.sedeId, payload);
      else await createSede(payload);
      setAviso(form.sedeId ? "Sede actualizada." : `Sede ${payload.nombre} creada. Ahora asígnele un administrador en Usuarios y abra sus secciones.`);
      setForm(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar la sede.");
    } finally {
      setGuardando(false);
    }
  }

  async function reactivar(sede: SedeAdminDto) {
    setError("");
    try {
      const res = await cambiarEstadoSede(sede.sedeId, true);
      setAviso(res.message);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reactivar la sede.");
    }
  }

  async function ejecutarConfirmacion() {
    if (!confirmar) return;
    setProcesando(true);
    setErrorConfirmar("");
    try {
      const res = confirmar.tipo === "eliminar"
        ? await eliminarSede(confirmar.sede.sedeId)
        : await cambiarEstadoSede(confirmar.sede.sedeId, false);
      setAviso(res.message);
      setConfirmar(null);
      await cargar();
    } catch (e) {
      setErrorConfirmar(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setProcesando(false);
    }
  }

  const activas = sedes.filter((s) => s.activo);
  const desactivadas = sedes.filter((s) => !s.activo);

  return (
    <div className="space-y-6">
      <SectionHeader title="Sedes" subtitle="Administre las sedes del colegio"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrorForm(""); setForm({ nombre: "", direccion: "", telefono: "" }); }}>Agregar sede</Btn>} />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}</div>
      ) : activas.length === 0 ? (
        <EmptyState icon={<School className="w-10 h-10" />} title="Sin sedes activas" description="Agregue una sede o reactive una de las desactivadas." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activas.map((sede) => {
            const m = metricas.find((x) => x.sedeId === sede.sedeId);
            return (
              <Card key={sede.sedeId} className="p-5 hover:shadow-sm transition-shadow">
                <div className="mb-3">
                  <h3 className="font-display font-bold text-stone-900">{sede.nombre}</h3>
                  {sede.direccion && <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5"><MapPin className="w-3 h-3" />{sede.direccion}</p>}
                  {sede.telefono && <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5"><Phone className="w-3 h-3" />{sede.telefono}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-500">Alumnos</p>
                    <p className="font-display font-bold tabular-nums text-stone-900 text-xl">{m?.alumnos.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-500">Catedráticos</p>
                    <p className="font-display font-bold tabular-nums text-stone-900 text-xl">{catedraticosPorSede.get(sede.nombre) ?? 0}</p>
                  </div>
                </div>
                {m && (
                  <>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Tasa de aprobación</span>
                      <span className="font-display font-bold tabular-nums text-success-700">{m.aprobacion}%</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 mb-2">
                      <div className="bg-success-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, m.aprobacion)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-4">
                      <span>Pagos pendientes</span>
                      <span className={`font-display font-bold tabular-nums ${m.mora > 15 ? "text-danger-700" : "text-stone-700"}`}>{m.mora}%</span>
                    </div>
                  </>
                )}
                <div className="flex gap-2">
                  <Btn variant="outline" size="sm" className="flex-1 justify-center" icon={<Edit className="w-3.5 h-3.5" />}
                    onClick={() => { setErrorForm(""); setForm({ sedeId: sede.sedeId, nombre: sede.nombre, direccion: sede.direccion ?? "", telefono: sede.telefono ?? "" }); }}>
                    Editar
                  </Btn>
                  <Btn variant="ghost" size="sm" icon={<PauseCircle className="w-3.5 h-3.5" />}
                    onClick={() => { setErrorConfirmar(""); setConfirmar({ tipo: "desactivar", sede }); }}>
                    Desactivar
                  </Btn>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && desactivadas.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-display font-bold text-stone-900">Sedes desactivadas</h3>
          <Card className="divide-y divide-stone-100">
            {desactivadas.map((sede) => (
              <div key={sede.sedeId} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-stone-700">{sede.nombre}</p>
                    <Badge variant="neutral">Desactivada</Badge>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {sede.puedeEliminar ? "No tiene nada registrado; se puede eliminar." : `Tiene ${sede.relacionados}. Se conserva como historial.`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Btn variant="outline" size="sm" icon={<PlayCircle className="w-3.5 h-3.5" />} onClick={() => reactivar(sede)}>Reactivar</Btn>
                  {sede.puedeEliminar && (
                    <Btn variant="destructive" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />}
                      onClick={() => { setErrorConfirmar(""); setConfirmar({ tipo: "eliminar", sede }); }}>
                      Eliminar
                    </Btn>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      <Modal open={!!confirmar} onClose={() => !procesando && setConfirmar(null)}
        title={confirmar?.tipo === "eliminar" ? "Eliminar sede" : "Desactivar sede"}
        footer={<>
          <Btn variant="ghost" onClick={() => setConfirmar(null)} disabled={procesando}>Cancelar</Btn>
          <Btn variant={confirmar?.tipo === "eliminar" ? "destructive" : "primary"} loading={procesando} onClick={ejecutarConfirmacion}>
            {confirmar?.tipo === "eliminar" ? "Eliminar" : "Desactivar"}
          </Btn>
        </>}>
        {confirmar && (
          <div className="space-y-3 text-sm text-stone-600">
            {confirmar.tipo === "eliminar" ? (
              <p>Se eliminará <span className="font-semibold text-stone-900">{confirmar.sede.nombre}</span> definitivamente. Esta acción no se puede deshacer.</p>
            ) : (
              <>
                <p><span className="font-semibold text-stone-900">{confirmar.sede.nombre}</span> dejará de aparecer en la inscripción en línea y en las listas de sedes. Todo su historial se conserva y puede reactivarla cuando quiera.</p>
                {confirmar.sede.alumnosActivos > 0 && (
                  <AlertBanner type="warning" message={`Tiene ${confirmar.sede.alumnosActivos} alumno(s) activo(s). Para desactivarla, primero trasládelos a otra sede o délos de baja.`} />
                )}
              </>
            )}
            {errorConfirmar && <AlertBanner type="error" message={errorConfirmar} />}
          </div>
        )}
      </Modal>

      <Modal open={!!form} onClose={() => !guardando && setForm(null)} title={form?.sedeId ? "Editar sede" : "Nueva sede"}
        footer={<>
          <Btn variant="ghost" onClick={() => setForm(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={guardar}>Guardar</Btn>
        </>}>
        {form && (
          <div className="space-y-3">
            <Input label="Nombre de la sede" value={form.nombre} maxLength={150} placeholder="Ej. Sede Escuintla" onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
            <Input label="Dirección" value={form.direccion} maxLength={255} placeholder="Calle, zona, municipio" onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
            <Input label="Teléfono" value={form.telefono} maxLength={20} placeholder="(502) 2XXX-XXXX" onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
            {errorForm && <AlertBanner type="error" message={errorForm} />}
          </div>
        )}
      </Modal>
    </div>
  );
}

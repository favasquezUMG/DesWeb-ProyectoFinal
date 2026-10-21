import { useCallback, useEffect, useState } from "react";
import { Plus, MapPin, Edit, Phone, School } from "lucide-react";
import { Card, SectionHeader, Btn, Modal, Input, AlertBanner, EmptyState } from "../../components/Ui";
import {
  getSedes, getSedesMetricas, getCatedraticosSede, createSede, updateSede,
  type SedeDto, type SedeMetricaDto,
} from "../../lib/api";

interface Form { sedeId?: number; nombre: string; direccion: string; telefono: string }

export default function SedesView() {
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [metricas, setMetricas] = useState<SedeMetricaDto[]>([]);
  const [catedraticosPorSede, setCatedraticosPorSede] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [form, setForm] = useState<Form | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [s, m, c] = await Promise.all([getSedes(), getSedesMetricas().catch(() => []), getCatedraticosSede().catch(() => [])]);
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

  return (
    <div className="space-y-6">
      <SectionHeader title="Sedes" subtitle="Administre las sedes del colegio"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrorForm(""); setForm({ nombre: "", direccion: "", telefono: "" }); }}>Agregar sede</Btn>} />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">{[0, 1, 2].map((i) => <div key={i} className="h-56 rounded-xl bg-stone-100 animate-pulse" />)}</div>
      ) : sedes.length === 0 ? (
        <EmptyState icon={<School className="w-10 h-10" />} title="Sin sedes" description="Agregue la primera sede del colegio." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {sedes.map((sede) => {
            const m = metricas.find((x) => x.sedeId === sede.sedeId);
            return (
              <Card key={sede.sedeId} className="p-5 hover:shadow-sm transition-shadow">
                <div className="mb-3">
                  <h3 className="font-display font-semibold text-stone-900">{sede.nombre}</h3>
                  {sede.direccion && <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5"><MapPin className="w-3 h-3" />{sede.direccion}</p>}
                  {sede.telefono && <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5"><Phone className="w-3 h-3" />{sede.telefono}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-500">Alumnos</p>
                    <p className="font-mono-data font-semibold text-stone-900 text-xl">{m?.alumnos.toLocaleString() ?? "—"}</p>
                  </div>
                  <div className="bg-stone-50 rounded-lg p-3">
                    <p className="text-xs text-stone-500">Catedráticos</p>
                    <p className="font-mono-data font-semibold text-stone-900 text-xl">{catedraticosPorSede.get(sede.nombre) ?? 0}</p>
                  </div>
                </div>
                {m && (
                  <>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-1">
                      <span>Tasa de aprobación</span>
                      <span className="font-mono-data font-semibold text-success-700">{m.aprobacion}%</span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5 mb-2">
                      <div className="bg-success-600 h-1.5 rounded-full" style={{ width: `${Math.min(100, m.aprobacion)}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-xs text-stone-500 mb-4">
                      <span>Mora</span>
                      <span className={`font-mono-data font-semibold ${m.mora > 15 ? "text-danger-700" : "text-stone-700"}`}>{m.mora}%</span>
                    </div>
                  </>
                )}
                <Btn variant="outline" size="sm" className="w-full justify-center" icon={<Edit className="w-3.5 h-3.5" />}
                  onClick={() => { setErrorForm(""); setForm({ sedeId: sede.sedeId, nombre: sede.nombre, direccion: sede.direccion ?? "", telefono: sede.telefono ?? "" }); }}>
                  Editar
                </Btn>
              </Card>
            );
          })}
        </div>
      )}

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

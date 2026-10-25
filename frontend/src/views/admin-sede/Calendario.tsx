import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Bell, Edit, Trash2, ChevronLeft, ChevronRight, CalendarDays } from "../../components/Iconos";
import { Card, SectionHeader, Btn, Modal, Input, Select, Textarea, AlertBanner, Badge, Toggle } from "../../components/Ui";
import {
  getEventos, crearEvento, actualizarEvento, eliminarEvento, enviarRecordatorioEvento,
  type EventoDto, type TipoEvento,
} from "../../lib/api";
import Circulares from "./Circulares";

const TIPOS: { id: TipoEvento; label: string; dot: string; badge: string }[] = [
  { id: "Festivo", label: "Festivo / Asueto (sin clases)", dot: "bg-success-600", badge: "bg-success-50 text-success-800 border-success-200" },
  { id: "Academico", label: "Académico (exámenes, entregas)", dot: "bg-primary-600", badge: "bg-primary-50 text-primary-800 border-primary-200" },
  { id: "Deportivo", label: "Deportivo / Cultural", dot: "bg-action-500", badge: "bg-action-50 text-action-800 border-action-200" },
  { id: "Reunion", label: "Reunión de padres", dot: "bg-info-600", badge: "bg-info-50 text-info-800 border-info-200" },
];
const cfg = (t: string) => TIPOS.find((x) => x.id === t) ?? { id: t, label: t, dot: "bg-stone-400", badge: "bg-stone-50 text-stone-700 border-stone-200" };

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pad = (n: number) => String(n).padStart(2, "0");
const diaISO = (fecha: string) => fecha.slice(0, 10);
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const formatoLargo = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};

interface Form { eventoId?: number; nombre: string; descripcion: string; fecha: string; tipoEvento: TipoEvento; enviarRecordatorio: boolean; general: boolean }
const vacio = (fecha = hoyISO()): Form => ({ nombre: "", descripcion: "", fecha, tipoEvento: "Academico", enviarRecordatorio: true, general: false });

export default function CalendarioView({ esGlobal = false }: { esGlobal?: boolean }) {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [eventos, setEventos] = useState<EventoDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [diaSel, setDiaSel] = useState<string | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [aEliminar, setAEliminar] = useState<EventoDto | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorForm, setErrorForm] = useState("");

  const cargar = useCallback(async () => {
    try {
      setEventos(await getEventos());
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los eventos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const porDia = useMemo(() => {
    const m = new Map<string, EventoDto[]>();
    for (const e of eventos) m.set(diaISO(e.fecha), [...(m.get(diaISO(e.fecha)) ?? []), e]);
    return m;
  }, [eventos]);

  const hoy = hoyISO();
  const proximos = eventos.filter((e) => diaISO(e.fecha) >= hoy).slice(0, 6);
  const delDia = diaSel ? porDia.get(diaSel) ?? [] : [];

  async function guardar() {
    if (!form) return;
    if (!form.nombre.trim() || !form.fecha) return setErrorForm("Indique el nombre y la fecha.");
    setGuardando(true);
    setErrorForm("");
    const input = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      tipoEvento: form.tipoEvento,
      enviarRecordatorio: form.enviarRecordatorio,
      ...(esGlobal ? { sedeId: null } : {}),
    };
    try {
      if (form.eventoId) await actualizarEvento(form.eventoId, input);
      else await crearEvento(input);
      setAviso(form.eventoId ? "Evento actualizado." : "Evento creado.");
      setForm(null);
      await cargar();
    } catch (e) {
      setErrorForm(e instanceof Error ? e.message : "No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
    }
  }

  async function eliminar() {
    if (!aEliminar) return;
    setGuardando(true);
    try {
      await eliminarEvento(aEliminar.eventoId);
      setAEliminar(null);
      setAviso("Evento eliminado.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el evento.");
      setAEliminar(null);
    } finally {
      setGuardando(false);
    }
  }

  async function recordar(e: EventoDto) {
    setError("");
    try {
      const res = await enviarRecordatorioEvento(e.eventoId);
      setAviso(res.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enviar el recordatorio.");
    }
  }

  // Los eventos generales (sin sede) solo los edita el administrador general
  const editable = (e: EventoDto) => esGlobal || e.sedeId !== null;

  const tarjetaEvento = (e: EventoDto, conFecha = false) => (
    <div key={e.eventoId} className={`px-3 py-2.5 rounded-xl border text-sm ${cfg(e.tipoEvento).badge}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">{e.nombre}</p>
          <p className="text-[11px] opacity-75">
            {conFecha && `${formatoLargo(diaISO(e.fecha))} · `}{cfg(e.tipoEvento).label} · {e.sede ? e.sede.nombre : "Todas las sedes"}
          </p>
          {e.descripcion && <p className="text-xs mt-1 opacity-90">{e.descripcion}</p>}
        </div>
        {editable(e) && (
          <div className="flex gap-0.5 shrink-0">
            {diaISO(e.fecha) >= hoy && (
              <button onClick={() => recordar(e)} aria-label="Enviar recordatorio ahora" title="Enviar recordatorio ahora" className="p-1 rounded hover:bg-white/60 cursor-pointer"><Bell className="w-3.5 h-3.5" /></button>
            )}
            <button onClick={() => { setErrorForm(""); setForm({ eventoId: e.eventoId, nombre: e.nombre, descripcion: e.descripcion ?? "", fecha: diaISO(e.fecha), tipoEvento: e.tipoEvento as TipoEvento, enviarRecordatorio: e.enviarRecordatorio ?? true, general: e.sedeId === null }); }}
              aria-label="Editar evento" className="p-1 rounded hover:bg-white/60 cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
            <button onClick={() => setAEliminar(e)} aria-label="Eliminar evento" className="p-1 rounded hover:bg-white/60 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionHeader title="Calendario Escolar" subtitle={esGlobal ? "Eventos generales y de todas las sedes" : "Eventos de la sede y eventos generales del colegio"}
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setErrorForm(""); setForm(vacio(diaSel ?? hoyISO())); }}>Crear evento</Btn>} />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}

      <Circulares />

      <div className="flex flex-wrap gap-2">
        {TIPOS.map((t) => (
          <span key={t.id} className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-medium ${t.badge}`}>
            <span className={`w-2 h-2 rounded-full ${t.dot}`} />{t.label}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <button onClick={() => setAnio(anio - 1)} aria-label="Año anterior" className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <span className="font-display font-bold text-stone-900">{anio}</span>
            <button onClick={() => setAnio(anio + 1)} aria-label="Año siguiente" className="p-1.5 rounded-lg hover:bg-stone-100 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
          {loading ? <div className="h-96 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" /> : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {MESES.map((mes, m) => {
                const dias = new Date(anio, m + 1, 0).getDate();
                const primero = new Date(anio, m, 1).getDay();
                const celdas = Array.from({ length: primero + dias }, (_, i) => (i < primero ? null : i - primero + 1));
                return (
                  <Card key={mes} className="p-3">
                    <p className="text-sm font-semibold text-stone-800 mb-2">{mes}</p>
                    <div className="grid grid-cols-7 gap-0.5 text-center">
                      {DIAS.map((d) => <span key={d} className="text-[9px] text-stone-400">{d[0]}</span>)}
                      {celdas.map((d, i) => {
                        if (d === null) return <span key={`v${i}`} />;
                        const iso = `${anio}-${pad(m + 1)}-${pad(d)}`;
                        const evs = porDia.get(iso) ?? [];
                        return (
                          <button key={iso} onClick={() => setDiaSel(iso)}
                            className={`relative h-7 text-[11px] rounded cursor-pointer transition-colors
                              ${iso === diaSel ? "bg-primary-700 text-white" : iso === hoy ? "ring-1 ring-primary-500 text-primary-800" : "hover:bg-stone-100 text-stone-700"}`}>
                            {d}
                            {evs.length > 0 && (
                              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                                {evs.slice(0, 3).map((e) => <span key={e.eventoId} className={`w-1 h-1 rounded-full ${cfg(e.tipoEvento).dot}`} />)}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {diaSel && (
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-stone-800 capitalize">{formatoLargo(diaSel)}</p>
                <button onClick={() => { setErrorForm(""); setForm(vacio(diaSel)); }} className="text-xs text-primary-700 hover:underline cursor-pointer">Agregar</button>
              </div>
              {delDia.length ? delDia.map((e) => tarjetaEvento(e)) : <p className="text-xs text-stone-500">Sin eventos este día.</p>}
            </Card>
          )}
          <Card className="p-4 space-y-2">
            <p className="text-sm font-semibold text-stone-800 flex items-center gap-2"><CalendarDays className="w-4 h-4 text-stone-400" />Próximos eventos</p>
            {proximos.length ? proximos.map((e) => tarjetaEvento(e, true)) : <p className="text-xs text-stone-500">No hay eventos próximos.</p>}
          </Card>
        </div>
      </div>

      <Modal open={!!form} onClose={() => !guardando && setForm(null)} title={form?.eventoId ? "Editar evento" : "Crear evento"}
        footer={<>
          <Btn variant="ghost" onClick={() => setForm(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={guardar}>Guardar</Btn>
        </>}>
        {form && (
          <div className="space-y-3">
            <Input label="Nombre" value={form.nombre} maxLength={150} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Exámenes de cuarta unidad" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Fecha" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
              <Select label="Tipo" value={form.tipoEvento} onChange={(e) => setForm({ ...form, tipoEvento: e.target.value as TipoEvento })}>
                {TIPOS.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </Select>
            </div>
            <Textarea label="Descripción (opcional)" rows={3} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
            <Toggle checked={form.enviarRecordatorio} onChange={(v) => setForm({ ...form, enviarRecordatorio: v })} label="Enviar recordatorio a los encargados el día anterior" />
            {form.tipoEvento === "Festivo" && <p className="text-xs text-stone-500">Los días festivos aparecen como “sin clases” en el horario de alumnos y encargados.</p>}
            {esGlobal ? <Badge variant="info">Evento general: aplica a todas las sedes</Badge> : <Badge variant="neutral">Se publica para la sede</Badge>}
            {errorForm && <AlertBanner type="error" message={errorForm} />}
          </div>
        )}
      </Modal>

      <Modal open={!!aEliminar} onClose={() => !guardando && setAEliminar(null)} title="Eliminar evento"
        footer={<>
          <Btn variant="ghost" onClick={() => setAEliminar(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="destructive" loading={guardando} onClick={eliminar}>Eliminar</Btn>
        </>}>
        {aEliminar && <p className="text-sm text-stone-600">¿Eliminar “{aEliminar.nombre}” del {formatoLargo(diaISO(aEliminar.fecha))}?</p>}
      </Modal>
    </div>
  );
}

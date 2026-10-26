import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Ticket, Trash2, Users } from "../../components/Iconos";
import { AlertBanner, Badge, Btn, Card, Drawer, EmptyState, Input, Modal, Select, TD, TH, Textarea, TablaResponsiva } from "../../components/Ui";
import { formatoQ } from "../../components/PagoColegiatura";
import {
  actualizarEvento,
  crearEvento,
  eliminarEvento,
  getEventos,
  getInscritosEvento,
  getSedes,
  type EventoDto,
  type InscritosEventoDto,
  type SedeDto,
} from "../../lib/api";

const TIPOS = ["Actividad", "Excursion", "Deportivo", "Cultural", "Academico", "Festivo"];

interface Formulario {
  nombre: string;
  descripcion: string;
  fecha: string;
  tipoEvento: string;
  sedeId: string;
  costo: string;
  cupoMaximo: string;
  fechaLimiteInscripcion: string;
}

const VACIO: Formulario = {
  nombre: "", descripcion: "", fecha: "", tipoEvento: TIPOS[0], sedeId: "", costo: "", cupoMaximo: "", fechaLimiteInscripcion: "",
};

const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { timeZone: "UTC" });

/**
 * Eventos que los padres pagan desde el carrito (excursiones, actividades con costo).
 * Los eventos informativos del calendario no aparecen aquí.
 */
export default function EventosCobro() {
  const [eventos, setEventos] = useState<EventoDto[] | null>(null);
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [editando, setEditando] = useState<EventoDto | "nuevo" | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [inscritos, setInscritos] = useState<InscritosEventoDto | null>(null);
  const [eliminando, setEliminando] = useState<EventoDto | null>(null);

  const cargar = useCallback(async () => {
    try {
      const todos = await getEventos();
      setEventos(todos.filter((e) => e.requierePago).sort((a, b) => a.fecha.localeCompare(b.fecha)));
    } catch (e) {
      setError((e as Error).message);
      setEventos([]);
    }
  }, []);

  useEffect(() => {
    cargar();
    getSedes().then(setSedes).catch(() => setSedes([]));
  }, [cargar]);

  function abrir(evento: EventoDto | "nuevo") {
    setFormError(null);
    setEditando(evento);
    setForm(evento === "nuevo" ? VACIO : {
      nombre: evento.nombre,
      descripcion: evento.descripcion ?? "",
      fecha: soloFecha(evento.fecha),
      tipoEvento: evento.tipoEvento,
      sedeId: evento.sedeId ? String(evento.sedeId) : "",
      costo: evento.costo ? String(Number(evento.costo)) : "",
      cupoMaximo: evento.cupoMaximo ? String(evento.cupoMaximo) : "",
      fechaLimiteInscripcion: soloFecha(evento.fechaLimiteInscripcion),
    });
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.fecha || !form.costo) {
      setFormError("Nombre, fecha y costo son obligatorios.");
      return;
    }
    setGuardando(true);
    setFormError(null);
    const datos = {
      nombre: form.nombre.trim(),
      descripcion: form.descripcion.trim() || null,
      fecha: form.fecha,
      tipoEvento: form.tipoEvento,
      sedeId: form.sedeId ? Number(form.sedeId) : null,
      requierePago: true,
      costo: Number(form.costo),
      cupoMaximo: form.cupoMaximo ? Number(form.cupoMaximo) : null,
      fechaLimiteInscripcion: form.fechaLimiteInscripcion || null,
    };
    try {
      if (editando === "nuevo") await crearEvento(datos);
      else if (editando) await actualizarEvento(editando.eventoId, datos);
      setExito(editando === "nuevo" ? `"${datos.nombre}" quedó publicado para los padres.` : "Cambios guardados.");
      setEditando(null);
      await cargar();
    } catch (e) {
      setFormError((e as Error).message);
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminando) return;
    try {
      await eliminarEvento(eliminando.eventoId);
      setExito(`"${eliminando.nombre}" fue eliminado.`);
      await cargar();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEliminando(null);
    }
  }

  async function verInscritos(evento: EventoDto) {
    try {
      setInscritos(await getInscritosEvento(evento.eventoId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-stone-900 flex items-center gap-2"><Ticket className="w-4 h-4 text-primary-700" />Eventos con cobro</h3>
          <p className="text-xs text-stone-500 mt-0.5">Los padres los ven en su sección Eventos y los pagan desde el carrito. La beca no aplica a eventos.</p>
        </div>
        <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => abrir("nuevo")}>Nuevo evento</Btn>
      </div>

      <div className="px-5 pt-4 space-y-3 empty:hidden">
        {exito && <AlertBanner type="success" message={exito} onClose={() => setExito(null)} />}
        {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      </div>

      {eventos === null ? (
        <div className="p-5"><div className="h-24 rounded-lg bg-stone-100 animate-pulse" /></div>
      ) : eventos.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<Ticket className="w-10 h-10" />} title="Sin eventos con cobro" description="Cree uno para que los padres puedan inscribir y pagar en línea." />
        </div>
      ) : (
        <TablaResponsiva>
          <table className="w-full">
            <thead>
              <tr><TH>Evento</TH><TH>Fecha</TH><TH>Sede</TH><TH className="text-right">Costo</TH><TH>Cupo</TH><TH>Inscripción hasta</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {eventos.map((e) => (
                <tr key={e.eventoId} className="hover:bg-sand-50">
                  <TD><span className="font-semibold text-stone-900">{e.nombre}</span></TD>
                  <TD><span className="text-[13px] text-stone-500 tabular-nums">{formatoFecha(e.fecha)}</span></TD>
                  <TD>{e.sede?.nombre ?? <Badge>Todas</Badge>}</TD>
                  <TD className="text-right"><span className="font-mono-data">{formatoQ(Number(e.costo ?? 0))}</span></TD>
                  <TD>{e.cupoMaximo ?? <span className="text-stone-400">Sin límite</span>}</TD>
                  <TD><span className="text-[13px] text-stone-500 tabular-nums">{e.fechaLimiteInscripcion ? formatoFecha(e.fechaLimiteInscripcion) : "Día anterior"}</span></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" icon={<Users className="w-4 h-4" />} onClick={() => verInscritos(e)}>Inscritos</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => abrir(e)} aria-label={`Editar ${e.nombre}`}><Pencil className="w-4 h-4" /></Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setEliminando(e)} aria-label={`Eliminar ${e.nombre}`}><Trash2 className="w-4 h-4 text-danger-700" /></Btn>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </TablaResponsiva>
      )}

      <Modal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title={editando === "nuevo" ? "Nuevo evento con cobro" : "Editar evento"}
        footer={<>
          <Btn variant="outline" onClick={() => setEditando(null)}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={guardar}>Guardar</Btn>
        </>}
      >
        <div className="space-y-4">
          {formError && <AlertBanner type="error" message={formError} />}
          <Input label="Nombre" value={form.nombre} placeholder="Ej. Excursión al Museo Popol Vuh" onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
          <Textarea label="Descripción (opcional)" rows={2} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Fecha del evento" type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            <Select label="Tipo" value={form.tipoEvento} onChange={(e) => setForm({ ...form, tipoEvento: e.target.value })}>
              {TIPOS.map((t) => <option key={t} value={t}>{t}</option>)}
            </Select>
            <Input label="Costo por alumno (Q)" type="number" min="1" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
            <Input label="Cupo máximo" type="number" min="1" placeholder="Sin límite" value={form.cupoMaximo} onChange={(e) => setForm({ ...form, cupoMaximo: e.target.value })} />
            <Input
              label="Inscripción hasta"
              type="date"
              max={form.fecha || undefined}
              hint="Vacío = hasta el día anterior"
              value={form.fechaLimiteInscripcion}
              onChange={(e) => setForm({ ...form, fechaLimiteInscripcion: e.target.value })}
            />
            <Select label="Sede" value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })}>
              <option value="">Todas las sedes</option>
              {sedes.map((s) => <option key={s.sedeId} value={s.sedeId}>{s.nombre}</option>)}
            </Select>
          </div>
        </div>
      </Modal>

      <Modal
        open={eliminando !== null}
        onClose={() => setEliminando(null)}
        title="Eliminar evento"
        footer={<>
          <Btn variant="outline" onClick={() => setEliminando(null)}>Cancelar</Btn>
          <Btn variant="destructive" onClick={confirmarEliminar}>Eliminar</Btn>
        </>}
      >
        <p className="text-sm text-stone-700">
          ¿Eliminar <span className="font-semibold">{eliminando?.nombre}</span>? Los carritos sin pagar que lo incluyan se cancelan.
          Si ya hay inscripciones pagadas no se podrá eliminar.
        </p>
      </Modal>

      <Drawer open={inscritos !== null} onClose={() => setInscritos(null)} title={inscritos ? `Inscritos — ${inscritos.nombre}` : "Inscritos"}>
        {inscritos && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs text-stone-500">Inscritos</p>
                <p className="text-2xl font-display font-bold text-primary-700">
                  {inscritos.inscritos}{inscritos.cupoMaximo !== null && <span className="text-sm text-stone-400"> / {inscritos.cupoMaximo}</span>}
                </p>
              </div>
              <div className="rounded-lg border border-stone-200 p-3">
                <p className="text-xs text-stone-500">Recaudado</p>
                <p className="text-2xl font-display font-bold text-success-700">{formatoQ(inscritos.recaudado)}</p>
              </div>
            </div>
            {inscritos.detalle.length === 0 ? (
              <p className="text-sm text-stone-500 text-center py-6">Todavía no hay alumnos inscritos.</p>
            ) : (
              <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                {inscritos.detalle.map((i) => (
                  <li key={i.inscripcionId} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-stone-900 truncate">{i.alumno}</p>
                      <p className="text-xs text-stone-500">{i.grado}</p>
                    </div>
                    {i.estado === "Confirmada" ? <Badge variant="success">Pagado</Badge>
                      : i.estado === "Pendiente" ? <Badge variant="warning">Pago en curso</Badge>
                      : <Badge variant="info">Reembolsado</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Drawer>
    </Card>
  );
}

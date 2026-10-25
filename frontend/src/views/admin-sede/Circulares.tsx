<<<<<<< HEAD:frontend/src/views/admin-sede/Circulares.tsx
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileSignature, Pencil, Plus, Trash2, Users } from "lucide-react";
import { AlertBanner, Badge, Btn, Card, Drawer, EmptyState, Input, Modal, Select, TD, TH, Textarea, Toggle } from "../../components/Ui";
=======
import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Ticket, Trash2, Users } from "../../components/Iconos";
import { AlertBanner, Badge, Btn, Card, Drawer, EmptyState, Input, Modal, Select, TD, TH, Textarea } from "../../components/Ui";
>>>>>>> origin/main:frontend/src/views/admin-sede/EventosCobro.tsx
import { formatoQ } from "../../components/PagoColegiatura";
import {
  actualizarEvento,
  crearEvento,
  eliminarEvento,
  getEventos,
  getRespuestasCircular,
  getSedes,
  type EstadoAutorizacion,
  type EventoDto,
  type RespuestasCircularDto,
  type SedeDto,
} from "../../lib/api";

const TIPOS = ["Actividad", "Excursion", "Deportivo", "Cultural", "Academico", "Festivo"];

interface Formulario {
  nombre: string;
  descripcion: string;
  fecha: string;
  tipoEvento: string;
  sedeId: string;
  conCosto: boolean;
  costo: string;
  cupoMaximo: string;
  fechaLimiteInscripcion: string;
}

const VACIO: Formulario = {
  nombre: "", descripcion: "", fecha: "", tipoEvento: TIPOS[0], sedeId: "", conCosto: false, costo: "", cupoMaximo: "", fechaLimiteInscripcion: "",
};

const soloFecha = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { timeZone: "UTC" });

/**
 * Circulares de autorización: eventos en los que los encargados autorizan (o no) la participación
 * de cada hijo, con o sin costo. Si tiene costo, el encargado lo paga desde su estado de cuenta;
 * si no paga antes de la fecha límite, la participación se cancela. Los eventos informativos del
 * calendario no aparecen aquí.
 */
export default function Circulares() {
  const [eventos, setEventos] = useState<EventoDto[] | null>(null);
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  const [editando, setEditando] = useState<EventoDto | "nuevo" | null>(null);
  const [form, setForm] = useState<Formulario>(VACIO);
  const [formError, setFormError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const [respuestas, setRespuestas] = useState<RespuestasCircularDto | null>(null);
  const [eliminando, setEliminando] = useState<EventoDto | null>(null);

  const cargar = useCallback(async () => {
    try {
      const todos = await getEventos();
      setEventos(todos.filter((e) => e.requiereAutorizacion).sort((a, b) => a.fecha.localeCompare(b.fecha)));
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
      conCosto: evento.requierePago,
      costo: evento.costo ? String(Number(evento.costo)) : "",
      cupoMaximo: evento.cupoMaximo ? String(evento.cupoMaximo) : "",
      fechaLimiteInscripcion: soloFecha(evento.fechaLimiteInscripcion),
    });
  }

  async function guardar() {
    if (!form.nombre.trim() || !form.fecha || (form.conCosto && !form.costo)) {
      setFormError(form.conCosto ? "Nombre, fecha y costo son obligatorios." : "Nombre y fecha son obligatorios.");
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
      requiereAutorizacion: true,
      requierePago: form.conCosto,
      costo: form.conCosto ? Number(form.costo) : null,
      cupoMaximo: form.cupoMaximo ? Number(form.cupoMaximo) : null,
      fechaLimiteInscripcion: form.fechaLimiteInscripcion || null,
    };
    try {
      if (editando === "nuevo") await crearEvento(datos);
      else if (editando) await actualizarEvento(editando.eventoId, datos);
      setExito(editando === "nuevo" ? `La circular "${datos.nombre}" quedó enviada a los encargados.` : "Cambios guardados.");
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

  async function verRespuestas(evento: EventoDto) {
    try {
      setRespuestas(await getRespuestasCircular(evento.eventoId));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between gap-3">
        <div>
<<<<<<< HEAD:frontend/src/views/admin-sede/Circulares.tsx
          <h3 className="font-display font-semibold text-stone-900 flex items-center gap-2"><FileSignature className="w-4 h-4 text-primary-700" />Circulares de autorización</h3>
          <p className="text-xs text-stone-500 mt-0.5">Los encargados autorizan la participación de cada hijo. Si tiene costo, lo pagan desde su estado de cuenta; la beca no aplica.</p>
=======
          <h3 className="font-display font-bold text-stone-900 flex items-center gap-2"><Ticket className="w-4 h-4 text-primary-700" />Eventos con cobro</h3>
          <p className="text-xs text-stone-500 mt-0.5">Los padres los ven en su sección Eventos y los pagan desde el carrito. La beca no aplica a eventos.</p>
>>>>>>> origin/main:frontend/src/views/admin-sede/EventosCobro.tsx
        </div>
        <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => abrir("nuevo")}>Nueva circular</Btn>
      </div>

      <div className="px-5 pt-4 space-y-3 empty:hidden">
        {exito && <AlertBanner type="success" message={exito} onClose={() => setExito(null)} />}
        {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      </div>

      {eventos === null ? (
        <div className="p-5"><div className="h-24 rounded-lg bg-stone-100 animate-pulse" /></div>
      ) : eventos.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<FileSignature className="w-10 h-10" />} title="Sin circulares" description="Cree una para pedir a los encargados que autoricen una excursión o actividad." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
<<<<<<< HEAD:frontend/src/views/admin-sede/Circulares.tsx
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Evento</TH><TH>Fecha</TH><TH>Sede</TH><TH className="text-right">Costo</TH><TH>Cupo</TH><TH>Responder hasta</TH><TH className="text-right">Acciones</TH></tr>
=======
            <thead>
              <tr><TH>Evento</TH><TH>Fecha</TH><TH>Sede</TH><TH className="text-right">Costo</TH><TH>Cupo</TH><TH>Inscripción hasta</TH><TH className="text-right">Acciones</TH></tr>
>>>>>>> origin/main:frontend/src/views/admin-sede/EventosCobro.tsx
            </thead>
            <tbody className="divide-y divide-stone-100">
              {eventos.map((e) => (
                <tr key={e.eventoId} className="hover:bg-sand-50">
                  <TD><span className="font-semibold text-stone-900">{e.nombre}</span></TD>
                  <TD><span className="text-[13px] text-stone-500 tabular-nums">{formatoFecha(e.fecha)}</span></TD>
                  <TD>{e.sede?.nombre ?? <Badge>Todas</Badge>}</TD>
                  <TD className="text-right">
                    {e.requierePago
                      ? <span className="font-mono-data">{formatoQ(Number(e.costo ?? 0))}</span>
                      : <span className="text-stone-400">Sin costo</span>}
                  </TD>
                  <TD>{e.cupoMaximo ?? <span className="text-stone-400">Sin límite</span>}</TD>
                  <TD><span className="text-[13px] text-stone-500 tabular-nums">{e.fechaLimiteInscripcion ? formatoFecha(e.fechaLimiteInscripcion) : "Día anterior"}</span></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <Btn variant="ghost" size="sm" icon={<Users className="w-4 h-4" />} onClick={() => verRespuestas(e)}>Respuestas</Btn>
                      <Btn variant="ghost" size="sm" onClick={() => abrir(e)} aria-label={`Editar ${e.nombre}`}><Pencil className="w-4 h-4" /></Btn>
                      <Btn variant="ghost" size="sm" onClick={() => setEliminando(e)} aria-label={`Eliminar ${e.nombre}`}><Trash2 className="w-4 h-4 text-danger-700" /></Btn>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={editando !== null}
        onClose={() => setEditando(null)}
        title={editando === "nuevo" ? "Nueva circular" : "Editar circular"}
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
            <Input
              label="Responder hasta"
              type="date"
              max={form.fecha || undefined}
              hint={form.conCosto ? "También es el límite para pagar. Vacío = día anterior" : "Vacío = hasta el día anterior"}
              value={form.fechaLimiteInscripcion}
              onChange={(e) => setForm({ ...form, fechaLimiteInscripcion: e.target.value })}
            />
            <Select label="Sede" value={form.sedeId} onChange={(e) => setForm({ ...form, sedeId: e.target.value })}>
              <option value="">Todas las sedes</option>
              {sedes.map((s) => <option key={s.sedeId} value={s.sedeId}>{s.nombre}</option>)}
            </Select>
            <Input label="Cupo máximo" type="number" min="1" placeholder="Sin límite" value={form.cupoMaximo} onChange={(e) => setForm({ ...form, cupoMaximo: e.target.value })} />
          </div>
          <Toggle checked={form.conCosto} onChange={(v) => setForm({ ...form, conCosto: v })} label="La actividad tiene costo" />
          {form.conCosto && (
            <Input label="Costo por alumno (Q)" type="number" min="1" step="0.01" value={form.costo} onChange={(e) => setForm({ ...form, costo: e.target.value })} />
          )}
        </div>
      </Modal>

      <Modal
        open={eliminando !== null}
        onClose={() => setEliminando(null)}
        title="Eliminar circular"
        footer={<>
          <Btn variant="outline" onClick={() => setEliminando(null)}>Cancelar</Btn>
          <Btn variant="destructive" onClick={confirmarEliminar}>Eliminar</Btn>
        </>}
      >
        <p className="text-sm text-stone-700">
          ¿Eliminar <span className="font-semibold">{eliminando?.nombre}</span>? Se borran las respuestas de los encargados y se cancelan los pagos en curso.
          Si ya hay participaciones pagadas no se podrá eliminar.
        </p>
      </Modal>

<<<<<<< HEAD:frontend/src/views/admin-sede/Circulares.tsx
      <Drawer open={respuestas !== null} onClose={() => setRespuestas(null)} title={respuestas ? `Respuestas — ${respuestas.nombre}` : "Respuestas"}>
        {respuestas && <DetalleRespuestas respuestas={respuestas} />}
=======
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
>>>>>>> origin/main:frontend/src/views/admin-sede/EventosCobro.tsx
      </Drawer>
    </Card>
  );
}

function DetalleRespuestas({ respuestas }: { respuestas: RespuestasCircularDto }) {
  const { resumen } = respuestas;
  const conCosto = respuestas.costo > 0;
  const participan = resumen.confirmadas + resumen.pendientesPago;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Dato label="Participan" valor={<>{participan}{respuestas.cupoMaximo !== null && <span className="text-sm text-stone-400"> / {respuestas.cupoMaximo}</span>}</>} />
        <Dato label="Sin responder" valor={resumen.sinRespuesta} />
        <Dato label="No autorizadas" valor={resumen.noAutorizadas} />
        {conCosto
          ? <Dato label="Recaudado" valor={formatoQ(resumen.recaudado)} color="text-success-700" />
          : <Dato label="Alumnos de la sede" valor={resumen.total} />}
      </div>
      {conCosto && (resumen.pendientesPago > 0 || resumen.canceladas > 0) && (
        <p className="text-xs text-stone-500">
          {resumen.pendientesPago} autorizada{resumen.pendientesPago === 1 ? "" : "s"} sin pagar todavía
          {resumen.canceladas > 0 && ` · ${resumen.canceladas} cancelada${resumen.canceladas === 1 ? "" : "s"} por no pagar a tiempo`}.
        </p>
      )}

      <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
        {respuestas.detalle.map((d) => (
          <li key={d.alumnoId} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-900 truncate">{d.alumno}</p>
              <p className="text-xs text-stone-500 truncate">
                {d.grado}
                {d.respondidoPor && ` · respondió ${d.respondidoPor}`}
              </p>
            </div>
            <BadgeRespuesta estado={d.estado} conCosto={conCosto} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function Dato({ label, valor, color = "text-primary-700" }: { label: string; valor: ReactNode; color?: string }) {
  return (
    <div className="rounded-lg border border-stone-200 p-3">
      <p className="text-xs text-stone-500 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-display font-semibold ${color}`}>{valor}</p>
    </div>
  );
}

function BadgeRespuesta({ estado, conCosto }: { estado: EstadoAutorizacion | null; conCosto: boolean }) {
  if (estado === null) return <Badge>Sin responder</Badge>;
  if (estado === "Autorizada") return <Badge variant="warning">Autorizada · sin pagar</Badge>;
  if (estado === "Confirmada") return <Badge variant="success">{conCosto ? "Pagada" : "Autorizada"}</Badge>;
  if (estado === "NoAutorizada") return <Badge variant="neutral">No autorizada</Badge>;
  if (estado === "Cancelada") return <Badge variant="danger">Cancelada</Badge>;
  return <Badge variant="info">Reembolsada</Badge>;
}

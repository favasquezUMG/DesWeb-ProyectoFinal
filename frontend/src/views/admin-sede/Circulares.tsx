import { useCallback, useEffect, useState, type ReactNode } from "react";
import { FileSignature, Pencil, Trash2, Users } from "../../components/Iconos";
import { AlertBanner, Badge, Btn, Card, Drawer, EmptyState, Modal, TD, TH } from "../../components/Ui";
import { formatoQ } from "../../components/PagoColegiatura";
import {
  eliminarEvento,
  getEventos,
  getRespuestasCircular,
  type EstadoAutorizacion,
  type EventoDto,
  type RespuestasCircularDto,
} from "../../lib/api";

const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { timeZone: "UTC" });

/**
 * Circulares de autorización: eventos en los que los encargados autorizan (o no) la participación
 * de cada hijo, con o sin costo. Si tiene costo, el encargado lo paga desde su estado de cuenta;
 * si no paga antes de la fecha límite, la participación se cancela. Los eventos informativos del
 * calendario no aparecen aquí.
 */
export default function Circulares({ version, onEditar, onCambio }: {
  /** Cambia cuando el calendario guarda o borra un evento: se vuelve a cargar la lista. */
  version: number;
  /** Las circulares se editan en el mismo formulario del calendario. */
  onEditar: (evento: EventoDto) => void;
  onCambio: () => void;
}) {
  const [eventos, setEventos] = useState<EventoDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);


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

  useEffect(() => { cargar(); }, [cargar, version]);

  async function confirmarEliminar() {
    if (!eliminando) return;
    try {
      await eliminarEvento(eliminando.eventoId);
      setExito(`"${eliminando.nombre}" fue eliminado.`);
      await cargar();
      onCambio();
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
          <h3 className="font-display font-bold text-stone-900 flex items-center gap-2"><FileSignature className="w-4 h-4 text-primary-700" />Circulares de autorización</h3>
          <p className="text-xs text-stone-500 mt-0.5">Los encargados autorizan la participación de cada hijo. Si tiene costo, lo pagan desde su estado de cuenta; la beca no aplica.</p>
        </div>
      </div>

      <div className="px-5 pt-4 space-y-3 empty:hidden">
        {exito && <AlertBanner type="success" message={exito} onClose={() => setExito(null)} />}
        {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}
      </div>

      {eventos === null ? (
        <div className="p-5"><div className="h-24 rounded-lg bg-stone-100 animate-pulse" /></div>
      ) : eventos.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={<FileSignature className="w-10 h-10" />} title="Sin circulares" description="Use “Crear evento” y active “Requiere autorización de los padres” para pedir permiso para una excursión o actividad." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><TH>Evento</TH><TH>Fecha</TH><TH>Sede</TH><TH className="text-right">Costo</TH><TH>Cupo</TH><TH>Responder hasta</TH><TH className="text-right">Acciones</TH></tr>
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
                      <Btn variant="ghost" size="sm" onClick={() => onEditar(e)} aria-label={`Editar ${e.nombre}`}><Pencil className="w-4 h-4" /></Btn>
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

      <Drawer open={respuestas !== null} onClose={() => setRespuestas(null)} title={respuestas ? `Respuestas — ${respuestas.nombre}` : "Respuestas"}>
        {respuestas && <DetalleRespuestas respuestas={respuestas} />}
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

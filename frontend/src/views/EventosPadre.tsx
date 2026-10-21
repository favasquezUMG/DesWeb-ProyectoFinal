import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Check, Clock, ShoppingCart, Ticket, Users } from "lucide-react";
import { AlertBanner, Badge, Btn, Card, EmptyState, SectionHeader, TD, TH } from "../components/Ui";
import { CarritoBoton, claveColegiatura, claveEvento, useCarrito, type ItemCarrito } from "../components/Carrito";
import { formatoQ } from "../components/PagoColegiatura";
import {
  getEstadoCuenta,
  getEventosDisponibles,
  getMisHijos,
  getMisInscripciones,
  type EventoDisponibleDto,
  type InscripcionDto,
} from "../lib/api";

const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Eventos con cobro (excursiones, actividades, etc.) que el encargado puede pagar para sus hijos.
 * Se agregan al carrito, que también puede llevar las mensualidades pendientes, y se pagan juntos.
 */
export default function EventosPadre() {
  const carrito = useCarrito();
  const [eventos, setEventos] = useState<EventoDisponibleDto[] | null>(null);
  const [inscripciones, setInscripciones] = useState<InscripcionDto[]>([]);
  const [pendientes, setPendientes] = useState<ItemCarrito[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pagado, setPagado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [disponibles, mias, hijos] = await Promise.all([getEventosDisponibles(), getMisInscripciones(), getMisHijos()]);
      setEventos(disponibles);
      setInscripciones(mias);
      setPendientes(await mensualidadesPendientes(hijos));
    } catch (e) {
      setError((e as Error).message);
      setEventos((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const sinAgregar = pendientes.filter((p) => !carrito.contiene(p.clave));

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Eventos y actividades"
        subtitle="Inscriba a sus hijos en los eventos del colegio y páguelos junto con la mensualidad"
        action={<CarritoBoton onPagado={() => { setPagado(true); cargar(); }} />}
      />

      {pagado && (
        <AlertBanner type="success" title="Pago realizado" message="Las inscripciones y mensualidades del carrito quedaron registradas." onClose={() => setPagado(false)} />
      )}
      {error && <AlertBanner type="error" title="No se pudieron cargar los eventos" message={error} />}

      {sinAgregar.length > 0 && (
        <Card className="p-4 border-warning-200 bg-warning-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-warning-700 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-warning-800">Tiene mensualidades pendientes</p>
                <p className="text-sm text-warning-700">
                  {sinAgregar.map((p) => `${p.descripcion} (${p.alumno.split(" ")[0]})`).join(", ")}. Puede incluirlas en el mismo pago.
                </p>
              </div>
            </div>
            <Btn variant="outline" size="sm" icon={<ShoppingCart className="w-4 h-4" />} onClick={() => sinAgregar.forEach(carrito.agregar)}>
              Agregar al carrito
            </Btn>
          </div>
        </Card>
      )}

      {eventos === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="h-48 rounded-xl bg-stone-100 animate-pulse" />)}
        </div>
      ) : eventos.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="w-10 h-10" />}
          title="No hay eventos con inscripción"
          description="Cuando el colegio programe una actividad con costo, aparecerá aquí para que pueda inscribir a sus hijos."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {eventos.map((evento) => <TarjetaEvento key={evento.eventoId} evento={evento} />)}
        </div>
      )}

      {inscripciones.length > 0 && (
        <Card className="overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100">
            <h3 className="font-semibold text-stone-800">Inscripciones pagadas</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr><TH>Evento</TH><TH>Fecha</TH><TH>Alumno</TH><TH className="text-right">Monto</TH><TH>Estado</TH></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {inscripciones.map((i) => (
                  <tr key={i.inscripcionId}>
                    <TD><span className="font-medium text-stone-900">{i.evento}</span></TD>
                    <TD><span className="text-xs font-mono-data text-stone-600">{new Date(i.fecha).toLocaleDateString("es-GT", { timeZone: "UTC" })}</span></TD>
                    <TD>{i.alumno}</TD>
                    <TD className="text-right"><span className="font-mono-data">{formatoQ(i.monto)}</span></TD>
                    <TD>{i.estado === "Confirmada" ? <Badge variant="success">Inscrito</Badge> : <Badge variant="info">Reembolsado</Badge>}</TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function TarjetaEvento({ evento }: { evento: EventoDisponibleDto }) {
  const carrito = useCarrito();
  const agotado = evento.cuposDisponibles !== null && evento.cuposDisponibles <= 0;

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display font-semibold text-stone-900 text-lg leading-tight">{evento.nombre}</p>
          <p className="text-sm text-stone-500 mt-0.5 capitalize">{formatoFecha(evento.fecha)}</p>
        </div>
        <span className="font-mono-data font-bold text-lg text-primary-700 shrink-0">{formatoQ(evento.costo)}</span>
      </div>

      {evento.descripcion && <p className="text-sm text-stone-600">{evento.descripcion}</p>}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant={evento.inscripcionAbierta ? "neutral" : "danger"}>
          <Clock className="w-3 h-3" />
          {evento.inscripcionAbierta ? `Inscripción hasta el ${new Date(evento.fechaLimiteInscripcion).toLocaleDateString("es-GT", { timeZone: "UTC" })}` : "Inscripción cerrada"}
        </Badge>
        {evento.cuposDisponibles !== null && (
          <Badge variant={agotado ? "danger" : evento.cuposDisponibles <= 5 ? "warning" : "neutral"}>
            <Users className="w-3 h-3" />
            {agotado ? "Sin cupos" : `${evento.cuposDisponibles} cupo${evento.cuposDisponibles === 1 ? "" : "s"} disponible${evento.cuposDisponibles === 1 ? "" : "s"}`}
          </Badge>
        )}
      </div>

      <ul className="divide-y divide-stone-100 border-t border-stone-100 mt-auto">
        {evento.alumnos.map((alumno) => {
          const clave = claveEvento(alumno.alumnoId, evento.eventoId);
          const enCarrito = carrito.contiene(clave);
          return (
            <li key={alumno.alumnoId} className="flex items-center justify-between gap-3 py-2.5">
              <span className="text-sm text-stone-800 truncate">{alumno.nombre}</span>
              {alumno.inscrito ? (
                <Badge variant="success"><Check className="w-3 h-3" />Inscrito</Badge>
              ) : enCarrito ? (
                <Btn variant="ghost" size="sm" onClick={() => carrito.quitar(clave)}>
                  <ShoppingCart className="w-4 h-4 text-primary-700" />En el carrito · Quitar
                </Btn>
              ) : (
                <Btn
                  variant="outline"
                  size="sm"
                  icon={<Ticket className="w-4 h-4" />}
                  disabled={!evento.inscripcionAbierta || agotado}
                  onClick={() => carrito.agregar({
                    clave,
                    tipo: "evento",
                    alumnoId: alumno.alumnoId,
                    eventoId: evento.eventoId,
                    alumno: alumno.nombre,
                    descripcion: evento.nombre,
                    monto: evento.costo,
                  })}
                >
                  Inscribir
                </Btn>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Mensualidades vencidas o del mes en curso de cada hijo, listas para sugerirlas en el carrito. */
async function mensualidadesPendientes(hijos: { alumnoId: number; nombre: string }[]): Promise<ItemCarrito[]> {
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const cuentas = await Promise.all(hijos.map((h) => getEstadoCuenta(h.alumnoId, anio).catch(() => null)));

  return hijos.flatMap((hijo, i) =>
    (cuentas[i]?.detalle ?? [])
      .filter((m) => m.mes <= mesActual && m.montoAPagar > 0 && (m.estado === "Sin registrar" || m.estado === "Pendiente"))
      .map((m): ItemCarrito => ({
        clave: claveColegiatura(hijo.alumnoId, anio, m.mes),
        tipo: "colegiatura",
        alumnoId: hijo.alumnoId,
        anioLectivo: anio,
        mes: m.mes,
        alumno: hijo.nombre,
        descripcion: `Colegiatura ${m.nombreMes} ${anio}`,
        monto: m.montoAPagar,
      })),
  );
}

import { useCallback, useEffect, useRef, useState } from "react";
import { CalendarDays, Check, Clock, CreditCard, FileSignature, Users, X } from "../components/Iconos";
import { AlertBanner, Badge, Btn, Card, EmptyState, SectionHeader } from "../components/Ui";
import { PagoStripeModal, formatoQ } from "../components/PagoColegiatura";
import { ResumenOrden } from "../components/CargosPendientes";
import { crearIntentOrden, getCirculares, responderCircular, verificarOrden, type CircularDto, type EstadoAutorizacion } from "../lib/api";
import type { View } from "../types";
import { leerCircularPendiente, limpiarCircularPendiente } from "../lib/circularPendiente";

const formatoFecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-GT", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type AlumnoCircular = CircularDto["alumnos"][number];


// Participaciones autorizadas que este encargado puede pagar ya
const pagables = (c: CircularDto) =>
  c.plazoAbierto ? c.alumnos.filter((a) => a.estado === "Autorizada" && a.puedePagar && a.inscripcionId !== null) : [];

type Cobro = { clave: string; circular: string; inscripciones: number[] };

/**
 * Circulares de autorización: el colegio pide permiso para que cada hijo participe en un evento
 * (excursión, actividad, etc.), con o sin costo. Si tiene costo, al autorizar queda un cargo en
 * Pagos hasta la fecha límite; si no se paga a tiempo la participación se cancela, sin mora.
 */
export default function CircularesPadre({ onNavigate }: { onNavigate?: (v: View) => void }) {
  const [circulares, setCirculares] = useState<CircularDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  // "eventoId-alumnoId-autoriza" de la respuesta que se está enviando
  const [enviando, setEnviando] = useState<string | null>(null);
  const [cobro, setCobro] = useState<Cobro | null>(null);
  // Circular del enlace del correo: se resalta y se lleva a la vista
  const [enfocada] = useState(leerCircularPendiente);
  const enfocadaVista = useRef(false);

  const cargar = useCallback(async (): Promise<CircularDto[] | null> => {
    try {
      const data = await getCirculares();
      setCirculares(data);
      return data;
    } catch (e) {
      setError((e as Error).message);
      setCirculares((prev) => prev ?? []);
      return null;
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  useEffect(() => {
    if (enfocada === null || circulares === null || enfocadaVista.current) return;
    enfocadaVista.current = true;
    limpiarCircularPendiente();
    if (circulares.some((c) => c.eventoId === enfocada)) {
      document.getElementById(`circular-${enfocada}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      setError("La circular del enlace ya no está disponible o no corresponde a sus hijos.");
    }
  }, [enfocada, circulares]);

  function pagar(circular: CircularDto, inscripciones: number[]) {
    setAviso(null);
    setCobro({ clave: `circular-${Date.now()}`, circular: circular.nombre, inscripciones });
  }

  async function responder(circular: CircularDto, alumno: AlumnoCircular, autoriza: boolean) {
    setEnviando(`${circular.eventoId}-${alumno.alumnoId}-${autoriza}`);
    setError(null);
    setAviso(null);
    try {
      const { message } = await responderCircular(circular.eventoId, alumno.alumnoId, autoriza);
      setAviso(`${alumno.nombre.split(" ")[0]} — ${circular.nombre}: ${message}`);
      const data = await cargar();
      // Autorizar una actividad con costo lleva de una vez al pago de esa participación
      if (autoriza && circular.costo > 0) {
        const nueva = data?.find((c) => c.eventoId === circular.eventoId)?.alumnos.find((a) => a.alumnoId === alumno.alumnoId);
        if (nueva?.estado === "Autorizada" && nueva.puedePagar && nueva.inscripcionId !== null) {
          pagar(circular, [nueva.inscripcionId]);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setEnviando(null);
    }
  }

  const porPagar = (circulares ?? []).flatMap((c) => c.alumnos.filter((a) => a.estado === "Autorizada" && a.puedePagar));
  const sinResponder = (circulares ?? []).filter((c) => c.plazoAbierto && c.alumnos.some((a) => a.estado === null && a.puedeResponder));

  return (
    <div className="space-y-5">
      <SectionHeader title="Circulares" subtitle="Autorice la participación de sus hijos en las actividades del colegio" />

      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso(null)} />}
      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      {porPagar.length > 0 && (
        <Card className="p-4 border-warning-200 bg-warning-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <Clock className="w-4 h-4 text-warning-700 mt-0.5 shrink-0" />
              <p className="text-sm text-warning-800">
                Tiene {porPagar.length} participación{porPagar.length === 1 ? "" : "es"} autorizada{porPagar.length === 1 ? "" : "s"} pendiente{porPagar.length === 1 ? "" : "s"} de pago.
                Puede pagarlas junto con la mensualidad.
              </p>
            </div>
            {onNavigate && (
              <Btn variant="outline" size="sm" icon={<CreditCard className="w-4 h-4" />} onClick={() => onNavigate("pad-pagos")}>
                Ir a Pagos
              </Btn>
            )}
          </div>
        </Card>
      )}

      {circulares === null ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1].map((i) => <div key={i} className="h-48 rounded-xl bg-stone-100 animate-pulse" />)}
        </div>
      ) : circulares.length === 0 ? (
        <EmptyState
          icon={<FileSignature className="w-10 h-10" />}
          title="No hay circulares"
          description="Cuando el colegio organice una actividad que necesite su autorización, aparecerá aquí."
        />
      ) : (
        <>
          {sinResponder.length > 0 && (
            <p className="text-sm text-stone-600">
              {sinResponder.length} circular{sinResponder.length === 1 ? "" : "es"} esperando su respuesta.
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {circulares.map((c) => (
              <TarjetaCircular key={c.eventoId} circular={c} enviando={enviando} resaltada={c.eventoId === enfocada}
                onResponder={responder} onPagar={pagar} />
            ))}
          </div>
        </>
      )}

      <PagoStripeModal
        clave={cobro?.clave ?? null}
        tituloInicial={cobro ? `Pago: ${cobro.circular}` : "Pago de la actividad"}
        preparar={async () => {
          const intent = await crearIntentOrden((cobro?.inscripciones ?? []).map((inscripcionId) => ({ tipo: "evento", inscripcionId })));
          return {
            clientSecret: intent.clientSecret,
            monto: intent.total,
            titulo: `Pago: ${cobro?.circular ?? "actividad"}`,
            resumen: <ResumenOrden intent={intent} />,
          };
        }}
        verificar={verificarOrden}
        onClose={() => setCobro(null)}
        onTerminado={(tipo) => {
          if (tipo === "exitoso") setAviso("Pago realizado. La participación quedó confirmada y recibirá el comprobante por correo.");
          if (tipo === "procesando") setAviso("Su banco está procesando el pago. La participación se confirmará en cuanto se acredite.");
          cargar();
        }}
      />
    </div>
  );
}

function TarjetaCircular({ circular, enviando, resaltada, onResponder, onPagar }: {
  circular: CircularDto;
  enviando: string | null;
  resaltada: boolean;
  onResponder: (c: CircularDto, a: AlumnoCircular, autoriza: boolean) => void;
  onPagar: (c: CircularDto, inscripciones: number[]) => void;
}) {
  const sinCupo = circular.cuposDisponibles === 0;
  const porPagar = pagables(circular);

  return (
    <div id={`circular-${circular.eventoId}`} className={`scroll-mt-24 rounded-xl ${resaltada ? "ring-2 ring-primary-500 ring-offset-2" : ""}`}>
    <Card className="p-5 flex flex-col gap-4 h-full">
      <div>
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-semibold text-stone-900">{circular.nombre}</h3>
          {circular.costo > 0
            ? <span className="font-mono-data font-bold text-primary-700 shrink-0">{formatoQ(circular.costo)}</span>
            : <Badge variant="success">Sin costo</Badge>}
        </div>
        {circular.descripcion && <p className="text-sm text-stone-600 mt-1">{circular.descripcion}</p>}
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-stone-500">
          <span className="flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" />{formatoFecha(circular.fecha)}</span>
          {circular.cuposDisponibles !== null && (
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />
              {sinCupo ? "Sin cupos disponibles" : `${circular.cuposDisponibles} de ${circular.cupoMaximo} cupos disponibles`}
            </span>
          )}
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />
            {circular.plazoAbierto
              ? `Responder${circular.costo > 0 ? " y pagar" : ""} a más tardar el ${new Date(circular.fechaLimite).toLocaleDateString("es-GT", { timeZone: "UTC" })}`
              : "El plazo para responder cerró"}
          </span>
        </div>
      </div>

      <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
        {circular.alumnos.map((a) => {
          const clave = `${circular.eventoId}-${a.alumnoId}`;
          const pagada = a.estado === "Confirmada" && (a.monto ?? 0) > 0;
          const puedeCambiar = circular.plazoAbierto && a.puedeResponder && !pagada && a.estado !== "Reembolsada";
          // Autorizar de nuevo necesita cupo; quien ya lo tiene apartado no cuenta
          const ofreceAutorizar = puedeCambiar && a.estado !== "Autorizada" && a.estado !== "Confirmada" && !sinCupo;
          const ofreceNoAutorizar = puedeCambiar && a.estado !== "NoAutorizada";
          const ofrecePagar = porPagar.some((p) => p.alumnoId === a.alumnoId);

          return (
            <li key={a.alumnoId} className="px-3 py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-stone-900">{a.nombre}</span>
                <EstadoBadge estado={a.estado} pagada={pagada} />
              </div>
              {(ofreceAutorizar || ofreceNoAutorizar || ofrecePagar) && (
                <div className="flex flex-wrap gap-2">
                  {ofreceAutorizar && (
                    <Btn size="sm" variant="primary" icon={<Check className="w-4 h-4" />} loading={enviando === `${clave}-true`} disabled={enviando !== null}
                      onClick={() => onResponder(circular, a, true)}>
                      {circular.costo > 0 ? `Autorizar y pagar (${formatoQ(circular.costo)})` : "Autorizo"}
                    </Btn>
                  )}
                  {ofrecePagar && (
                    <Btn size="sm" variant="primary" icon={<CreditCard className="w-4 h-4" />} disabled={enviando !== null}
                      onClick={() => onPagar(circular, [a.inscripcionId as number])}>
                      Pagar ahora ({formatoQ(a.monto ?? circular.costo)})
                    </Btn>
                  )}
                  {ofreceNoAutorizar && (
                    <Btn size="sm" variant="outline" icon={<X className="w-4 h-4" />} loading={enviando === `${clave}-false`} disabled={enviando !== null}
                      onClick={() => onResponder(circular, a, false)}>
                      {a.estado === null ? "No autorizo" : "Retirar autorización"}
                    </Btn>
                  )}
                </div>
              )}
              {a.estado === null && !a.puedeResponder && (
                <p className="text-xs text-stone-500">La responde el encargado principal o el responsable de pagos.</p>
              )}
              {a.estado === null && a.puedeResponder && circular.plazoAbierto && sinCupo && (
                <p className="text-xs text-stone-500">Ya no hay cupos para autorizar.</p>
              )}
            </li>
          );
        })}
      </ul>

      {porPagar.length > 1 && (
        <Btn variant="primary" icon={<CreditCard className="w-4 h-4" />} disabled={enviando !== null}
          onClick={() => onPagar(circular, porPagar.map((p) => p.inscripcionId as number))}>
          Pagar las {porPagar.length} participaciones ({formatoQ(porPagar.reduce((suma, p) => suma + (p.monto ?? circular.costo), 0))})
        </Btn>
      )}
    </Card>
    </div>
  );
}

function EstadoBadge({ estado, pagada }: { estado: EstadoAutorizacion | null; pagada: boolean }) {
  if (estado === null) return <Badge variant="warning">Sin responder</Badge>;
  if (estado === "Autorizada") return <Badge variant="info">Autorizada · pendiente de pago</Badge>;
  if (estado === "Confirmada") return <Badge variant="success">{pagada ? "Autorizada y pagada" : "Autorizada"}</Badge>;
  if (estado === "NoAutorizada") return <Badge variant="neutral">No autorizada</Badge>;
  if (estado === "Cancelada") return <Badge variant="danger">Cancelada · no se pagó a tiempo</Badge>;
  return <Badge variant="info">Reembolsada</Badge>;
}

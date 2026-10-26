import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CheckCircle2, CreditCard, GraduationCap } from "./Iconos";
import { AlertBanner, Badge, Btn, Card } from "./Ui";
import { PagoStripeModal, formatoQ } from "./PagoColegiatura";
import { crearIntentOrden, getCargosPendientes, verificarOrden, type CargoPendienteDto, type IntentOrdenDto } from "../lib/api";

/**
 * Estado de cuenta del encargado: todo lo que tiene por pagar de sus hijos (colegiaturas vencidas y
 * del mes, y eventos que autorizó). Elige qué pagar y se cobra junto en una sola orden; el servidor
 * valida cada concepto y calcula el total real.
 */
export const claveCargo = (c: CargoPendienteDto) =>
  c.tipo === "evento" ? `e-${c.inscripcionId}` : `c-${c.alumnoId}-${c.anioLectivo}-${c.mes}`;

const formatoFecha = (iso: string) => new Date(iso).toLocaleDateString("es-GT", { day: "numeric", month: "short", timeZone: "UTC" });

export default function CargosPendientes({ onPagado }: { onPagado?: () => void }) {
  const [cargos, setCargos] = useState<CargoPendienteDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  // Cobros que el banco sigue procesando: siguen Pendientes hasta el webhook, no se deben ofrecer otra vez
  const [enProceso, setEnProceso] = useState<Set<string>>(new Set());
  // Clave del cobro en curso (null = modal cerrado). Cambia en cada intento para preparar uno nuevo.
  const [cobro, setCobro] = useState<string | null>(null);
  const [pagado, setPagado] = useState(false);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const data = await getCargosPendientes();
      setCargos(data);
      // Por defecto va todo marcado; el encargado desmarca lo que no quiere pagar todavía
      setElegidos(new Set(data.map(claveCargo)));
    } catch (e) {
      setError((e as Error).message);
      setCargos((prev) => prev ?? []);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = (cargos ?? []).filter((c) => !enProceso.has(claveCargo(c)));
  const seleccion = visibles.filter((c) => elegidos.has(claveCargo(c)));
  const total = seleccion.reduce((suma, c) => suma + c.monto, 0);

  function alternar(clave: string) {
    setElegidos((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(clave)) nuevo.delete(clave);
      else nuevo.add(clave);
      return nuevo;
    });
  }

  if (cargos === null) return <div className="h-28 rounded-xl bg-stone-100 animate-pulse" />;

  if (visibles.length === 0) {
    return (
      <>
        {pagado && <AlertBanner type="success" title="Pago realizado" message="Los conceptos pagados quedaron registrados. Recibirá el comprobante por correo." onClose={() => setPagado(false)} />}
        {error ? <AlertBanner type="error" title="No se pudieron cargar los cargos pendientes" message={error} /> : (
          <Card className="p-4 flex items-center gap-3 border-success-200 bg-success-50">
            <CheckCircle2 className="w-5 h-5 text-success-700 shrink-0" />
            <p className="text-sm text-success-800">No tiene cargos pendientes. Puede adelantar mensualidades desde la tabla de colegiaturas.</p>
          </Card>
        )}
      </>
    );
  }

  // Agrupado por alumno: así el encargado ve qué está pagando por cada hijo
  const porAlumno = new Map<number, { alumno: string; cargos: CargoPendienteDto[] }>();
  for (const cargo of visibles) {
    const grupo = porAlumno.get(cargo.alumnoId) ?? { alumno: cargo.alumno, cargos: [] };
    grupo.cargos.push(cargo);
    porAlumno.set(cargo.alumnoId, grupo);
  }

  return (
    <>
      {pagado && <AlertBanner type="success" title="Pago realizado" message="Los conceptos pagados quedaron registrados. Recibirá el comprobante por correo." onClose={() => setPagado(false)} />}
      {error && <AlertBanner type="error" message={error} onClose={() => setError(null)} />}

      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100">
          <h3 className="font-semibold text-stone-800">Cargos pendientes</h3>
          <p className="text-xs text-stone-500 mt-0.5">Marque lo que desea pagar y páguelo en un solo cobro. La beca aplica solo a las mensualidades.</p>
        </div>

        <div className="divide-y divide-stone-100">
          {[...porAlumno.entries()].map(([alumnoId, grupo]) => (
            <div key={alumnoId} className="px-5 py-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-stone-500 mb-1">{grupo.alumno}</p>
              <ul>
                {grupo.cargos.map((cargo) => {
                  const clave = claveCargo(cargo);
                  return (
                    <li key={clave}>
                      <label className="flex items-center gap-3 py-2 cursor-pointer">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-primary-700 cursor-pointer"
                          checked={elegidos.has(clave)}
                          onChange={() => alternar(clave)}
                        />
                        <span className={`p-1.5 rounded-md ${cargo.tipo === "evento" ? "bg-info-50 text-info-700" : "bg-primary-50 text-primary-700"}`}>
                          {cargo.tipo === "evento" ? <CalendarDays className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-medium text-stone-900 truncate">{cargo.descripcion}</span>
                          <span className="block text-xs text-stone-500">
                            {cargo.tipo === "evento"
                              ? `Evento del ${formatoFecha(cargo.fechaEvento)} · pagar a más tardar el ${formatoFecha(cargo.fechaLimite)}`
                              : "Mensualidad"}
                          </span>
                        </span>
                        {cargo.tipo === "colegiatura" && cargo.vencido && <Badge variant="danger">Vencida</Badge>}
                        <span className="font-mono-data text-sm text-stone-900 w-24 text-right">{formatoQ(cargo.monto)}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-stone-100 bg-stone-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <p className="text-sm text-stone-600">
            {seleccion.length} de {visibles.length} concepto{visibles.length === 1 ? "" : "s"} ·{" "}
            <span className="font-mono-data font-bold text-lg text-primary-700">{formatoQ(total)}</span>
          </p>
          <Btn
            variant="primary"
            icon={<CreditCard className="w-4 h-4" />}
            disabled={seleccion.length === 0}
            onClick={() => { setPagado(false); setCobro(`orden-${Date.now()}`); }}
          >
            Pagar seleccionados
          </Btn>
        </div>
      </Card>

      <PagoStripeModal
        clave={cobro}
        tituloInicial="Pago de cargos"
        preparar={async () => {
          const intent = await crearIntentOrden(seleccion.map((c) =>
            c.tipo === "evento"
              ? { tipo: "evento", inscripcionId: c.inscripcionId }
              : { tipo: "colegiatura", alumnoId: c.alumnoId, anioLectivo: c.anioLectivo, mes: c.mes },
          ));
          return {
            clientSecret: intent.clientSecret,
            monto: intent.total,
            titulo: `Pago de ${intent.lineas.length} concepto${intent.lineas.length === 1 ? "" : "s"}`,
            resumen: <ResumenOrden intent={intent} />,
          };
        }}
        verificar={verificarOrden}
        onClose={() => setCobro(null)}
        onTerminado={(tipo) => {
          if (tipo === "procesando") setEnProceso((prev) => new Set([...prev, ...seleccion.map(claveCargo)]));
          if (tipo === "exitoso") setPagado(true);
          cargar();
          onPagado?.();
        }}
      />
    </>
  );
}

export function ResumenOrden({ intent }: { intent: IntentOrdenDto }) {
  return (
    <div className="rounded-lg bg-sand-50 border border-sand-200 p-4 space-y-2 text-sm">
      {intent.lineas.map((linea, i) => (
        <div key={i} className="flex justify-between gap-3 text-stone-600">
          <span className="min-w-0">
            <span className="text-stone-900">{linea.descripcion}</span>
            <span className="block text-xs text-stone-500">{linea.alumno}</span>
          </span>
          <span className="font-mono-data shrink-0">{formatoQ(linea.monto)}</span>
        </div>
      ))}
      <div className="flex justify-between items-baseline pt-2 border-t border-sand-200">
        <span className="font-semibold text-stone-900">Total a pagar</span>
        <span className="font-mono-data font-bold text-lg text-primary-700">{formatoQ(intent.total)}</span>
      </div>
    </div>
  );
}

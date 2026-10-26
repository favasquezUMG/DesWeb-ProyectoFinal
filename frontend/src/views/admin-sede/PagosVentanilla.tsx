import { useEffect, useState } from "react";
import { Search, CreditCard, Printer } from "../../components/Iconos";
import { Card, SectionHeader, Btn, Badge, Modal, AlertBanner, Input, Select, EmptyState, TH, TD, TablaResponsiva } from "../../components/Ui";
import {
  buscarAlumnosVentanilla, getEstadoCuenta, getEventosPendientesVentanilla, registrarPagoVentanilla, METODOS_PAGO,
  type AlumnoVentanillaDto, type EstadoCuentaDto, type EventoPendienteDto, type MetodoPago, type PagoVentanillaDto,
} from "../../lib/api";
import { formatQ } from "../../lib/becas";

// Cobro en ventanilla: el padre llega a pagar en persona y la secretaría registra lo que recibió.

const anio = new Date().getFullYear();
const mesActual = new Date().getMonth() + 1;

// Un mes se puede cobrar si no está pagado, exonerado ni marcado como "No aplica", y tiene monto
const cobrable = (m: EstadoCuentaDto["detalle"][number]) =>
  (m.estado === "Sin registrar" || m.estado === "Pendiente") && m.montoAPagar > 0;

export default function PagosVentanillaView() {
  const [q, setQ] = useState("");
  const [resultados, setResultados] = useState<AlumnoVentanillaDto[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [alumno, setAlumno] = useState<AlumnoVentanillaDto | null>(null);
  const [cuenta, setCuenta] = useState<EstadoCuentaDto | null>(null);
  const [eventos, setEventos] = useState<EventoPendienteDto[]>([]);
  const [cargando, setCargando] = useState(false);
  const [meses, setMeses] = useState<Set<number>>(new Set());
  const [eventosSel, setEventosSel] = useState<Set<number>>(new Set());
  const [metodo, setMetodo] = useState<MetodoPago>("Efectivo");
  const [referencia, setReferencia] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [recibo, setRecibo] = useState<PagoVentanillaDto | null>(null);

  useEffect(() => {
    if (q.trim().length < 2) { setResultados([]); return; }
    const t = setTimeout(() => {
      setBuscando(true);
      buscarAlumnosVentanilla(q.trim())
        .then(setResultados)
        .catch((e) => setError(e instanceof Error ? e.message : "No se pudo buscar."))
        .finally(() => setBuscando(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  async function cargarAlumno(a: AlumnoVentanillaDto) {
    setAlumno(a);
    setCargando(true);
    setError("");
    setMeses(new Set());
    setEventosSel(new Set());
    try {
      const [c, e] = await Promise.all([getEstadoCuenta(a.alumnoId, anio), getEventosPendientesVentanilla(a.alumnoId)]);
      setCuenta(c);
      setEventos(e);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el estado de cuenta.");
    } finally {
      setCargando(false);
    }
  }

  function alternar<T>(set: Set<T>, valor: T): Set<T> {
    const nuevo = new Set(set);
    if (nuevo.has(valor)) nuevo.delete(valor); else nuevo.add(valor);
    return nuevo;
  }

  const mesesCobrables = cuenta?.detalle.filter(cobrable) ?? [];
  const total = mesesCobrables.filter((m) => meses.has(m.mes)).reduce((s, m) => s + m.montoAPagar, 0)
    + eventos.filter((e) => eventosSel.has(e.inscripcionId)).reduce((s, e) => s + e.monto, 0);
  const cantidad = meses.size + eventosSel.size;
  const faltaReferencia = metodo !== "Efectivo" && !referencia.trim();

  async function registrar() {
    if (!alumno) return;
    setGuardando(true);
    setError("");
    try {
      const res = await registrarPagoVentanilla(alumno.alumnoId, {
        colegiaturas: [...meses].map((mes) => ({ anioLectivo: anio, mes })),
        eventos: [...eventosSel],
        metodo,
        referencia: referencia.trim() || undefined,
      });
      setConfirmar(false);
      setRecibo(res.data);
      setReferencia("");
      await cargarAlumno(alumno);
    } catch (err) {
      setConfirmar(false);
      setError(err instanceof Error ? err.message : "No se pudo registrar el pago.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Pagos en ventanilla" subtitle="Registre lo que un padre paga en persona: colegiaturas y eventos autorizados" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Card className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar alumno por nombre o apellido…" aria-label="Buscar alumno"
            className="w-full pl-10 pr-3.5 py-2.5 text-[15px] border-[1.5px] border-stone-200 hover:border-stone-300 rounded-xl focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 bg-white" />
        </div>
        {q.trim().length >= 2 && (
          <ul className="mt-2 divide-y divide-stone-100">
            {buscando && resultados.length === 0 && <li className="py-3 text-sm text-stone-500">Buscando…</li>}
            {!buscando && resultados.length === 0 && <li className="py-3 text-sm text-stone-500">No se encontraron alumnos.</li>}
            {resultados.map((r) => (
              <li key={r.alumnoId}>
                <button onClick={() => { cargarAlumno(r); setQ(""); }}
                  className="w-full text-left py-2.5 px-2 rounded-lg hover:bg-sand-50 cursor-pointer flex items-center justify-between gap-3">
                  <span className="font-semibold text-stone-900">{r.nombre}</span>
                  <span className="text-xs text-stone-500">{r.grado} "{r.seccion}" · {r.sede}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {!alumno ? (
        <EmptyState icon={<CreditCard className="w-10 h-10" />} title="Busque al alumno" description="Escriba el nombre del alumno para ver lo que tiene pendiente de pago." />
      ) : cargando && !cuenta ? (
        <div className="h-40 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />
      ) : cuenta && (
        <>
          <Card className="overflow-hidden">
            <div className="px-6 pt-5 pb-2">
              <h3 className="font-display font-bold text-lg text-stone-900">{alumno.nombre}</h3>
              <p className="text-sm text-stone-500">{alumno.grado} "{alumno.seccion}" · {alumno.sede} · Colegiaturas {anio}</p>
            </div>
            <TablaResponsiva>
              <table className="w-full">
                <thead><tr><TH>Cobrar</TH><TH>Concepto</TH><TH>Estado</TH><TH className="text-right">Monto</TH></tr></thead>
                <tbody className="divide-y divide-stone-100">
                  {cuenta.detalle.map((m) => {
                    const puede = cobrable(m);
                    return (
                      <tr key={m.mes} className={puede ? "hover:bg-sand-50" : "text-stone-400"}>
                        <TD>
                          <input type="checkbox" className="w-4 h-4 accent-primary-700" disabled={!puede} checked={meses.has(m.mes)}
                            onChange={() => setMeses((s) => alternar(s, m.mes))} aria-label={`Cobrar ${m.nombreMes}`} />
                        </TD>
                        <TD><span className="font-medium">Colegiatura {m.nombreMes}</span></TD>
                        <TD>
                          {m.estado === "Pagado" ? <Badge variant="success">Pagado</Badge>
                            : m.estado === "No aplica" ? <Badge variant="neutral">No aplica</Badge>
                            : m.estado === "Exonerado" || m.montoAPagar <= 0 ? <Badge variant="info">Beca</Badge>
                            : m.mes < mesActual ? <Badge variant="danger">Vencido</Badge>
                            : <Badge variant="warning">Pendiente</Badge>}
                        </TD>
                        <TD className="text-right"><span className="font-mono-data">{m.estado === "Pagado" && m.monto !== null ? formatQ(m.monto) : puede ? formatQ(m.montoAPagar) : "—"}</span></TD>
                      </tr>
                    );
                  })}
                  {eventos.map((e) => (
                    <tr key={`e-${e.inscripcionId}`} className="hover:bg-sand-50">
                      <TD>
                        <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={eventosSel.has(e.inscripcionId)}
                          onChange={() => setEventosSel((s) => alternar(s, e.inscripcionId))} aria-label={`Cobrar ${e.nombre}`} />
                      </TD>
                      <TD><span className="font-medium">{e.nombre}</span></TD>
                      <TD><Badge variant="warning">{e.fechaLimite ? `Pagar antes del ${new Date(e.fechaLimite).toLocaleDateString("es-GT")}` : "Autorizado"}</Badge></TD>
                      <TD className="text-right"><span className="font-mono-data">{formatQ(e.monto)}</span></TD>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TablaResponsiva>
            {mesesCobrables.length === 0 && eventos.length === 0 && (
              <p className="px-6 py-4 text-sm text-success-700">Este alumno no tiene nada pendiente de pago.</p>
            )}
          </Card>

          {(mesesCobrables.length > 0 || eventos.length > 0) && (
            <Card className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                <Select label="Método de pago" value={metodo} onChange={(e) => setMetodo(e.target.value as MetodoPago)}>
                  {METODOS_PAGO.map((m) => <option key={m}>{m}</option>)}
                </Select>
                <Input label={metodo === "Efectivo" ? "No. de recibo (opcional)" : "No. de boleta, voucher o cheque"} value={referencia} maxLength={60}
                  onChange={(e) => setReferencia(e.target.value)} />
                <div className="text-right">
                  <p className="text-xs text-stone-500">{cantidad} concepto(s)</p>
                  <p className="font-display font-bold text-2xl text-stone-900 tabular-nums">{formatQ(total)}</p>
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <Btn variant="primary" disabled={cantidad === 0 || faltaReferencia} onClick={() => setConfirmar(true)}>Registrar pago</Btn>
              </div>
            </Card>
          )}
        </>
      )}

      <Modal open={confirmar} onClose={() => !guardando && setConfirmar(false)} title="Confirmar pago"
        footer={<>
          <Btn variant="ghost" onClick={() => setConfirmar(false)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={registrar}>Confirmar {formatQ(total)}</Btn>
        </>}>
        <p className="text-sm text-stone-600">
          Se registrarán como pagados {cantidad} concepto(s) de <strong>{alumno?.nombre}</strong> por <strong>{formatQ(total)}</strong>, recibidos en <strong>{metodo}</strong>
          {referencia.trim() && <> (ref. {referencia.trim()})</>}. Confirme que ya recibió el dinero.
        </p>
      </Modal>

      <Modal open={!!recibo} onClose={() => setRecibo(null)} title="Pago registrado"
        footer={<>
          <Btn variant="outline" icon={<Printer className="w-4 h-4" />} onClick={() => window.print()}>Imprimir</Btn>
          <Btn variant="primary" onClick={() => setRecibo(null)}>Listo</Btn>
        </>}>
        {recibo && (
          <div className="space-y-3 text-sm recibo-imprimible">
            <p className="hidden print:block font-display font-bold text-lg">Colegio Vanguardia · Recibo de pago</p>
            <p className="text-stone-600">{recibo.alumno} · {new Date(recibo.fecha).toLocaleString("es-GT")}</p>
            <ul className="divide-y divide-stone-100">
              {recibo.lineas.map((l) => (
                <li key={l.descripcion} className="flex justify-between py-1.5"><span>{l.descripcion}</span><span className="font-mono-data">{formatQ(l.monto)}</span></li>
              ))}
            </ul>
            <p className="flex justify-between font-bold text-stone-900 border-t border-stone-200 pt-2"><span>Total</span><span className="font-mono-data">{formatQ(recibo.total)}</span></p>
            <p className="text-stone-500">Método: {recibo.metodo}{recibo.referencia ? ` · Ref. ${recibo.referencia}` : ""}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}

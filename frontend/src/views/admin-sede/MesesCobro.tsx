import { useEffect, useState } from "react";
import { Badge, Btn, Modal, AlertBanner, Select } from "../../components/Ui";
import { getEstadoCuenta, setMesesCobro, type MesEstadoCuentaDto } from "../../lib/api";

// Meses del ciclo en que se cobra colegiatura a un alumno. Para el que llega de otro colegio
// con el ciclo empezado (solo paga desde que se inscribió) y para casos especiales.

/** Habilitar o deshabilitar el cobro de colegiatura de un alumno, mes por mes */
export function ModalMesesCobro({ alumno, onCerrar, onGuardado }: {
  alumno: { alumnoId: number; nombre: string } | null;
  onCerrar: () => void;
  onGuardado: (mensaje: string) => void;
}) {
  const anio = new Date().getFullYear();
  const [meses, setMeses] = useState<MesEstadoCuentaDto[]>([]);
  const [sinCobro, setSinCobro] = useState<Set<number>>(new Set());
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!alumno) return;
    setCargando(true);
    setError("");
    setMeses([]);
    getEstadoCuenta(alumno.alumnoId, anio)
      .then((cuenta) => {
        setMeses(cuenta.detalle);
        setSinCobro(new Set(cuenta.detalle.filter((m) => m.estado === "No aplica").map((m) => m.mes)));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el estado de cuenta."))
      .finally(() => setCargando(false));
  }, [alumno, anio]);

  // Un mes pagado no se puede quitar desde aquí (habría que reembolsarlo)
  const bloqueado = (m: MesEstadoCuentaDto) => m.estado === "Pagado";

  function alternar(mes: number) {
    setSinCobro((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(mes)) nuevo.delete(mes); else nuevo.add(mes);
      return nuevo;
    });
  }

  // Atajo: cobrar desde un mes en adelante (los anteriores quedan sin cobro, salvo los ya pagados)
  function cobrarDesde(desde: number) {
    setSinCobro(new Set(meses.filter((m) => m.mes < desde && !bloqueado(m)).map((m) => m.mes)));
  }

  async function guardar() {
    if (!alumno) return;
    setGuardando(true);
    setError("");
    try {
      const res = await setMesesCobro(alumno.alumnoId, anio, [...sinCobro]);
      onGuardado(res.message);
      onCerrar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron guardar los meses de cobro.");
    } finally {
      setGuardando(false);
    }
  }

  const primerCobro = meses.find((m) => !sinCobro.has(m.mes))?.mes ?? "";

  return (
    <Modal open={!!alumno} onClose={() => !guardando && onCerrar()} title={`Cobro de colegiatura ${anio}`}
      footer={<>
        <Btn variant="ghost" onClick={onCerrar} disabled={guardando}>Cancelar</Btn>
        <Btn variant="primary" loading={guardando} disabled={cargando || meses.length === 0} onClick={guardar}>Guardar</Btn>
      </>}>
      <div className="space-y-4">
        <p className="text-sm text-stone-600">
          <span className="font-semibold text-stone-900">{alumno?.nombre}</span>. Los meses deshabilitados no se le cobran
          ni cuentan como mora; el encargado los ve como "No aplica".
        </p>

        {cargando ? (
          <p className="text-sm text-stone-500 py-6 text-center">Cargando…</p>
        ) : meses.length > 0 && (
          <>
            <Select label="Cobrar a partir de" value={primerCobro} onChange={(e) => cobrarDesde(Number(e.target.value))}>
              {meses.map((m) => <option key={m.mes} value={m.mes}>{m.nombreMes}</option>)}
            </Select>

            <ul className="grid grid-cols-2 gap-2">
              {meses.map((m) => {
                const cobra = !sinCobro.has(m.mes);
                return (
                  <li key={m.mes}>
                    <label className={`flex items-center justify-between gap-2 px-3 py-2 rounded-xl border-[1.5px] text-sm ${cobra ? "border-primary-200 bg-primary-50/40" : "border-stone-200 text-stone-400"} ${bloqueado(m) ? "cursor-not-allowed" : "cursor-pointer"}`}>
                      <span className="flex items-center gap-2">
                        <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={cobra} disabled={bloqueado(m)}
                          onChange={() => alternar(m.mes)} />
                        <span className="font-medium">{m.nombreMes}</span>
                      </span>
                      {m.estado === "Pagado" ? <Badge variant="success">Pagado</Badge>
                        : m.estado === "Exonerado" ? <Badge variant="info">Beca</Badge>
                        : !cobra ? <Badge variant="neutral">No aplica</Badge> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-stone-400">
              Un mes ya pagado no se puede deshabilitar. Si el encargado había empezado a pagar un mes que deshabilita, ese pago se cancela.
            </p>
          </>
        )}

        {error && <AlertBanner type="error" message={error} />}
      </div>
    </Modal>
  );
}

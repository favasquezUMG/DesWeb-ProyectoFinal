import { useEffect, useState } from "react";
import { Wallet, Users2, Gauge } from "lucide-react";
import { Card, Btn, AlertBanner, Input } from "../../../components/Ui";
import { guardarPoliticaBecas, type ResumenBecasDto } from "../../../lib/api";
import { formatQ } from "../../../lib/becas";

export default function PoliticaBecas({ resumen, onCambio }: {
  resumen: ResumenBecasDto;
  onCambio: (mensaje: string) => Promise<void>;
}) {
  const politica = resumen.politica;
  const [presupuesto, setPresupuesto] = useState("");
  const [hermanos, setHermanos] = useState("0");
  const [maximo, setMaximo] = useState("100");
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPresupuesto(politica?.presupuestoMensual == null ? "" : String(politica.presupuestoMensual));
    setHermanos(String(politica?.descuentoHermanos ?? 0));
    setMaximo(String(politica?.descuentoMaximo ?? 100));
  }, [politica]);

  async function guardar() {
    setGuardando(true);
    setError("");
    try {
      await guardarPoliticaBecas({
        anioLectivo: resumen.anioLectivo,
        presupuestoMensual: presupuesto === "" ? null : Number(presupuesto),
        descuentoHermanos: Number(hermanos || 0),
        descuentoMaximo: Number(maximo || 100),
      });
      await onCambio("Política de becas guardada.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la política.");
    } finally {
      setGuardando(false);
    }
  }

  const colegiatura = resumen.colegiaturaMensual;
  const ejemploBeca = 50;
  const ejemploTotal = Math.min(ejemploBeca + Number(hermanos || 0), Math.max(Number(maximo || 100), ejemploBeca), 100);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5 lg:col-span-2">
        <h3 className="font-semibold text-stone-800">Política de becas — ciclo {resumen.anioLectivo}</h3>
        <p className="text-sm text-stone-500 mt-1 mb-5">Reglas generales que se aplican a todas las becas de la sede.</p>

        {error && <div className="mb-4"><AlertBanner type="error" message={error} onClose={() => setError("")} /></div>}
        {politica && !politica.configurada && (
          <div className="mb-4"><AlertBanner type="info" message="La sede aún no tiene política para este ciclo: no hay límite de presupuesto ni descuento por hermanos." /></div>
        )}

        <div className="space-y-5">
          <div className="flex gap-3">
            <span className="p-2 h-fit rounded-lg bg-primary-50 text-primary-700"><Wallet className="w-4 h-4" /></span>
            <div className="flex-1">
              <Input label="Presupuesto mensual de becas" type="number" min="0" value={presupuesto}
                onChange={(e) => setPresupuesto(e.target.value)} placeholder="Sin límite" prefix={<span className="text-sm">Q</span>} />
              <p className="text-xs text-stone-500 mt-1">
                Máximo que la sede puede dejar de cobrar al mes por becas. Hoy se usan {formatQ(resumen.presupuestoUsado)}.
                No se podrá asignar ni aprobar una beca que lo supere.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="p-2 h-fit rounded-lg bg-action-50 text-action-600"><Users2 className="w-4 h-4" /></span>
            <div className="flex-1">
              <Input label="Descuento por hermanos" type="number" min="0" max="100" value={hermanos}
                onChange={(e) => setHermanos(e.target.value)} suffix={<span className="text-sm">%</span>} />
              <p className="text-xs text-stone-500 mt-1">
                Se aplica automáticamente en la colegiatura del segundo hijo en adelante de un mismo encargado (el mayor paga completo).
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="p-2 h-fit rounded-lg bg-warning-50 text-warning-700"><Gauge className="w-4 h-4" /></span>
            <div className="flex-1">
              <Input label="Tope de descuento combinado" type="number" min="0" max="100" value={maximo}
                onChange={(e) => setMaximo(e.target.value)} suffix={<span className="text-sm">%</span>} />
              <p className="text-xs text-stone-500 mt-1">
                Límite para beca + descuento por hermanos juntos. Nunca reduce una beca por debajo de lo otorgado.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Btn variant="primary" size="sm" loading={guardando} onClick={guardar}>Guardar política</Btn>
        </div>
      </Card>

      <Card className="p-5 h-fit textile-pattern-light bg-sand-50">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">Ejemplo</p>
        <p className="text-sm text-stone-700 mt-2">
          Un segundo hijo con beca del {ejemploBeca}% pagaría:
        </p>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between"><dt className="text-stone-500">Colegiatura</dt><dd className="font-mono-data">{formatQ(colegiatura)}</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">Beca</dt><dd className="font-mono-data">{ejemploBeca}%</dd></div>
          <div className="flex justify-between"><dt className="text-stone-500">Hermanos</dt><dd className="font-mono-data">{Number(hermanos || 0)}%</dd></div>
          <div className="flex justify-between border-t border-stone-200 pt-1.5"><dt className="text-stone-500">Descuento aplicado</dt><dd className="font-mono-data">{ejemploTotal}%</dd></div>
          <div className="flex justify-between font-semibold"><dt>Total a pagar</dt><dd className="font-mono-data text-primary-700">{formatQ(colegiatura * (1 - ejemploTotal / 100))}</dd></div>
        </dl>
      </Card>
    </div>
  );
}

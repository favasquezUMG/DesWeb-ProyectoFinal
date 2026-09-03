import { useState } from "react";
import { CreditCard, CheckCircle2, AlertCircle, AlertTriangle, Download, ChevronRight, Lock, User, Bell, BookOpen, X } from "lucide-react";
import type { View } from "../types";
import { PAGOS, NOTAS_ALUMNO } from "../data";
import {
  Card, MetricCard, SectionHeader, Btn, Badge, PagoBadge, EstadoBadge,
  AlertBanner, Stepper, TH, TD
} from "../components/Ui";

// ─── Dashboard Padre ──────────────────────────────────────────────────────────

function DashboardPadre() {
  const [hijo, setHijo] = useState("María José Ajú Pac");
  const hijos = ["María José Ajú Pac", "Pedro José Ajú Pac"];

  const cursosConNotas = NOTAS_ALUMNO.filter(c => c.u1 !== null);
  const promedioGeneral = Math.round(
    cursosConNotas.reduce((acc, c) => {
      const vals = [c.u1, c.u2, c.u3].filter(v => v !== null) as number[];
      return acc + (vals.reduce((a, b) => a + b, 0) / vals.length);
    }, 0) / cursosConNotas.length
  );

  const pagoPendiente = PAGOS.filter(p => p.estado === "vencido" || p.estado === "pendiente");

  return (
    <div className="space-y-6">
      {/* Child selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <SectionHeader title="Panel del Encargado" subtitle="Sra. Rosa Elena Pac Cuc" />
        <div className="flex items-center gap-2 sm:ml-auto shrink-0">
          <span className="text-sm text-stone-500">Viendo:</span>
          <div className="flex gap-1">
            {hijos.map(h => (
              <button key={h} onClick={() => setHijo(h)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer
                  ${hijo === h ? "bg-primary-700 text-white" : "bg-white border border-stone-200 text-stone-700 hover:border-primary-300"}`}>
                {h.split(" ")[0]} {h.split(" ")[1]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {pagoPendiente.length > 0 && (
        <AlertBanner
          type="error"
          title={`Pago vencido — ${hijo.split(" ")[0]}`}
          message={`La cuota de junio 2025 (Q1,125.00) está vencida desde el 01/06/2025. Regularice su cuenta para evitar recargos.`}
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Promedio general" value={promedioGeneral} sub={hijo.split(" ")[0]} icon={<BookOpen className="w-5 h-5" />} variant={promedioGeneral >= 61 ? "success" : "danger"} />
        <MetricCard label="Cursos" value={`${NOTAS_ALUMNO.filter(c => { const v = [c.u1, c.u2, c.u3].filter(Boolean) as number[]; return v.length > 0 && v.reduce((a, b) => a + b) / v.length >= 61; }).length}/${NOTAS_ALUMNO.length}`} sub="Aprobados al 3ra unidad" icon={<CheckCircle2 className="w-5 h-5" />} variant="success" />
        <MetricCard label="Beca aplicada" value="10%" sub="Q125.00 de descuento" icon={<Badge variant="success" className="text-base">%</Badge>} />
        <MetricCard label="Próximo pago" value="Q1,125.00" sub="Julio 2025 · Pendiente" icon={<CreditCard className="w-5 h-5" />} variant="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-800 text-base">Resumen académico</h3>
            <button className="text-xs text-primary-700 hover:underline flex items-center gap-1">Ver completo <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2">
            {NOTAS_ALUMNO.slice(0, 5).map(c => {
              const vals = [c.u1, c.u2, c.u3].filter(v => v !== null) as number[];
              const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
              return (
                <div key={c.curso} className="flex items-center justify-between py-1.5 border-b border-stone-50 last:border-0">
                  <span className="text-sm text-stone-700">{c.curso}</span>
                  <div className="flex items-center gap-2">
                    {prom !== null && <span className={`font-mono-data font-bold text-sm ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>}
                    {prom !== null && <EstadoBadge aprobado={prom >= 61} />}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-800 text-base">Estado de cuenta</h3>
            <button className="text-xs text-primary-700 hover:underline flex items-center gap-1">Ver historial <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          <div className="space-y-2">
            {PAGOS.slice(-5).map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-stone-50 last:border-0">
                <div>
                  <span className="text-sm text-stone-700">{p.mes}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-data text-sm text-stone-700">Q{p.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span>
                  <PagoBadge estado={p.estado} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Matrícula ────────────────────────────────────────────────────────────────

type MatriculaStep = 0 | 1 | 2 | 3;

function MatriculaView() {
  const [step, setStep] = useState<MatriculaStep>(0);
  const [formData, setFormData] = useState({
    nombre: "", apellidos: "", nacimiento: "", dpi: "",
    sede: "Sede Central", grado: "Primero Básico",
  });
  const [pagado, setPagado] = useState(false);
  const [procesando, setProcesando] = useState(false);

  const pasos = ["Datos del alumno", "Sede y grado", "Confirmar malla", "Pago"];

  function handlePagar() {
    setProcesando(true);
    setTimeout(() => {
      setProcesando(false);
      setPagado(true);
    }, 2000);
  }

  const cursosGrado = [
    "Matemática", "Comunicación y Lenguaje", "Ciencias Naturales",
    "Estudios Sociales", "Tecnologías del Aprendizaje", "Inglés",
    "Educación Física", "Expresión Artística", "Formación Ciudadana",
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Matrícula" subtitle="Inscripción de alumno — Ciclo escolar 2025" />

      <Stepper steps={pasos} current={step} />

      {/* Step 0: Student data */}
      {step === 0 && (
        <Card className="p-6">
          <h3 className="font-display font-semibold text-stone-900 text-lg mb-1">Datos del alumno</h3>
          <p className="text-stone-500 text-sm mb-5">Complete los datos personales del alumno a inscribir.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            {[
              ["Primer nombre", "nombre", "Ej. María José"],
              ["Primer apellido", "apellidos", "Ej. Ajú"],
              ["Fecha de nacimiento", "nacimiento", "dd/mm/aaaa"],
              ["CUI / DPI del alumno", "dpi", "0000 00000 0101"],
            ].map(([label, key, ph]) => (
              <div key={key}>
                <label className="text-sm font-medium text-stone-700 block mb-1">{label}</label>
                <input placeholder={ph}
                  value={formData[key as keyof typeof formData]}
                  onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                  className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
              </div>
            ))}
          </div>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={() => setStep(1)}>Continuar <ChevronRight className="w-4 h-4" /></Btn>
          </div>
        </Card>
      )}

      {/* Step 1: Sede and grade */}
      {step === 1 && (
        <Card className="p-6">
          <h3 className="font-display font-semibold text-stone-900 text-lg mb-1">Sede y grado</h3>
          <p className="text-stone-500 text-sm mb-5">Seleccione la sede y el grado al que se inscribirá el alumno. Los cursos se asignan automáticamente según la malla del grado.</p>
          <div className="space-y-4 mb-6">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-2">Sede</label>
              <div className="space-y-2">
                {["Sede Central — Guatemala City", "Sede Xela — Quetzaltenango", "Sede Coatepeque — Coatepeque"].map(s => {
                  const val = s.split(" — ")[0];
                  return (
                    <button key={s} onClick={() => setFormData(prev => ({ ...prev, sede: val }))}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer text-left
                        ${formData.sede === val ? "border-primary-700 bg-primary-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${formData.sede === val ? "border-primary-700" : "border-stone-300"}`}>
                        {formData.sede === val && <div className="w-2 h-2 rounded-full bg-primary-700" />}
                      </div>
                      <span className="text-sm font-medium text-stone-800">{s}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Grado</label>
              <select value={formData.grado} onChange={e => setFormData(prev => ({ ...prev, grado: e.target.value }))}
                className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>Primero Básico</option>
                <option>Segundo Básico</option>
                <option>Tercero Básico</option>
              </select>
            </div>
          </div>
          <div className="flex justify-between">
            <Btn variant="ghost" onClick={() => setStep(0)}>← Volver</Btn>
            <Btn variant="primary" onClick={() => setStep(2)}>Continuar <ChevronRight className="w-4 h-4" /></Btn>
          </div>
        </Card>
      )}

      {/* Step 2: Confirm curriculum */}
      {step === 2 && (
        <Card className="p-6">
          <h3 className="font-display font-semibold text-stone-900 text-lg mb-1">Malla curricular de {formData.grado}</h3>
          <p className="text-stone-500 text-sm mb-5">El alumno será inscrito en los siguientes cursos del CNB. No puede seleccionar cursos individuales.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
            {cursosGrado.map(c => (
              <div key={c} className="flex items-center gap-2.5 px-3 py-2.5 bg-primary-50 border border-primary-100 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-primary-600 shrink-0" />
                <span className="text-sm font-medium text-primary-900">{c}</span>
              </div>
            ))}
          </div>
          <AlertBanner type="info" message={`Al continuar, confirma la inscripción de ${formData.nombre || "el alumno"} en ${formData.grado} — ${formData.sede}.`} />
          <div className="flex justify-between mt-4">
            <Btn variant="ghost" onClick={() => setStep(1)}>← Volver</Btn>
            <Btn variant="primary" onClick={() => setStep(3)}>Continuar al pago <ChevronRight className="w-4 h-4" /></Btn>
          </div>
        </Card>
      )}

      {/* Step 3: Payment */}
      {step === 3 && (
        <Card className="p-6">
          {!pagado ? (
            <>
              <h3 className="font-display font-semibold text-stone-900 text-lg mb-1">Pago de inscripción</h3>
              <p className="text-stone-500 text-sm mb-5">Pague con tarjeta de débito o crédito de forma segura.</p>

              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 mb-5 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-stone-600">Inscripción — {formData.grado}</span><span className="font-mono-data">Q350.00</span></div>
                <div className="flex justify-between"><span className="text-stone-600">Primera mensualidad</span><span className="font-mono-data">Q1,250.00</span></div>
                <div className="flex justify-between text-success-700"><span>Beca (10%)</span><span className="font-mono-data">−Q125.00</span></div>
                <div className="border-t border-stone-200 pt-2 flex justify-between font-semibold"><span>Total a pagar</span><span className="font-mono-data font-bold text-primary-800">Q1,475.00</span></div>
              </div>

              <div className="space-y-4 mb-5">
                <div>
                  <label className="text-sm font-medium text-stone-700 block mb-1">Número de tarjeta</label>
                  <div className="relative">
                    <input placeholder="1234 5678 9012 3456" maxLength={19}
                      className="w-full border border-stone-300 rounded-lg pl-3 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 font-mono-data" />
                    <CreditCard className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-stone-700 block mb-1">Vencimiento</label>
                    <input placeholder="MM/AA" maxLength={5} className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 font-mono-data" />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-stone-700 block mb-1">CVV</label>
                    <input placeholder="···" maxLength={4} type="password" className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 font-mono-data" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-stone-700 block mb-1">Nombre en la tarjeta</label>
                  <input placeholder="Como aparece en la tarjeta" className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-stone-400 mb-4">
                <Lock className="w-3.5 h-3.5" />Pago procesado de forma segura con <span className="font-semibold">Stripe</span>. Sus datos están cifrados.
              </div>

              <div className="flex justify-between gap-3">
                <Btn variant="ghost" onClick={() => setStep(2)}>← Volver</Btn>
                <Btn variant="secondary" size="lg" loading={procesando} onClick={handlePagar} icon={<Lock className="w-4 h-4" />}>
                  {procesando ? "Procesando pago…" : "Pagar Q1,475.00"}
                </Btn>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-success-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success-600" />
              </div>
              <h3 className="font-display text-2xl font-bold text-success-800 mb-2">¡Matrícula completada!</h3>
              <p className="text-stone-600 mb-1">Pago de <span className="font-mono-data font-semibold">Q1,475.00</span> procesado exitosamente.</p>
              <p className="text-stone-500 text-sm mb-6">Se enviará un comprobante a <strong>rpac.encargado@gmail.com</strong>.</p>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 text-left text-sm mb-6 max-w-xs mx-auto">
                <div className="flex justify-between mb-1"><span className="text-stone-500">Alumno</span><span className="font-medium">{formData.nombre || "María José"} Ajú Pac</span></div>
                <div className="flex justify-between mb-1"><span className="text-stone-500">Grado</span><span className="font-medium">{formData.grado}</span></div>
                <div className="flex justify-between mb-1"><span className="text-stone-500">Sede</span><span className="font-medium">{formData.sede}</span></div>
                <div className="flex justify-between"><span className="text-stone-500">Referencia</span><span className="font-mono-data text-xs">CN-2025-08741</span></div>
              </div>
              <Btn variant="outline" icon={<Download className="w-4 h-4" />}>Descargar comprobante PDF</Btn>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// ─── Notas del Hijo ───────────────────────────────────────────────────────────

function NotasHijo() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <SectionHeader title="Notas y Reportes" subtitle="María José Ajú Pac · 3ro Básico A" />
        <Btn variant="outline" size="sm" icon={<Download className="w-4 h-4" />}>Descargar PDF</Btn>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {NOTAS_ALUMNO.map(c => {
          const vals = [c.u1, c.u2, c.u3, c.u4].filter(v => v !== null) as number[];
          const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
          return (
            <Card key={c.curso} className="p-4">
              <div className="flex justify-between items-start mb-3">
                <p className="font-semibold text-stone-900">{c.curso}</p>
                {prom !== null && <EstadoBadge aprobado={prom >= 61} />}
              </div>
              <div className="grid grid-cols-4 gap-2 mb-2">
                {[c.u1, c.u2, c.u3, c.u4].map((nota, i) => (
                  <div key={i} className="text-center">
                    <p className="text-[10px] text-stone-400 mb-1">U{i + 1}</p>
                    <span className={`font-mono-data text-sm font-semibold ${nota === null ? "text-stone-300" : nota >= 61 ? "text-success-700" : "text-danger-700"}`}>
                      {nota ?? "—"}
                    </span>
                  </div>
                ))}
              </div>
              {prom !== null && (
                <div className="flex justify-between text-sm border-t border-stone-100 pt-2">
                  <span className="text-stone-500">Promedio</span>
                  <span className={`font-mono-data font-bold ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-200">
                <TH>Curso</TH>
                <TH className="text-center">I Unidad</TH>
                <TH className="text-center">II Unidad</TH>
                <TH className="text-center">III Unidad</TH>
                <TH className="text-center">IV Unidad</TH>
                <TH className="text-center">Promedio</TH>
                <TH className="text-center">Estado</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {NOTAS_ALUMNO.map(c => {
                const notas = [c.u1, c.u2, c.u3, c.u4];
                const vals = notas.filter(v => v !== null) as number[];
                const prom = vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
                return (
                  <tr key={c.curso} className="hover:bg-stone-50 transition-colors">
                    <TD><span className="font-medium text-stone-900">{c.curso}</span></TD>
                    {notas.map((nota, i) => (
                      <TD key={i} className="text-center">
                        {nota !== null ? (
                          <span className={`font-mono-data font-semibold px-2 py-0.5 rounded-md text-sm
                            ${nota >= 61 ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}
                            aria-label={nota >= 61 ? `${nota}, aprobado` : `${nota}, reprobado`}>
                            {nota}
                          </span>
                        ) : <span className="text-stone-300 font-mono-data">—</span>}
                      </TD>
                    ))}
                    <TD className="text-center">
                      {prom !== null ? <span className={`font-mono-data font-bold text-base ${prom >= 61 ? "text-success-700" : "text-danger-700"}`}>{prom}</span> : "—"}
                    </TD>
                    <TD className="text-center">
                      {prom !== null ? <EstadoBadge aprobado={prom >= 61} /> : <span className="text-xs text-stone-400">Pendiente</span>}
                    </TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Pagos ────────────────────────────────────────────────────────────────────

type PagoEstado = "idle" | "procesando" | "exitoso" | "rechazado";
// eslint-disable-next-line

function PagosView() {
  const [pagoEstado, setPagoEstado] = useState<PagoEstado>("idle");
  const [pagoSeleccionado, setPagoSeleccionado] = useState<string | null>(null);

  const pagoPendiente = PAGOS.find(p => p.estado === "vencido" || p.estado === "pendiente");

  function handlePagar(id: string) {
    setPagoSeleccionado(id);
    setPagoEstado("procesando");
    setTimeout(() => setPagoEstado("exitoso"), 2000);
  }

  const totalDeuda = PAGOS.filter(p => p.estado !== "pagado").reduce((a, p) => a + p.total, 0);

  return (
    <div className="space-y-5">
      <SectionHeader title="Pagos y Estado de Cuenta" subtitle="María José Ajú Pac · Sede Central" />

      {pagoEstado === "exitoso" && (
        <AlertBanner type="success" title="Pago realizado exitosamente" message="Su pago de Q1,125.00 fue procesado. Recibirá un comprobante en rpac.encargado@gmail.com." onClose={() => setPagoEstado("idle")} />
      )}

      {pagoEstado === "rechazado" && (
        <AlertBanner type="error" title="Pago rechazado" message="Su tarjeta fue rechazada. Verifique los datos o intente con otra forma de pago." onClose={() => setPagoEstado("idle")} />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="sm:col-span-2">
          <MetricCard label="Saldo pendiente" value={`Q${totalDeuda.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`} sub={`${PAGOS.filter(p => p.estado !== "pagado").length} cuotas pendientes`} variant={totalDeuda > 0 ? "danger" : "success"} />
        </div>
        <MetricCard label="Mensualidad" value="Q1,125.00" sub="Beca 10% aplicada (−Q125.00)" />
      </div>

      {/* Quick pay for overdue */}
      {pagoPendiente && (pagoEstado as unknown as string) === "idle" && (
        <Card className="p-5 border-2 border-danger-200 bg-danger-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <AlertCircle className="w-4 h-4 text-danger-700" />
                <p className="font-semibold text-danger-900">Cuota vencida — {pagoPendiente.mes}</p>
              </div>
              <p className="text-sm text-danger-700">Monto: <span className="font-mono-data font-bold">Q{pagoPendiente.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></p>
            </div>
            <Btn variant="destructive" icon={<CreditCard className="w-4 h-4" />} onClick={() => handlePagar(pagoPendiente.id)} loading={(pagoEstado as string) === "procesando"}>
              {(pagoEstado as string) === "procesando" ? "Procesando…" : `Pagar Q${pagoPendiente.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}`}
            </Btn>
          </div>
        </Card>
      )}

      {/* Payment history */}
      <Card className="overflow-hidden">
        <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
          <h3 className="font-semibold text-stone-800">Historial de pagos — Ciclo 2025</h3>
          <Btn variant="ghost" size="sm" icon={<Download className="w-3.5 h-3.5" />}>Estado de cuenta PDF</Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Concepto</TH><TH className="text-right">Mensualidad</TH><TH className="text-right">Beca</TH><TH className="text-right">Total</TH><TH>Estado</TH><TH>Fecha de pago</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {PAGOS.map(p => (
                <tr key={p.id} className="hover:bg-stone-50 transition-colors">
                  <TD><span className="font-medium text-stone-900">{p.mes}</span></TD>
                  <TD className="text-right"><span className="font-mono-data text-stone-700">Q{p.monto.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                  <TD className="text-right"><span className="font-mono-data text-success-700">−Q{p.beca.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                  <TD className="text-right"><span className="font-mono-data font-semibold text-stone-900">Q{p.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                  <TD><PagoBadge estado={p.estado} /></TD>
                  <TD><span className="text-stone-500 text-xs font-mono-data">{p.fecha ?? "—"}</span></TD>
                  <TD className="text-right">
                    {p.estado === "pagado" ? (
                      <button className="text-xs text-primary-700 hover:underline flex items-center gap-1"><Download className="w-3 h-3" />Recibo</button>
                    ) : (
                      <Btn variant="secondary" size="sm" onClick={() => handlePagar(p.id)} loading={pagoEstado === "procesando" && pagoSeleccionado === p.id}>
                        Pagar
                      </Btn>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Perfil ───────────────────────────────────────────────────────────────────

function PerfilView() {
  const [saved, setSaved] = useState(false);
  const notifOptions = [
    { key: "notas", label: "Publicación de notas", desc: "Cuando el catedrático publica notas de una unidad" },
    { key: "pagos", label: "Recordatorio de pago", desc: "5 días antes del vencimiento de la cuota mensual" },
    { key: "avisos", label: "Avisos institucionales", desc: "Comunicados generales de la sede" },
    { key: "asistencia", label: "Ausencias del alumno", desc: "Cuando el alumno es marcado como ausente" },
    { key: "eventos", label: "Eventos del calendario", desc: "Recordatorio un día antes de cada evento" },
  ];
  const [notifState, setNotifState] = useState<Record<string, boolean>>(
    Object.fromEntries(notifOptions.map(n => [n.key, true]))
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Perfil y Preferencias" subtitle="Gestione sus datos personales y notificaciones" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card className="p-6">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Datos personales</h3>
          <div className="flex items-center gap-4 mb-5">
            <div className="w-16 h-16 rounded-full bg-primary-700 flex items-center justify-center text-white font-bold text-xl">RP</div>
            <div>
              <p className="font-semibold text-stone-900">Sra. Rosa Elena Pac Cuc</p>
              <p className="text-sm text-stone-500">rpac.encargado@gmail.com</p>
              <p className="text-xs text-stone-400 mt-0.5">Padre / Encargado</p>
            </div>
          </div>
          <div className="space-y-3">
            {[["Nombre completo", "Rosa Elena Pac Cuc"], ["Correo electrónico", "rpac.encargado@gmail.com"], ["Teléfono", "(502) 5555-8891"], ["DPI", "1234 56789 0101"]].map(([k, v]) => (
              <div key={k}>
                <label className="text-xs font-medium text-stone-500 block mb-1">{k}</label>
                <input defaultValue={v} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            {saved && <span className="text-xs text-success-700 flex items-center gap-1 mr-3 py-2"><CheckCircle2 className="w-3.5 h-3.5" />Datos actualizados</span>}
            <Btn variant="primary" size="sm" onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 2000); }}>Guardar cambios</Btn>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-display font-semibold text-stone-900 mb-1 flex items-center gap-2"><Bell className="w-4 h-4 text-stone-400" />Preferencias de notificación</h3>
          <p className="text-sm text-stone-500 mb-4">Seleccione qué notificaciones desea recibir por correo electrónico.</p>
          <div className="space-y-3">
            {notifOptions.map(n => (
              <div key={n.key} className="flex items-start justify-between gap-3 py-2 border-b border-stone-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-stone-800">{n.label}</p>
                  <p className="text-xs text-stone-500">{n.desc}</p>
                </div>
                <button
                  role="switch"
                  aria-checked={notifState[n.key]}
                  onClick={() => setNotifState(prev => ({ ...prev, [n.key]: !prev[n.key] }))}
                  className={`relative w-10 h-6 rounded-full transition-colors duration-200 shrink-0 mt-0.5 cursor-pointer
                    ${notifState[n.key] ? "bg-primary-700" : "bg-stone-300"}`}
                  aria-label={`${n.label}: ${notifState[n.key] ? "activo" : "inactivo"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${notifState[n.key] ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ))}
          </div>
          <div className="flex justify-end mt-4">
            <Btn variant="outline" size="sm">Guardar preferencias</Btn>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function Padre({ view }: { view: View }) {
  if (view === "pad-matricula") return <MatriculaView />;
  if (view === "pad-notas") return <NotasHijo />;
  if (view === "pad-pagos") return <PagosView />;
  if (view === "pad-perfil") return <PerfilView />;
  return <DashboardPadre />;
}

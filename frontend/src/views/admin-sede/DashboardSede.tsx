import { AlertTriangle, Users, Award, CheckCircle2 } from "lucide-react";
import { Card, MetricCard, SectionHeader } from "../../components/Ui";

// ─── Dashboard de Sede ────────────────────────────────────────────────────────

export default function DashboardSede() {
  return (
    <div className="space-y-6">
      <SectionHeader title="Dashboard — Sede Central" subtitle="Ciclo escolar 2025 · Al 25/08/2025" />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Alumnos inscritos" value="842" sub="↑ 18 vs. ciclo anterior" icon={<Users className="w-5 h-5" />} />
        <MetricCard label="Tasa de aprobación" value="87%" sub="Promedio todas las unidades" icon={<CheckCircle2 className="w-5 h-5" />} variant="success" />
        <MetricCard label="Pagos vencidos" value="12%" sub="101 cuentas por cobrar" icon={<AlertTriangle className="w-5 h-5" />} variant="warning" />
        <MetricCard label="Becas activas" value="64" sub="7.6% del alumnado" icon={<Award className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Distribución por grado</h3>
          <div className="space-y-3">
            {[
              { grado: "Primero Básico", total: 286, aprobados: 249 },
              { grado: "Segundo Básico", total: 275, aprobados: 242 },
              { grado: "Tercero Básico", total: 281, aprobados: 244 },
            ].map(g => (
              <div key={g.grado}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-stone-700 font-medium">{g.grado}</span>
                  <span className="font-mono-data text-stone-500">{g.aprobados}/{g.total} aprobados</span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div className="bg-success-600 h-2 rounded-full" style={{ width: `${Math.round(g.aprobados / g.total * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Alertas recientes</h3>
          <div className="space-y-2.5">
            {[
              { type: "danger" as const, msg: "Diego Cuc Toj — pago de junio vencido desde el 01/06/2025" },
              { type: "warning" as const, msg: "José Antonio Tzoc — promedio por debajo de 61 en Matemática" },
              { type: "warning" as const, msg: "Carlos Enrique Sis — promedio general en riesgo (43 pts.)" },
              { type: "info" as const, msg: "Exámenes de Cuarta Unidad programados para el 27/10/2025" },
            ].map((a, i) => {
              const cls = { danger: "bg-danger-50 text-danger-800 border-danger-200", warning: "bg-warning-50 text-warning-800 border-warning-200", info: "bg-info-50 text-info-800 border-info-200" }[a.type];
              return <div key={i} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${cls}`}><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />{a.msg}</div>;
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { AlertTriangle, Users, Award, CheckCircle2, CalendarDays, FileText, FileCheck2, UserX } from "lucide-react";
import { Card, MetricCard, SectionHeader, AlertBanner } from "../../components/Ui";
import { getDashboardSede, type DashboardSedeDto } from "../../lib/api";
import { formatFecha } from "../../lib/becas";

export default function DashboardSede() {
  const [data, setData] = useState<DashboardSedeDto | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getDashboardSede()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudo cargar el resumen de la sede."));
  }, []);

  if (error) return <div className="space-y-6"><SectionHeader title="Dashboard" /><AlertBanner type="error" message={error} /></div>;
  if (!data) {
    return (
      <div className="space-y-6">
        <SectionHeader title="Dashboard" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl bg-stone-100 animate-pulse" />)}
        </div>
      </div>
    );
  }

  const diferencia = data.alumnos.total - data.alumnos.anterior;
  const pendientes = [
    { n: data.pendientes.solicitudes, texto: "solicitud(es) de inscripción por resolver", Icon: FileText, cls: "bg-info-50 text-info-800 border-info-200" },
    { n: data.pendientes.justificaciones, texto: "justificación(es) de ausencia por revisar", Icon: FileCheck2, cls: "bg-info-50 text-info-800 border-info-200" },
    { n: data.pendientes.sinEncargado, texto: "alumno(s) sin encargado vigente", Icon: UserX, cls: "bg-danger-50 text-danger-800 border-danger-200" },
  ].filter((p) => p.n > 0);

  return (
    <div className="space-y-6">
      <SectionHeader title={`Dashboard — ${data.sede}`} subtitle={`Ciclo escolar ${data.anioLectivo} · Al ${new Date().toLocaleDateString("es-GT")}`} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Alumnos inscritos" value={data.alumnos.total}
          sub={data.alumnos.anterior ? `${diferencia >= 0 ? "↑" : "↓"} ${Math.abs(diferencia)} vs. ciclo anterior` : "Primer ciclo registrado"}
          icon={<Users className="w-5 h-5" />} />
        <MetricCard label="Tasa de aprobación" value={data.aprobacion.porcentaje !== null ? `${data.aprobacion.porcentaje}%` : "—"}
          sub={data.aprobacion.evaluados ? `Promedio general ${data.aprobacion.promedio} · ${data.aprobacion.evaluados} evaluados` : "Aún no hay notas"}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant={data.aprobacion.porcentaje === null ? "default" : data.aprobacion.porcentaje >= 80 ? "success" : "warning"} />
        <MetricCard label="Pagos vencidos" value={`${data.mora.porcentaje}%`} sub={`${data.mora.alumnos} cuenta(s) con cuotas atrasadas`}
          icon={<AlertTriangle className="w-5 h-5" />} variant={data.mora.porcentaje > 15 ? "danger" : data.mora.porcentaje > 0 ? "warning" : "success"} />
        <MetricCard label="Becas activas" value={data.becas.activas} sub={`${data.becas.porcentaje}% del alumnado`} icon={<Award className="w-5 h-5" />} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Aprobación por grado</h3>
          {data.porGrado.length === 0 ? <p className="text-sm text-stone-500">No hay alumnos inscritos en este ciclo.</p> : (
            <div className="space-y-3">
              {data.porGrado.map((g) => {
                const pct = g.evaluados ? Math.round((g.aprobados / g.evaluados) * 100) : 0;
                return (
                  <div key={g.grado}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-stone-700 font-medium">{g.grado}</span>
                      <span className="font-mono-data text-stone-500">
                        {g.evaluados ? `${g.aprobados}/${g.evaluados} aprobados` : `${g.total} alumnos · sin notas`}
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-2">
                      <div className={`h-2 rounded-full ${pct >= 80 ? "bg-success-600" : pct >= 60 ? "bg-warning-500" : "bg-danger-600"}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Alertas</h3>
          <div className="space-y-2.5">
            {pendientes.map((p) => (
              <div key={p.texto} className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs ${p.cls}`}>
                <p.Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span><strong>{p.n}</strong> {p.texto}</span>
              </div>
            ))}
            {data.enRiesgo.map((a) => (
              <div key={a.alumnoId} className="flex items-start gap-2 p-2.5 rounded-lg border text-xs bg-warning-50 text-warning-800 border-warning-200">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{a.nombre} ({a.grado}) — promedio {a.promedio}{a.cursosReprobados ? `, ${a.cursosReprobados} curso(s) bajo 61` : ""}</span>
              </div>
            ))}
            {data.proximosEventos.map((e) => (
              <div key={e.eventoId} className="flex items-start gap-2 p-2.5 rounded-lg border text-xs bg-primary-50 text-primary-800 border-primary-200">
                <CalendarDays className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span>{e.nombre} — {formatFecha(e.fecha)}</span>
              </div>
            ))}
            {pendientes.length === 0 && data.enRiesgo.length === 0 && data.proximosEventos.length === 0 && (
              <p className="text-sm text-stone-500">Sin alertas por ahora.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

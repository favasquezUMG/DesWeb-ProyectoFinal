import { useEffect, useState } from "react";
import { AlertTriangle, Users, Award, CheckCircle2, FileText, FileCheck2, UserX } from "../../components/Iconos";
import { Card, MetricCard, SectionHeader, AlertBanner, FechaBloque } from "../../components/Ui";
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
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}
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
      <SectionHeader title={data.sede} subtitle={`Ciclo escolar ${data.anioLectivo} · Al ${new Date().toLocaleDateString("es-GT")}`} />

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

      {pendientes.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {pendientes.map((p) => (
            <div key={p.texto} className={`flex items-center gap-3 pl-2 pr-5 py-2 rounded-full ${p.Icon === UserX ? "bg-danger-50 text-danger-800" : "bg-white border border-stone-200/80 text-stone-700"}`}>
              <span className={`w-9 h-9 rounded-full shrink-0 flex items-center justify-center font-display font-bold text-base tabular-nums ${p.Icon === UserX ? "bg-danger-600 text-white" : "bg-action-500 text-white"}`}>{p.n}</span>
              <span className="text-sm font-semibold">{p.texto}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <Card className="p-6 lg:col-span-3">
          <h3 className="font-display font-bold text-stone-900 text-lg mb-5">Aprobación por grado</h3>
          {data.porGrado.length === 0 ? <p className="text-sm text-stone-500">No hay alumnos inscritos en este ciclo.</p> : (
            <div className="space-y-4">
              {data.porGrado.map((g) => {
                const pct = g.evaluados ? Math.round((g.aprobados / g.evaluados) * 100) : 0;
                return (
                  <div key={g.grado} className="grid grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-4">
                    <span className="text-[15px] font-semibold text-stone-800 truncate">{g.grado}</span>
                    <div className="w-full bg-sand-100 rounded-full h-3.5" title={g.evaluados ? `${g.aprobados} de ${g.evaluados} aprobados` : `${g.total} alumnos sin notas`}>
                      <div className={`h-3.5 rounded-full ${pct >= 80 ? "bg-primary-600" : pct >= 60 ? "bg-warning-500" : "bg-danger-600"}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-display font-bold text-lg text-right tabular-nums text-stone-900">{g.evaluados ? `${pct}%` : "—"}</span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <div className="lg:col-span-2 space-y-5">
          <Card className="p-6">
            <h3 className="font-display font-bold text-stone-900 text-lg mb-3">Alumnos en riesgo</h3>
            {data.enRiesgo.length === 0 ? <p className="text-sm text-stone-500">Ningún alumno por debajo del mínimo.</p> : (
              <ul className="divide-y divide-stone-100">
                {data.enRiesgo.map((a) => (
                  <li key={a.alumnoId} className="flex items-center gap-3 py-2.5">
                    <span className="w-9 h-9 rounded-full bg-sand-100 text-stone-700 flex items-center justify-center text-xs font-bold shrink-0">{a.nombre.split(" ").slice(0, 2).map((x) => x[0]).join("")}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-stone-900 truncate">{a.nombre}</p>
                      <p className="text-xs text-stone-500">{a.grado}{a.cursosReprobados ? `, ${a.cursosReprobados} curso(s) bajo 61` : ""}</p>
                    </div>
                    <span className="font-display font-bold text-xl text-danger-700 tabular-nums">{a.promedio}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-display font-bold text-stone-900 text-lg mb-4">Próximos eventos</h3>
            {data.proximosEventos.length === 0 ? <p className="text-sm text-stone-500">Sin eventos próximos.</p> : (
              <ul className="space-y-3">
                {data.proximosEventos.map((e, i) => (
                  <li key={e.eventoId} className="flex items-center gap-3">
                    <FechaBloque iso={e.fecha} tono={i === 0 ? "primary" : "neutral"} />
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold text-stone-900 truncate">{e.nombre}</p>
                      <p className="text-xs text-stone-500 capitalize">{formatFecha(e.fecha)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

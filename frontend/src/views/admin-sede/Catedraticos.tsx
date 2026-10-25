import { useState } from "react";
import { GraduationCap, Search } from "../../components/Iconos";
import { Card, SectionHeader, Badge, TH, TD, AlertBanner, EmptyState, colorDeCurso } from "../../components/Ui";
import { horasSemanales, useCatedraticos } from "./academico";

// Jornada semanal a partir de la cual se marca como sobrecarga
const HORAS_MAXIMAS = 40;

export default function CatedraticosView() {
  const anioActual = new Date().getFullYear();
  const { catedraticos, error } = useCatedraticos();
  const [q, setQ] = useState("");

  const filas = (catedraticos ?? [])
    .map((c) => {
      const delCiclo = c.cursos.filter((x) => x.anioLectivo === anioActual);
      return { ...c, delCiclo, horas: horasSemanales(delCiclo.flatMap((x) => x.horarios)) };
    })
    .filter((c) => `${c.nombre} ${c.email} ${c.especialidad ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  const sinCursos = filas.filter((c) => c.delCiclo.length === 0).length;

  return (
    <div className="space-y-5">
      <SectionHeader title="Catedráticos" subtitle={`Personal docente de la sede · Ciclo ${anioActual}`} />

      {error && <AlertBanner type="error" message={error} />}
      <AlertBanner type="info" message="Las cuentas de los catedráticos se crean en Usuarios; los cursos se les asignan en Cursos." />
      {sinCursos > 0 && <AlertBanner type="warning" message={`${sinCursos} catedrático(s) sin cursos asignados en ${anioActual}.`} />}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre, correo o especialidad…"
              className="w-full pl-10 pr-3.5 py-2.5 text-[15px] border-[1.5px] border-stone-200 hover:border-stone-300 rounded-xl focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10 bg-white" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><TH>Nombre</TH><TH>Correo</TH><TH>Cursos asignados</TH><TH>Carga semanal</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {!catedraticos ? (
                <tr><td colSpan={4} className="px-4 py-10 text-center text-sm text-stone-500">Cargando catedráticos…</td></tr>
              ) : filas.length === 0 ? (
                <tr><td colSpan={4}><EmptyState icon={<GraduationCap className="w-10 h-10" />} title="Sin catedráticos" description="No hay catedráticos con ese criterio." /></td></tr>
              ) : filas.map((c) => (
                <tr key={c.catedraticoId} className="hover:bg-sand-50 transition-colors">
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-action-100 text-action-800 flex items-center justify-center text-xs font-bold">
                        {c.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-semibold text-stone-900 text-[15px]">{c.nombre}</p>
                        {c.especialidad && <p className="text-xs text-stone-500">{c.especialidad}</p>}
                      </div>
                    </div>
                  </TD>
                  <TD><span className="text-stone-500 text-xs">{c.email}</span></TD>
                  <TD>
                    {c.delCiclo.length === 0 ? <span className="text-xs text-stone-400">Sin cursos</span> : (
                      <div className="flex flex-wrap gap-1">
                        {c.delCiclo.map((x) => <span key={x.cursoSeccionId} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${colorDeCurso(x.curso).soft} ${colorDeCurso(x.curso).text}`}><span className={`w-2 h-2 rounded-full ${colorDeCurso(x.curso).solid}`} />{x.curso}, {x.seccion}</span>)}
                      </div>
                    )}
                  </TD>
                  <TD>
                    <span className={`font-display font-bold tabular-nums ${c.horas > HORAS_MAXIMAS ? "text-danger-700" : "text-stone-800"}`}>{c.horas} h/sem</span>
                    {c.horas > HORAS_MAXIMAS && <Badge variant="danger" className="ml-2">Sobrecarga</Badge>}
                    {c.delCiclo.some((x) => x.horarios.length === 0) && <p className="text-[11px] text-warning-700">Hay cursos sin horario</p>}
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

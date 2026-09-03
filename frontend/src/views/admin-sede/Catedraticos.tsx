import { Plus, Edit } from "lucide-react";
import { CATEDRATICOS } from "../../data";
import { Card, SectionHeader, Btn, Badge, TH, TD } from "../../components/Ui";

// ─── Catedráticos ─────────────────────────────────────────────────────────────

export default function CatedraticosView() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Catedráticos" subtitle="Personal docente — Sede Central"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>Registrar catedrático</Btn>}
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Nombre</TH><TH>Correo</TH><TH>Cursos asignados</TH><TH>Carga semanal</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {CATEDRATICOS.map(c => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <TD><div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-action-100 text-action-800 flex items-center justify-center text-xs font-bold">{c.nombre.split(" ").map(n => n[0]).slice(1, 3).join("")}</div>
                    <span className="font-medium text-stone-900">{c.nombre}</span>
                  </div></TD>
                  <TD><span className="text-stone-500 text-xs">{c.email}</span></TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      {c.cursos.map(cur => <Badge key={cur} variant="primary" className="text-[10px]">{cur}</Badge>)}
                    </div>
                  </TD>
                  <TD><span className="font-mono-data font-semibold text-stone-800">{c.cargaHoraria} h/sem</span></TD>
                  <TD><Badge variant="success">Activo</Badge></TD>
                  <TD className="text-right">
                    <button className="p-1.5 text-stone-400 hover:text-primary-700 rounded transition-colors"><Edit className="w-4 h-4" /></button>
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

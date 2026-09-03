import { Plus, Edit, Trash2 } from "lucide-react";
import { Card, SectionHeader, Btn, TH, TD } from "../../components/Ui";

// ─── Cursos ───────────────────────────────────────────────────────────────────

export default function CursosView() {
  return (
    <div className="space-y-5">
      <SectionHeader title="Cursos" subtitle="Cursos activos — Ciclo 2025"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>Crear curso</Btn>}
      />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Curso</TH><TH>Grado · Sección</TH><TH>Catedrático</TH><TH>Alumnos</TH><TH>Horario</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {[
                { id: 1, nombre: "Matemática", grado: "Tercero Básico", sec: "A", cat: "Prof. C. Gómez", alumnos: 28, horario: "Lun/Mar/Jue/Mié" },
                { id: 2, nombre: "Comunicación y Lenguaje", grado: "Tercero Básico", sec: "A", cat: "Prof.ª S. Ramírez", alumnos: 28, horario: "Lun/Mié/Vie" },
                { id: 3, nombre: "Ciencias Naturales", grado: "Tercero Básico", sec: "A", cat: "Prof. M. Ajú", alumnos: 28, horario: "Lun/Jue" },
                { id: 4, nombre: "Inglés", grado: "Tercero Básico", sec: "A", cat: "Prof.ª J. Williams", alumnos: 28, horario: "Lun/Mié/Vie" },
                { id: 5, nombre: "Estudios Sociales", grado: "Tercero Básico", sec: "A", cat: "Prof.ª E. Morales", alumnos: 28, horario: "Mar/Jue" },
                { id: 6, nombre: "Tecnologías del Aprendizaje", grado: "Tercero Básico", sec: "A", cat: "Prof. D. Tzoc", alumnos: 28, horario: "Mar/Vie" },
              ].map(c => (
                <tr key={c.id} className="hover:bg-stone-50 transition-colors">
                  <TD><span className="font-medium text-stone-900">{c.nombre}</span></TD>
                  <TD>{c.grado} <span className="text-stone-400">·</span> Sec. {c.sec}</TD>
                  <TD>{c.cat}</TD>
                  <TD><span className="font-mono-data text-stone-700">{c.alumnos}</span></TD>
                  <TD><span className="text-stone-500 text-xs">{c.horario}</span></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button className="p-1.5 text-stone-400 hover:text-primary-700 rounded"><Edit className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-stone-400 hover:text-danger-700 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
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

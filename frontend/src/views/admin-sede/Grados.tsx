import { Plus, Edit } from "lucide-react";
import { Card, SectionHeader, Btn } from "../../components/Ui";

// ─── Grados y Secciones ───────────────────────────────────────────────────────

export default function GradosView() {
  const grados = [
    { nombre: "Primero Básico", secciones: ["A", "B"], alumnos: [142, 144] },
    { nombre: "Segundo Básico", secciones: ["A", "B"], alumnos: [138, 137] },
    { nombre: "Tercero Básico", secciones: ["A", "B"], alumnos: [142, 139] },
  ];
  return (
    <div className="space-y-5">
      <SectionHeader title="Grados y Secciones" subtitle="Estructura académica — Sede Central"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />}>Agregar grado</Btn>}
      />
      <div className="space-y-4">
        {grados.map(g => (
          <Card key={g.nombre} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-stone-900">{g.nombre}</h3>
              <Btn variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />}>Agregar sección</Btn>
            </div>
            <div className="flex gap-3 flex-wrap">
              {g.secciones.map((sec, i) => (
                <div key={sec} className="flex-1 min-w-36 bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-stone-800">Sección {sec}</p>
                    <p className="text-sm text-stone-500 font-mono-data">{g.alumnos[i]} alumnos</p>
                  </div>
                  <button className="p-1.5 text-stone-400 hover:text-primary-700 rounded transition-colors"><Edit className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

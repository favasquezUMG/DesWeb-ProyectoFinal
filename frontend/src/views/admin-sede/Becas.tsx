import { useState } from "react";
import { Plus, Edit } from "lucide-react";
import { ALUMNOS, BECAS_DATA } from "../../data";
import { Card, SectionHeader, Btn, Badge, TH, TD } from "../../components/Ui";

// ─── Becas ────────────────────────────────────────────────────────────────────

export default function BecasView() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      <SectionHeader title="Becas" subtitle="Descuentos sobre la mensualidad asignados a alumnos"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Asignar beca</Btn>}
      />

      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">Nueva beca</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-stone-700 block mb-1">Alumno</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option value="">Seleccionar alumno…</option>
                {ALUMNOS.map(a => <option key={a.id}>{a.nombre} — {a.grado} {a.seccion}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Porcentaje de descuento</label>
              <div className="relative">
                <input type="number" min="5" max="100" step="5" defaultValue="10" className="w-full border border-stone-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">%</span>
              </div>
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-stone-700 block mb-1">Motivo</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>Rendimiento académico</option>
                <option>Situación socioeconómica</option>
                <option>Hermano inscrito</option>
                <option>Hijo de catedrático</option>
                <option>Otro</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Desde</label>
              <input type="text" defaultValue="08/2025" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Btn variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn>
            <Btn variant="primary" size="sm" onClick={() => setShowForm(false)}>Asignar beca</Btn>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Alumno</TH><TH>Grado</TH><TH>Descuento</TH><TH>Mensualidad</TH><TH>Total a pagar</TH><TH>Desde</TH><TH>Motivo</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {BECAS_DATA.map(b => (
                <tr key={b.id} className="hover:bg-stone-50 transition-colors">
                  <TD><p className="font-medium text-stone-900 text-sm">{b.alumno}</p></TD>
                  <TD><span className="text-stone-600">{b.grado}</span></TD>
                  <TD><Badge variant="success">{b.porcentaje}%</Badge></TD>
                  <TD><span className="font-mono-data">Q{b.mensualidad.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                  <TD><span className="font-mono-data font-semibold text-primary-700">Q{b.total.toLocaleString("es-GT", { minimumFractionDigits: 2 })}</span></TD>
                  <TD><span className="text-stone-500 text-xs">{b.desde}</span></TD>
                  <TD><span className="text-stone-500 text-xs">{b.motivo}</span></TD>
                  <TD className="text-right">
                    <button className="p-1.5 text-stone-400 hover:text-primary-700 rounded transition-colors"><Edit className="w-3.5 h-3.5" /></button>
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

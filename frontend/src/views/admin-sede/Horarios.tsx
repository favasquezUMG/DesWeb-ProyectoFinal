import { useState } from "react";
import { Plus, AlertTriangle } from "lucide-react";
import { HORARIO_3A, DIAS, BLOQUES } from "../../data";
import { Card, SectionHeader, Btn, AlertBanner } from "../../components/Ui";

// ─── Horarios ─────────────────────────────────────────────────────────────────

export default function HorariosView() {
  const [conflicto, setConflicto] = useState(false);
  const [showConflicto, setShowConflicto] = useState(false);

  function handleAsignar() {
    setConflicto(true);
    setShowConflicto(true);
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Horarios" subtitle="Asignación de bloques por sección — Tercero Básico A"
        action={
          <div className="flex gap-2">
            <select className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
              <option>Tercero Básico A</option><option>Tercero Básico B</option><option>Segundo Básico A</option>
            </select>
            <Btn variant="primary" size="sm" onClick={handleAsignar} disabled={conflicto}>Guardar horario</Btn>
          </div>
        }
      />

      {showConflicto && (
        <AlertBanner
          type="error"
          title="Conflicto de horario detectado"
          message="Prof. Carlos Gómez ya tiene asignada la clase de Matemática — 2do Básico A en el bloque Jueves 07:45–08:30. El horario no puede guardarse hasta resolver el conflicto."
          onClose={() => setShowConflicto(false)}
        />
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left font-medium w-28">Hora</th>
                {DIAS.map(d => <th key={d} className="px-4 py-3 text-left font-medium">{d}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {BLOQUES.map((bloque, i) => {
                const isReceso = bloque === "09:45–10:15";
                if (isReceso) {
                  return (
                    <tr key={bloque} className="bg-stone-50">
                      <td className="px-4 py-2 font-mono-data text-stone-400">{bloque}</td>
                      {DIAS.map(d => <td key={d} className="px-4 py-2 text-stone-300 italic text-center">Receso</td>)}
                    </tr>
                  );
                }
                return (
                  <tr key={bloque} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                    <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{bloque}</td>
                    {DIAS.map(d => {
                      const celda = HORARIO_3A[d]?.[bloque];
                      const esConflicto = conflicto && d === "Jueves" && bloque === "07:30–08:15";
                      return (
                        <td key={d} className="px-2 py-2">
                          {celda ? (
                            <div className={`p-2 rounded-lg border ${esConflicto ? "bg-danger-50 border-danger-300 ring-2 ring-danger-400" : celda.color}`}>
                              <p className="font-semibold leading-tight">{celda.curso}</p>
                              <p className="text-[10px] opacity-70 mt-0.5">{celda.catedratico}</p>
                              <p className="text-[10px] opacity-60">{celda.salon}</p>
                              {esConflicto && <p className="text-danger-700 text-[10px] font-bold mt-0.5 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />Conflicto</p>}
                            </div>
                          ) : (
                            <div className="h-14 border border-dashed border-stone-200 rounded-lg flex items-center justify-center text-stone-300 hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer group">
                              <Plus className="w-4 h-4 group-hover:text-primary-500" />
                            </div>
                          )}
                        </td>
                      );
                    })}
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

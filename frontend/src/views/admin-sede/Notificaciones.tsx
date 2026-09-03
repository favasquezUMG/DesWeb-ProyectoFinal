import { useState } from "react";
import { Plus, Bell } from "lucide-react";
import { NOTIFICACIONES_LISTA } from "../../data";
import { Card, SectionHeader, Btn, Badge } from "../../components/Ui";

// ─── Notificaciones ───────────────────────────────────────────────────────────

export default function NotificacionesView() {
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      <SectionHeader title="Notificaciones" subtitle="Envío de avisos, sanciones y comunicados a la comunidad"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowForm(true)}>Redactar notificación</Btn>}
      />

      {showForm && (
        <Card className="p-5 border-2 border-primary-200">
          <h3 className="font-semibold text-stone-800 mb-4">Nueva notificación</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Tipo</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>Aviso general</option><option>Sanción</option><option>Actividad</option><option>Asueto</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Asunto</label>
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" placeholder="Asunto del aviso" />
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Destinatarios</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>Toda la sede</option>
                <option>Catedráticos</option>
                <option>Alumnos — 3ro Básico A</option>
                <option>Padres — 3ro Básico</option>
                <option>Padres — 2do Básico</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Mensaje</label>
              <textarea rows={4} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 resize-none" placeholder="Redacte el mensaje…" />
            </div>
            <div className="flex gap-2 justify-end">
              <Btn variant="outline" size="sm" onClick={() => setShowForm(false)}>Cancelar</Btn>
              <Btn variant="secondary" size="sm" onClick={() => setShowForm(false)}>Enviar notificación</Btn>
            </div>
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {NOTIFICACIONES_LISTA.map(n => {
          const tipoColor: Record<string, string> = {
            asueto: "warning", actividad: "info", sancion: "danger", aviso: "neutral"
          };
          return (
            <Card key={n.id} className="p-4 flex items-start gap-4">
              <div className={`p-2 rounded-lg shrink-0 ${n.tipo === "sancion" ? "bg-danger-50 text-danger-700" : n.tipo === "asueto" ? "bg-warning-50 text-warning-700" : "bg-info-50 text-info-700"}`}>
                <Bell className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-semibold text-stone-900 text-sm">{n.titulo}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={tipoColor[n.tipo] as "warning"}>{n.tipo}</Badge>
                    <span className="text-xs text-stone-400">{n.fecha}</span>
                  </div>
                </div>
                <p className="text-sm text-stone-600 leading-relaxed">{n.cuerpo}</p>
                <p className="text-xs text-stone-400 mt-1.5">Destinatarios: {n.destinatarios}</p>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

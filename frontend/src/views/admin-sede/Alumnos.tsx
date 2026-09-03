import { useState } from "react";
import { Plus, Search, Edit, Trash2, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { ALUMNOS } from "../../data";
import {
  Card, SectionHeader, Btn, Badge, PagoBadge, EstadoBadge,
  Drawer, Modal, AlertBanner, EmptyState, TH, TD, Tabs
} from "../../components/Ui";

// ─── Alumnos ──────────────────────────────────────────────────────────────────

export default function AlumnosView() {
  const [search, setSearch] = useState("");
  const [gradoFilter, setGradoFilter] = useState("todos");
  const [seccionFilter, setSeccionFilter] = useState("todos");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selected, setSelected] = useState<typeof ALUMNOS[0] | null>(null);
  const [deleteModal, setDeleteModal] = useState<string | null>(null);

  const filtered = ALUMNOS.filter(a => {
    const matchSearch = a.nombre.toLowerCase().includes(search.toLowerCase()) || a.carnet.includes(search);
    const matchGrado = gradoFilter === "todos" || a.grado === gradoFilter;
    const matchSeccion = seccionFilter === "todos" || a.seccion === seccionFilter;
    return matchSearch && matchGrado && matchSeccion;
  });

  return (
    <div className="space-y-5">
      <SectionHeader title="Alumnos" subtitle="Gestión del padrón estudiantil — Sede Central"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => { setSelected(null); setDrawerOpen(true); }}>Registrar alumno</Btn>}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-stone-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nombre o carnet…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white" />
          </div>
          <select value={gradoFilter} onChange={e => setGradoFilter(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
            <option value="todos">Todos los grados</option>
            <option value="Primero Básico">Primero Básico</option>
            <option value="Segundo Básico">Segundo Básico</option>
            <option value="Tercero Básico">Tercero Básico</option>
          </select>
          <select value={seccionFilter} onChange={e => setSeccionFilter(e.target.value)} className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
            <option value="todos">Todas las secciones</option>
            <option value="A">Sección A</option>
            <option value="B">Sección B</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Alumno / Carnet</TH><TH>Grado · Sección</TH><TH>Promedio</TH><TH>Estado académico</TH><TH>Pago</TH><TH>Beca</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {filtered.map(a => (
                <tr key={a.id} className="hover:bg-stone-50 transition-colors">
                  <TD>
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xs font-bold shrink-0">
                        {a.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="font-medium text-stone-900 text-sm">{a.nombre}</p>
                        <p className="text-xs text-stone-400 font-mono-data">{a.carnet}</p>
                      </div>
                    </div>
                  </TD>
                  <TD><span className="text-stone-700">{a.grado}</span> <span className="text-stone-400">·</span> <span className="text-stone-500">Sec. {a.seccion}</span></TD>
                  <TD><span className={`font-mono-data font-semibold text-base ${a.promedio >= 61 ? "text-success-700" : "text-danger-700"}`}>{a.promedio}</span></TD>
                  <TD><EstadoBadge aprobado={a.promedio >= 61} /></TD>
                  <TD><PagoBadge estado={a.pagado ? "pagado" : "vencido"} /></TD>
                  <TD>{a.beca > 0 ? <Badge variant="success">{a.beca}%</Badge> : <span className="text-stone-400 text-xs">—</span>}</TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => { setSelected(a); setDrawerOpen(true); }} className="p-1.5 text-stone-400 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors" aria-label="Editar"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => setDeleteModal(a.id)} className="p-1.5 text-stone-400 hover:text-danger-700 hover:bg-danger-50 rounded transition-colors" aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8"><EmptyState icon={<Users className="w-8 h-8" />} title="No hay alumnos que coincidan" description="Ajuste los filtros para encontrar el alumno que busca." /></div>
          )}
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 text-xs text-stone-500">
          <span>{filtered.length} de {ALUMNOS.length} alumnos</span>
          <div className="flex gap-1">
            <button className="p-1.5 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-40" disabled><ChevronLeft className="w-3.5 h-3.5" /></button>
            <span className="px-3 py-1.5 bg-primary-700 text-white rounded text-xs font-medium">1</span>
            <button className="p-1.5 rounded border border-stone-200 hover:bg-stone-100 disabled:opacity-40" disabled><ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      </Card>

      {/* Drawer: Ficha del alumno */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={selected ? "Ficha del alumno" : "Registrar alumno"}
        footer={<><Btn variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Btn><Btn variant="primary">{selected ? "Guardar cambios" : "Registrar alumno"}</Btn></>}
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-center gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100">
              <div className="w-12 h-12 rounded-full bg-primary-700 text-white flex items-center justify-center font-bold">
                {selected.nombre.split(" ").map(n => n[0]).slice(0, 2).join("")}
              </div>
              <div>
                <p className="font-display font-semibold text-primary-900">{selected.nombre}</p>
                <p className="text-xs text-primary-600 font-mono-data">{selected.carnet} · {selected.grado} {selected.seccion}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Fecha de nacimiento", selected.nacimiento],
                ["Grado", `${selected.grado} — Sec. ${selected.seccion}`],
                ["Encargado", selected.encargado],
                ["Correo del encargado", selected.encargadoEmail],
                ["Beca", selected.beca > 0 ? `${selected.beca}%` : "Sin beca"],
                ["Estado de cuenta", selected.pagado ? "Al día" : "Con mora"],
              ].map(([k, v]) => (
                <div key={k} className="col-span-1">
                  <p className="text-stone-400 text-xs">{k}</p>
                  <p className="text-stone-800 font-medium mt-0.5">{v}</p>
                </div>
              ))}
            </div>
            <Tabs tabs={["Cursos", "Notas", "Estado de pagos"]} active="Cursos" onChange={() => {}} />
            <div className="space-y-2">
              {["Matemática", "Comunicación y Lenguaje", "Ciencias Naturales", "Estudios Sociales", "TAL", "Inglés"].map(c => (
                <div key={c} className="flex justify-between items-center px-3 py-2 bg-stone-50 rounded-lg text-sm">
                  <span className="text-stone-700">{c}</span>
                  <EstadoBadge aprobado={selected.promedio >= 61} label={selected.promedio >= 61 ? "Aprobado" : "Reprobado"} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {[["Primer nombre", ""], ["Segundo nombre", ""], ["Primer apellido", ""], ["Segundo apellido", ""],
              ["Fecha de nacimiento", "dd/mm/aaaa"], ["CUI/DPI", ""]].map(([label, ph]) => (
              <div key={label}>
                <label className="text-sm font-medium text-stone-700 block mb-1">{label}</label>
                <input placeholder={ph} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Grado</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>Primero Básico</option><option>Segundo Básico</option><option>Tercero Básico</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-stone-700 block mb-1">Sección</label>
              <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
                <option>A</option><option>B</option>
              </select>
            </div>
          </div>
        )}
      </Drawer>

      {/* Delete confirmation modal */}
      <Modal open={!!deleteModal} onClose={() => setDeleteModal(null)} title="Eliminar alumno"
        footer={<><Btn variant="outline" onClick={() => setDeleteModal(null)}>Cancelar</Btn><Btn variant="destructive" onClick={() => setDeleteModal(null)}>Eliminar alumno</Btn></>}
      >
        <div className="space-y-4">
          <AlertBanner type="error" title="Esta acción no se puede deshacer" message="Se eliminará permanentemente el expediente del alumno, incluyendo notas, asistencia y estado de pagos." />
          <p className="text-sm text-stone-600">Para confirmar, escriba <strong>ELIMINAR</strong> en el campo de abajo:</p>
          <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-danger-700" placeholder="ELIMINAR" />
        </div>
      </Modal>
    </div>
  );
}

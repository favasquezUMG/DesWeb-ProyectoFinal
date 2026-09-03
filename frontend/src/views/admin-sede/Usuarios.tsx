import { useState } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, Drawer, TH, TD } from "../../components/Ui";

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export default function UsuariosView() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const usuarios = [
    { id: 1, nombre: "Prof. Carlos Humberto Gómez", email: "cgomez@colegio.edu.gt", rol: "Catedrático", estado: "activo", sede: "Sede Central" },
    { id: 2, nombre: "Prof.ª Silvia Ramírez Chaj", email: "sramirez@colegio.edu.gt", rol: "Catedrático", estado: "activo", sede: "Sede Central" },
    { id: 3, nombre: "Rosa Elena Pac Cuc", email: "rpac@gmail.com", rol: "Padre/Encargado", estado: "activo", sede: "—" },
    { id: 4, nombre: "María José Ajú Pac", email: "maju@colegio.edu.gt", rol: "Alumno", estado: "activo", sede: "Sede Central" },
    { id: 5, nombre: "Pedro Antonio Cuc Morales", email: "pcuc@gmail.com", rol: "Padre/Encargado", estado: "inactivo", sede: "—" },
  ];
  return (
    <div className="space-y-5">
      <SectionHeader title="Usuarios" subtitle="Gestión de cuentas de acceso al sistema"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setDrawerOpen(true)}>Crear usuario</Btn>}
      />
      <Card className="overflow-hidden">
        <div className="flex gap-3 p-4 border-b border-stone-100">
          <div className="relative flex-1 max-w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input placeholder="Buscar usuario…" className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white" />
          </div>
          <select className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
            <option>Todos los roles</option><option>Catedrático</option><option>Alumno</option><option>Padre/Encargado</option>
          </select>
          <select className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
            <option>Activos e inactivos</option><option>Activos</option><option>Inactivos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Usuario</TH><TH>Rol</TH><TH>Sede</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {usuarios.map(u => (
                <tr key={u.id} className="hover:bg-stone-50">
                  <TD><div>
                    <p className="font-medium text-stone-900 text-sm">{u.nombre}</p>
                    <p className="text-xs text-stone-400">{u.email}</p>
                  </div></TD>
                  <TD><Badge variant="neutral">{u.rol}</Badge></TD>
                  <TD><span className="text-stone-600 text-sm">{u.sede}</span></TD>
                  <TD><Badge variant={u.estado === "activo" ? "success" : "neutral"}>{u.estado === "activo" ? "Activo" : "Inactivo"}</Badge></TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setDrawerOpen(true)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded"><Edit className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 text-stone-400 hover:text-danger-700 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Nuevo usuario"
        footer={<><Btn variant="outline" onClick={() => setDrawerOpen(false)}>Cancelar</Btn><Btn variant="primary">Crear usuario</Btn></>}
      >
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-stone-700 block mb-1">Nombre completo</label>
            <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" /></div>
          <div><label className="text-sm font-medium text-stone-700 block mb-1">Correo electrónico</label>
            <input type="email" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" /></div>
          <div><label className="text-sm font-medium text-stone-700 block mb-1">Rol</label>
            <select className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
              <option>Director</option><option>Catedrático</option><option>Alumno</option><option>Padre/Encargado</option>
            </select></div>
          <div><label className="text-sm font-medium text-stone-700 block mb-1">Contraseña temporal</label>
            <input type="password" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" /></div>
        </div>
      </Drawer>
    </div>
  );
}

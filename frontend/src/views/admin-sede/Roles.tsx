import { Card, SectionHeader, Btn } from "../../components/Ui";

// ─── Roles y Permisos ─────────────────────────────────────────────────────────

export default function RolesView() {
  const modulos = ["Alumnos", "Catedráticos", "Horarios", "Notas", "Asistencia", "Becas", "Pagos", "Notificaciones", "Calendario", "Reportería"];
  const roles = ["Director", "Catedrático", "Alumno", "Padre/Encargado"];
  const permisos: Record<string, Record<string, boolean>> = {
    "Director": { Alumnos: true, Catedráticos: true, Horarios: true, Notas: true, Asistencia: true, Becas: true, Pagos: true, Notificaciones: true, Calendario: true, Reportería: true },
    "Catedrático": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: true, Becas: false, Pagos: false, Notificaciones: false, Calendario: true, Reportería: false },
    "Alumno": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: false, Becas: false, Pagos: false, Notificaciones: true, Calendario: true, Reportería: false },
    "Padre/Encargado": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: false, Becas: false, Pagos: true, Notificaciones: true, Calendario: true, Reportería: true },
  };

  return (
    <div className="space-y-5">
      <SectionHeader title="Roles y Permisos" subtitle="Matriz de acceso por módulo" />
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Módulo</th>
                {roles.map(r => <th key={r} className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">{r}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {modulos.map(mod => (
                <tr key={mod} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{mod}</td>
                  {roles.map(rol => (
                    <td key={rol} className="px-4 py-3 text-center">
                      <input type="checkbox" defaultChecked={permisos[rol]?.[mod]} className="w-4 h-4 accent-primary-700 cursor-pointer" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-stone-100 flex justify-end">
          <Btn variant="primary" size="sm">Guardar permisos</Btn>
        </div>
      </Card>
    </div>
  );
}

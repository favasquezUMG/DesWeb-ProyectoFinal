import { useEffect, useState } from "react";
import { Card, SectionHeader, Btn, AlertBanner } from "../../components/Ui";
import { getRoles, type RolDto } from "../../lib/api";

// ─── Roles y Permisos ─────────────────────────────────────────────────────────

// La matriz de permisos aún no tiene endpoint propio en el backend, así que
// se mantiene local; solo la lista de roles (columnas) viene de /api/roles.
const MODULOS = ["Alumnos", "Catedráticos", "Horarios", "Notas", "Asistencia", "Becas", "Pagos", "Notificaciones", "Calendario", "Reportería"];
const PERMISOS: Record<string, Record<string, boolean>> = {
  "Administrador General": { Alumnos: true, Catedráticos: true, Horarios: true, Notas: true, Asistencia: true, Becas: true, Pagos: true, Notificaciones: true, Calendario: true, Reportería: true },
  "Administrador de Sede": { Alumnos: true, Catedráticos: true, Horarios: true, Notas: true, Asistencia: true, Becas: true, Pagos: true, Notificaciones: true, Calendario: true, Reportería: true },
  "Catedratico": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: true, Becas: false, Pagos: false, Notificaciones: false, Calendario: true, Reportería: false },
  "Alumno": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: false, Becas: false, Pagos: false, Notificaciones: true, Calendario: true, Reportería: false },
  "Encargado": { Alumnos: false, Catedráticos: false, Horarios: false, Notas: true, Asistencia: false, Becas: false, Pagos: true, Notificaciones: true, Calendario: true, Reportería: true },
};

export default function RolesView() {
  const [roles, setRoles] = useState<RolDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError("");
    getRoles()
      .then((data) => { if (!cancelled) setRoles(data); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "No se pudieron cargar los roles."); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="space-y-5">
      <SectionHeader title="Roles y Permisos" subtitle="Matriz de acceso por módulo" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
            <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
            Cargando roles…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Módulo</th>
                  {roles.map(r => <th key={r.rolId} className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider">{r.nombre}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {MODULOS.map(mod => (
                  <tr key={mod} className="hover:bg-stone-50">
                    <td className="px-4 py-3 font-medium text-stone-800">{mod}</td>
                    {roles.map(r => (
                      <td key={r.rolId} className="px-4 py-3 text-center">
                        <input type="checkbox" defaultChecked={PERMISOS[r.nombre]?.[mod]} className="w-4 h-4 accent-primary-700 cursor-pointer" />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 border-t border-stone-100 flex justify-end">
          <Btn variant="primary" size="sm" disabled={loading || !!error}>Guardar permisos</Btn>
        </div>
      </Card>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Plus, Lock, Trash2, Edit, ShieldCheck, Users, GraduationCap, UserRound, Info } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Modal, Input, Textarea } from "../../components/Ui";
import {
  getRoles,
  getModulos,
  createRol,
  updateRol,
  guardarPermisosRol,
  deleteRol,
  type ModuloDto,
  type RolDto,
} from "../../lib/api";
import { getSession } from "../../lib/auth";
import { etiquetaRol } from "../../components/Layout";

// Cómo obtiene acceso cada rol de comunidad (no usan la matriz)
const ACCESO_COMUNIDAD: Record<string, { Icon: typeof Users; texto: string }> = {
  Catedratico: { Icon: GraduationCap, texto: "Ve y califica solo los cursos y secciones que tiene asignados." },
  Alumno: { Icon: UserRound, texto: "Ve únicamente su propia información: notas, horario y avisos." },
  Encargado: { Icon: Users, texto: "Ve a los alumnos que tiene a cargo, según los permisos de cada vínculo (notas, pagos, avisos)." },
};

export default function RolesView() {
  const esGeneral = getSession()?.user.role === "admin-general";

  const [roles, setRoles] = useState<RolDto[]>([]);
  const [modulos, setModulos] = useState<ModuloDto[]>([]);
  const [cambios, setCambios] = useState<Record<number, Set<string>>>({});
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [editando, setEditando] = useState<RolDto | "nuevo" | null>(null);
  const [form, setForm] = useState({ nombre: "", descripcion: "" });
  const [permisosNuevo, setPermisosNuevo] = useState<Set<string>>(new Set());
  const [formError, setFormError] = useState("");
  const [eliminar, setEliminar] = useState<RolDto | null>(null);

  async function cargar() {
    const [r, m] = await Promise.all([getRoles(), getModulos()]);
    setRoles(r);
    setModulos(m);
    setCambios({});
  }

  useEffect(() => {
    cargar()
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los roles."))
      .finally(() => setLoading(false));
  }, []);

  const columnas = useMemo(() => roles.filter((r) => r.tipo !== "comunidad"), [roles]);
  const comunidad = roles.filter((r) => r.tipo === "comunidad");
  const hayCambios = Object.keys(cambios).length > 0;

  function permisosDe(r: RolDto): Set<string> {
    return cambios[r.rolId] ?? new Set(r.permisos);
  }

  function alternar(r: RolDto, modulo: string) {
    if (!esGeneral || !r.permisosEditables) return;
    const actual = new Set(permisosDe(r));
    if (actual.has(modulo)) actual.delete(modulo);
    else actual.add(modulo);
    const original = new Set(r.permisos);
    const igual = actual.size === original.size && [...actual].every((m) => original.has(m));
    setCambios((c) => {
      const copia = { ...c };
      if (igual) delete copia[r.rolId];
      else copia[r.rolId] = actual;
      return copia;
    });
  }

  async function guardarMatriz() {
    setGuardando(true);
    setError("");
    try {
      for (const [rolId, permisos] of Object.entries(cambios)) {
        await guardarPermisosRol(Number(rolId), [...permisos]);
      }
      await cargar();
      setExito("Permisos guardados. Se aplican de inmediato a los usuarios con esos roles.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los permisos.");
    } finally {
      setGuardando(false);
    }
  }

  function abrir(r: RolDto | "nuevo") {
    setEditando(r);
    setForm(r === "nuevo" ? { nombre: "", descripcion: "" } : { nombre: r.nombre, descripcion: r.descripcion ?? "" });
    setPermisosNuevo(new Set());
    setFormError("");
  }

  async function guardarRol() {
    setGuardando(true);
    setFormError("");
    try {
      if (editando === "nuevo") {
        await createRol({ nombre: form.nombre, descripcion: form.descripcion || undefined, permisos: [...permisosNuevo] });
        setExito(`Rol "${form.nombre}" creado.`);
      } else if (editando) {
        await updateRol(editando.rolId, {
          ...(editando.esSistema ? {} : { nombre: form.nombre }),
          descripcion: form.descripcion,
        });
        setExito("Rol actualizado.");
      }
      setEditando(null);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el rol.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEliminar() {
    if (!eliminar) return;
    setGuardando(true);
    try {
      const res = await deleteRol(eliminar.rolId);
      setExito(res.message);
      setEliminar(null);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el rol.");
      setEliminar(null);
    } finally {
      setGuardando(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-stone-500">
        <span className="w-4 h-4 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
        Cargando roles…
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeader
        title="Roles y Permisos"
        subtitle="Qué módulos administrativos puede usar cada rol del personal"
        action={esGeneral && <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => abrir("nuevo")}>Nuevo rol</Btn>}
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}
      {!esGeneral && (
        <AlertBanner type="info" message="Solo el Administrador General puede crear roles y cambiar permisos. Aquí puede consultar qué puede hacer cada rol." />
      )}

      {/* Matriz de permisos del personal */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider">Módulo</th>
                {columnas.map((r) => (
                  <th key={r.rolId} className="px-4 py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider min-w-28">
                    <span className="inline-flex items-center gap-1">
                      {r.tipo === "global" && <Lock className="w-3 h-3" />}
                      {etiquetaRol(r.nombre)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {modulos.map((m) => (
                <tr key={m.modulo} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-800">{m.nombre}</td>
                  {columnas.map((r) => {
                    const editable = esGeneral && r.permisosEditables;
                    const marcado = permisosDe(r).has(m.modulo);
                    const cambiado = cambios[r.rolId] && cambios[r.rolId].has(m.modulo) !== r.permisos.includes(m.modulo);
                    return (
                      <td key={r.rolId} className={`px-4 py-3 text-center ${cambiado ? "bg-action-50" : ""}`}>
                        <input
                          type="checkbox"
                          checked={marcado}
                          disabled={!editable}
                          onChange={() => alternar(r, m.modulo)}
                          aria-label={`${m.nombre} — ${r.nombre}`}
                          className="w-4 h-4 accent-primary-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {esGeneral && (
          <div className="px-4 py-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> El Administrador General siempre tiene acceso completo. La gestión de roles y la malla curricular son exclusivas de él.
            </p>
            <div className="flex gap-2">
              {hayCambios && <Btn variant="outline" size="sm" onClick={() => setCambios({})} disabled={guardando}>Descartar</Btn>}
              <Btn variant="primary" size="sm" loading={guardando} disabled={!hayCambios} onClick={guardarMatriz}>Guardar permisos</Btn>
            </div>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Roles del sistema y del colegio */}
        <Card className="p-5">
          <h3 className="font-semibold text-stone-800 mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-primary-700" />Roles del personal</h3>
          <ul className="divide-y divide-stone-100">
            {columnas.map((r) => (
              <li key={r.rolId} className="py-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <p className="font-medium text-stone-900 text-sm">{etiquetaRol(r.nombre)}</p>
                    {r.esSistema ? <Badge variant="neutral">Sistema</Badge> : <Badge variant="primary">Del colegio</Badge>}
                    <span className="text-xs text-stone-400">{r.usuarios} usuario(s)</span>
                  </div>
                  {r.descripcion && <p className="text-xs text-stone-500 mt-0.5">{r.descripcion}</p>}
                </div>
                {esGeneral && (
                  <div className="flex shrink-0">
                    <button onClick={() => abrir(r)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded cursor-pointer" aria-label="Editar rol" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                    {!r.esSistema && (
                      <button onClick={() => setEliminar(r)} className="p-1.5 text-stone-400 hover:text-danger-700 rounded cursor-pointer" aria-label="Eliminar rol" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* Roles de comunidad */}
        <Card className="p-5">
          <h3 className="font-semibold text-stone-800 mb-1 flex items-center gap-2"><Info className="w-4 h-4 text-primary-700" />Roles de la comunidad</h3>
          <p className="text-xs text-stone-500 mb-3">No usan la matriz: su acceso depende de su relación con los datos.</p>
          <ul className="space-y-3">
            {comunidad.map((r) => {
              const info = ACCESO_COMUNIDAD[r.nombre];
              const Icon = info?.Icon ?? Users;
              return (
                <li key={r.rolId} className="flex gap-3">
                  <span className="p-2 h-fit rounded-lg bg-primary-50 text-primary-700"><Icon className="w-4 h-4" /></span>
                  <div>
                    <p className="text-sm font-medium text-stone-900">{etiquetaRol(r.nombre)} <span className="text-xs text-stone-400 font-normal">· {r.usuarios} usuario(s)</span></p>
                    <p className="text-xs text-stone-500">{info?.texto ?? r.descripcion}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-stone-500 mt-4 pt-3 border-t border-stone-100">
            Una misma persona puede tener varios roles (por ejemplo, un catedrático que también es padre de familia) y elegir con cuál entrar.
          </p>
        </Card>
      </div>

      <Modal
        open={!!editando}
        onClose={() => { if (!guardando) setEditando(null); }}
        title={editando === "nuevo" ? "Nuevo rol del personal" : "Editar rol"}
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={guardando} onClick={guardarRol}>Guardar</Btn>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <AlertBanner type="error" message={formError} />}
          <Input label="Nombre" value={form.nombre} disabled={editando !== "nuevo" && editando?.esSistema}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} placeholder="Ej. Secretaría, Contabilidad, Orientación" />
          {editando !== "nuevo" && editando?.esSistema && (
            <p className="text-xs text-stone-500 -mt-2">Es un rol de sistema: no se puede renombrar.</p>
          )}
          <Textarea label="Descripción" rows={2} value={form.descripcion} onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))} />
          {editando === "nuevo" && (
            <div>
              <p className="text-sm font-medium text-stone-700 mb-2">Módulos a los que tendrá acceso</p>
              <div className="grid grid-cols-2 gap-2">
                {modulos.map((m) => (
                  <label key={m.modulo} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={permisosNuevo.has(m.modulo)}
                      onChange={() => setPermisosNuevo((p) => { const n = new Set(p); if (n.has(m.modulo)) n.delete(m.modulo); else n.add(m.modulo); return n; })} />
                    {m.nombre}
                  </label>
                ))}
              </div>
              <p className="text-xs text-stone-500 mt-2">Los usuarios con este rol entran por el portal del personal y solo ven su sede.</p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={!!eliminar}
        onClose={() => { if (!guardando) setEliminar(null); }}
        title="Eliminar rol"
        footer={
          <>
            <Btn variant="outline" size="sm" onClick={() => setEliminar(null)} disabled={guardando}>Cancelar</Btn>
            <Btn variant="destructive" size="sm" loading={guardando} onClick={confirmarEliminar}>Eliminar</Btn>
          </>
        }
      >
        <p className="text-sm text-stone-600">
          ¿Eliminar el rol <strong>{eliminar?.nombre}</strong>? Solo se puede si ningún usuario lo tiene asignado.
        </p>
      </Modal>
    </div>
  );
}

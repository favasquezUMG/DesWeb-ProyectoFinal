import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Edit, UserX, UserCheck, KeyRound, BookOpen, Users } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, Drawer, Modal, AlertBanner, Input, Select, Textarea, TH, TD } from "../../components/Ui";
import {
  getUsuarios,
  getUsuario,
  getRoles,
  getSedes,
  createUsuario,
  updateUsuario,
  setRolesAdicionales,
  cambiarEstadoUsuario,
  type RolDto,
  type SedeDto,
  type UsuarioDetalleDto,
  type UsuarioDto,
} from "../../lib/api";
import { getSession } from "../../lib/auth";
import { etiquetaRol } from "../../components/Layout";
import { formatFechaHora, nombreDe } from "../../lib/becas";

type Estado = "activos" | "inactivos" | "todos";

interface FormUsuario {
  nombres: string;
  apellidos: string;
  email: string;
  rolId: string;
  adicionales: Set<number>;
  sedeId: string;
  especialidad: string;
  password: string;
}

const formVacio = (): FormUsuario => ({
  nombres: "", apellidos: "", email: "", rolId: "", adicionales: new Set(), sedeId: "", especialidad: "", password: "",
});

const ROLES_SOLO_GENERAL = ["Admin", "Administrador General", "Administrador de Sede"];

export default function UsuariosView() {
  const sesion = getSession()?.user;
  const esGeneral = sesion?.role === "admin-general";
  const miId = Number(sesion?.id);

  const [usuarios, setUsuarios] = useState<UsuarioDto[]>([]);
  const [roles, setRoles] = useState<RolDto[]>([]);
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [q, setQ] = useState("");
  const [rolFiltro, setRolFiltro] = useState("");
  const [estado, setEstado] = useState<Estado>("activos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");

  const [drawer, setDrawer] = useState<"nuevo" | UsuarioDetalleDto | null>(null);
  const [form, setForm] = useState<FormUsuario>(formVacio());
  const [formError, setFormError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [passwordTemporal, setPasswordTemporal] = useState<{ email: string; clave: string } | null>(null);

  const [estadoDe, setEstadoDe] = useState<UsuarioDto | null>(null);
  const [motivo, setMotivo] = useState("");
  const [estadoError, setEstadoError] = useState("");

  async function cargar() {
    setUsuarios(await getUsuarios({ q: q.trim() || undefined, rolId: rolFiltro ? Number(rolFiltro) : undefined, estado }));
  }

  useEffect(() => {
    Promise.all([getRoles(), esGeneral ? getSedes() : Promise.resolve([])])
      .then(([r, s]) => { setRoles(r); setSedes(s); })
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los roles."));
  }, [esGeneral]);

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true);
      cargar()
        .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios."))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, rolFiltro, estado]);

  // Roles que el usuario actual puede asignar. Los alumnos se registran desde inscripciones.
  const rolesAsignables = useMemo(
    () => roles.filter((r) => r.nombre !== "Alumno" && (esGeneral || !ROLES_SOLO_GENERAL.includes(r.nombre))),
    [roles, esGeneral]
  );
  const rolPrincipal = roles.find((r) => String(r.rolId) === form.rolId);
  const nombresElegidos = [rolPrincipal?.nombre, ...roles.filter((r) => form.adicionales.has(r.rolId)).map((r) => r.nombre)];
  const incluyeCatedratico = nombresElegidos.includes("Catedratico");
  const necesitaSede = esGeneral && nombresElegidos.some((n) => n && n !== "Encargado" && n !== "Administrador General");

  function abrirNuevo() {
    setForm(formVacio());
    setFormError("");
    setDrawer("nuevo");
  }

  async function abrirEditar(u: UsuarioDto) {
    setFormError("");
    try {
      const detalle = await getUsuario(u.usuarioId);
      setForm({
        nombres: detalle.nombres,
        apellidos: detalle.apellidos,
        email: detalle.email,
        rolId: String(detalle.rolId),
        adicionales: new Set(detalle.rolesAdicionales.map((r) => r.rolId)),
        sedeId: detalle.sedeId ? String(detalle.sedeId) : "",
        especialidad: detalle.catedratico?.especialidad ?? "",
        password: "",
      });
      setDrawer(detalle);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo abrir el usuario.");
    }
  }

  async function guardar() {
    if (!form.nombres.trim() || !form.apellidos.trim() || !form.email.trim() || !form.rolId) {
      setFormError("Complete nombres, apellidos, correo y rol.");
      return;
    }
    setGuardando(true);
    setFormError("");
    try {
      const adicionales = [...form.adicionales].filter((id) => String(id) !== form.rolId);
      if (drawer === "nuevo") {
        const creado = await createUsuario({
          nombres: form.nombres,
          apellidos: form.apellidos,
          email: form.email,
          rolId: Number(form.rolId),
          rolesAdicionales: adicionales,
          sedeId: form.sedeId ? Number(form.sedeId) : undefined,
          especialidad: incluyeCatedratico ? form.especialidad || undefined : undefined,
          password: form.password || undefined,
        });
        if (creado.passwordTemporal) setPasswordTemporal({ email: creado.email, clave: creado.passwordTemporal });
        setExito(`Usuario ${creado.nombres} ${creado.apellidos} creado.`);
      } else if (drawer) {
        await updateUsuario(drawer.usuarioId, {
          nombres: form.nombres,
          apellidos: form.apellidos,
          email: form.email,
          rolId: Number(form.rolId),
          ...(esGeneral ? { sedeId: form.sedeId ? Number(form.sedeId) : null } : {}),
          ...(incluyeCatedratico ? { especialidad: form.especialidad } : {}),
          ...(form.password ? { password: form.password } : {}),
        });
        const antes = new Set(drawer.rolesAdicionales.map((r) => r.rolId));
        const cambiaron = antes.size !== adicionales.length || adicionales.some((id) => !antes.has(id));
        if (cambiaron) await setRolesAdicionales(drawer.usuarioId, adicionales);
        setExito("Usuario actualizado.");
      }
      setDrawer(null);
      await cargar();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el usuario.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarEstado() {
    if (!estadoDe) return;
    setGuardando(true);
    setEstadoError("");
    try {
      const res = await cambiarEstadoUsuario(estadoDe.usuarioId, estadoDe.deletedAt !== null, motivo);
      setExito(res.message);
      setEstadoDe(null);
      await cargar();
    } catch (err) {
      setEstadoError(err instanceof Error ? err.message : "No se pudo cambiar el estado.");
    } finally {
      setGuardando(false);
    }
  }

  const detalle = drawer && drawer !== "nuevo" ? drawer : null;
  const esUnoMismo = detalle?.usuarioId === miId;

  return (
    <div className="space-y-5">
      <SectionHeader title="Usuarios" subtitle="Cuentas de acceso, roles y estado"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={abrirNuevo}>Crear usuario</Btn>}
      />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-stone-100">
          <div className="relative flex-1 max-w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nombre o correo…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white" />
          </div>
          <select value={rolFiltro} onChange={(e) => setRolFiltro(e.target.value)} aria-label="Filtrar por rol"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white">
            <option value="">Todos los roles</option>
            {roles.map((r) => <option key={r.rolId} value={r.rolId}>{etiquetaRol(r.nombre)}</option>)}
          </select>
          <select value={estado} onChange={(e) => setEstado(e.target.value as Estado)} aria-label="Filtrar por estado"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white">
            <option value="activos">Activos</option>
            <option value="inactivos">Dados de baja</option>
            <option value="todos">Todos</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Usuario</TH><TH>Roles</TH><TH>Sede</TH><TH>Estado</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">Cargando usuarios…</td></tr>
              ) : usuarios.map((u) => (
                <tr key={u.usuarioId} className="hover:bg-stone-50">
                  <TD>
                    <p className="font-medium text-stone-900 text-sm">{nombreDe(u)}</p>
                    <p className="text-xs text-stone-400">{u.email}</p>
                  </TD>
                  <TD>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="primary">{etiquetaRol(u.rol.nombre)}</Badge>
                      {u.rolesAdicionales.map((r) => <Badge key={r.rolId} variant="neutral">+ {etiquetaRol(r.rol.nombre)}</Badge>)}
                    </div>
                    {u.alumno && <p className="text-xs text-stone-400 mt-0.5">{u.alumno.seccion.grado.nombre} "{u.alumno.seccion.nombre}"</p>}
                    {u.encargado && u.encargado._count.alumnosEncargado > 0 && <p className="text-xs text-stone-400 mt-0.5">{u.encargado._count.alumnosEncargado} alumno(s) a cargo</p>}
                  </TD>
                  <TD><span className="text-stone-600 text-sm">{u.sede?.nombre ?? "—"}</span></TD>
                  <TD><Badge variant={u.deletedAt ? "neutral" : "success"}>{u.deletedAt ? "Dado de baja" : "Activo"}</Badge></TD>
                  <TD className="text-right whitespace-nowrap">
                    <button onClick={() => abrirEditar(u)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded cursor-pointer" aria-label="Editar" title="Editar"><Edit className="w-3.5 h-3.5" /></button>
                    {u.usuarioId !== miId && (
                      <button onClick={() => { setEstadoDe(u); setMotivo(""); setEstadoError(""); }}
                        className={`p-1.5 text-stone-400 rounded cursor-pointer ${u.deletedAt ? "hover:text-success-700" : "hover:text-danger-700"}`}
                        aria-label={u.deletedAt ? "Reactivar" : "Dar de baja"} title={u.deletedAt ? "Reactivar" : "Dar de baja"}>
                        {u.deletedAt ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </TD>
                </tr>
              ))}
              {!loading && usuarios.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">No hay usuarios con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!drawer} onClose={() => { if (!guardando) setDrawer(null); }} title={drawer === "nuevo" ? "Nuevo usuario" : "Editar usuario"}
        footer={<><Btn variant="outline" onClick={() => setDrawer(null)} disabled={guardando}>Cancelar</Btn><Btn variant="primary" loading={guardando} onClick={guardar}>{drawer === "nuevo" ? "Crear usuario" : "Guardar cambios"}</Btn></>}
      >
        <div className="space-y-4">
          {formError && <AlertBanner type="error" message={formError} />}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nombres" value={form.nombres} onChange={(e) => setForm((f) => ({ ...f, nombres: e.target.value }))} />
            <Input label="Apellidos" value={form.apellidos} onChange={(e) => setForm((f) => ({ ...f, apellidos: e.target.value }))} />
          </div>
          <Input label="Correo electrónico" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />

          <Select label="Rol principal" value={form.rolId} disabled={esUnoMismo} onChange={(e) => setForm((f) => ({ ...f, rolId: e.target.value }))}>
            <option value="">Seleccionar…</option>
            {(detalle && !rolesAsignables.some((r) => r.rolId === detalle.rolId) ? [...rolesAsignables, roles.find((r) => r.rolId === detalle.rolId)!] : rolesAsignables)
              .map((r) => <option key={r.rolId} value={r.rolId}>{etiquetaRol(r.nombre)}</option>)}
          </Select>
          {drawer === "nuevo" && <p className="text-xs text-stone-500 -mt-2">Los alumnos se registran desde las solicitudes de inscripción.</p>}

          <div>
            <p className="text-sm font-medium text-stone-700 mb-1">Roles adicionales</p>
            <p className="text-xs text-stone-500 mb-2">Ej.: un catedrático que también es padre de un alumno recibe además el rol de Encargado.</p>
            <div className="grid grid-cols-2 gap-1.5">
              {rolesAsignables.filter((r) => String(r.rolId) !== form.rolId).map((r) => (
                <label key={r.rolId} className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary-700" disabled={esUnoMismo} checked={form.adicionales.has(r.rolId)}
                    onChange={() => setForm((f) => { const n = new Set(f.adicionales); if (n.has(r.rolId)) n.delete(r.rolId); else n.add(r.rolId); return { ...f, adicionales: n }; })} />
                  {etiquetaRol(r.nombre)}
                </label>
              ))}
            </div>
          </div>

          {necesitaSede && (
            <Select label="Sede" value={form.sedeId} disabled={esUnoMismo} onChange={(e) => setForm((f) => ({ ...f, sedeId: e.target.value }))}>
              <option value="">Seleccionar…</option>
              {sedes.map((s) => <option key={s.sedeId} value={s.sedeId}>{s.nombre}</option>)}
            </Select>
          )}
          {!esGeneral && <p className="text-xs text-stone-500">La cuenta queda en su sede.</p>}

          {incluyeCatedratico && (
            <Input label="Especialidad" value={form.especialidad} onChange={(e) => setForm((f) => ({ ...f, especialidad: e.target.value }))} placeholder="Ej. Matemática" />
          )}

          <Input label={drawer === "nuevo" ? "Contraseña (opcional)" : "Nueva contraseña (opcional)"} type="password" value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder={drawer === "nuevo" ? "Vacío = se genera una temporal" : "Dejar vacío para no cambiarla"} />

          {detalle && (
            <div className="pt-4 border-t border-stone-100 space-y-3">
              <p className="text-sm font-semibold text-stone-700">Responsabilidades actuales</p>
              <ul className="text-sm text-stone-600 space-y-1">
                <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-stone-400" />{detalle.dependencias.cursosAsignados} curso(s) asignado(s)</li>
                <li className="flex items-center gap-2"><Users className="w-4 h-4 text-stone-400" />
                  {detalle.dependencias.alumnosACargo.length === 0 ? "Sin alumnos a cargo" : `A cargo de: ${detalle.dependencias.alumnosACargo.map((a) => a.nombre).join(", ")}`}
                </li>
              </ul>
              {detalle.bitacora.length > 0 && (
                <>
                  <p className="text-sm font-semibold text-stone-700 pt-2">Historial de la cuenta</p>
                  <ul className="space-y-2">
                    {detalle.bitacora.map((b) => (
                      <li key={b.bitacoraId} className="text-xs">
                        <span className="font-medium text-stone-700">{b.accion}</span> · <span className="text-stone-400">{formatFechaHora(b.fecha)}</span>
                        <p className="text-stone-600">{b.detalle}</p>
                        <p className="text-stone-400">{b.usuario ? nombreDe(b.usuario) : "Sistema"}</p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
      </Drawer>

      <Modal open={!!estadoDe} onClose={() => { if (!guardando) setEstadoDe(null); }}
        title={estadoDe?.deletedAt ? "Reactivar cuenta" : "Dar de baja la cuenta"}
        footer={<>
          <Btn variant="outline" size="sm" onClick={() => setEstadoDe(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant={estadoDe?.deletedAt ? "primary" : "destructive"} size="sm" loading={guardando} onClick={confirmarEstado}>
            {estadoDe?.deletedAt ? "Reactivar" : "Dar de baja"}
          </Btn>
        </>}
      >
        {estadoDe && (
          <div className="space-y-4">
            <p className="text-sm text-stone-600">
              {estadoDe.deletedAt
                ? <>¿Reactivar la cuenta de <strong>{nombreDe(estadoDe)}</strong>? Podrá volver a iniciar sesión.</>
                : <>¿Dar de baja a <strong>{nombreDe(estadoDe)}</strong>? Ya no podrá iniciar sesión. Si es encargado, sus vínculos con alumnos se terminan; no se permite si es el único responsable de algún alumno o si tiene cursos asignados.</>}
            </p>
            {estadoError && <AlertBanner type="error" message={estadoError} />}
            <Textarea label="Motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Fin de contrato, se retiró del colegio…" />
          </div>
        )}
      </Modal>

      <Modal open={!!passwordTemporal} onClose={() => setPasswordTemporal(null)} title="Contraseña temporal"
        footer={<Btn variant="primary" size="sm" onClick={() => setPasswordTemporal(null)}>Entendido</Btn>}>
        {passwordTemporal && (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">Entregue estos datos al usuario. La contraseña no se volverá a mostrar.</p>
            <div className="rounded-lg bg-sand-50 border border-stone-200 p-4 space-y-1">
              <p className="text-xs text-stone-500">Correo</p>
              <p className="font-mono-data text-stone-900">{passwordTemporal.email}</p>
              <p className="text-xs text-stone-500 pt-2 flex items-center gap-1"><KeyRound className="w-3.5 h-3.5" />Contraseña temporal</p>
              <p className="font-mono-data text-lg font-semibold text-primary-700 tracking-wider">{passwordTemporal.clave}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

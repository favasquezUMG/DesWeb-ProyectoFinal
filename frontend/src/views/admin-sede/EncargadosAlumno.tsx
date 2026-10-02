import { useEffect, useState } from "react";
import {
  AlertOctagon, Star, Wallet, Home, Car, CarFront, BookOpen, CreditCard, Bell, BellOff, Edit, UserMinus, Plus, Search, Clock, KeyRound,
} from "lucide-react";
import { Btn, Badge, AlertBanner, Input, Select, Textarea, Toggle } from "../../components/Ui";
import {
  getEncargadosDeAlumno,
  buscarEncargados,
  agregarEncargado,
  actualizarVinculo,
  quitarEncargado,
  type DatosVinculoInput,
  type EncargadoBusquedaDto,
  type EncargadosAlumnoDto,
  type VinculoEncargadoDto,
} from "../../lib/api";
import { formatFecha, formatFechaHora, nombreDe } from "../../lib/becas";

interface Permisos {
  parentesco: string;
  esPrincipal: boolean;
  responsableFinanciero: boolean;
  tieneCustodia: boolean;
  autorizadoRecoger: boolean;
  puedeVerNotas: boolean;
  puedeVerPagos: boolean;
  recibeNotificaciones: boolean;
  restringido: boolean;
  motivoRestriccion: string;
  vigenteHasta: string;
  observaciones: string;
}

const permisosPorDefecto = (): Permisos => ({
  parentesco: "", esPrincipal: false, responsableFinanciero: false, tieneCustodia: true, autorizadoRecoger: true,
  puedeVerNotas: true, puedeVerPagos: true, recibeNotificaciones: true, restringido: false, motivoRestriccion: "",
  vigenteHasta: "", observaciones: "",
});

const permisosDe = (v: VinculoEncargadoDto): Permisos => ({
  parentesco: v.parentesco ?? "",
  esPrincipal: v.esPrincipal,
  responsableFinanciero: v.responsableFinanciero,
  tieneCustodia: v.tieneCustodia,
  autorizadoRecoger: v.autorizadoRecoger,
  puedeVerNotas: v.puedeVerNotas,
  puedeVerPagos: v.puedeVerPagos,
  recibeNotificaciones: v.recibeNotificaciones,
  restringido: v.restringido,
  motivoRestriccion: v.motivoRestriccion ?? "",
  vigenteHasta: v.vigenteHasta ? v.vigenteHasta.slice(0, 10) : "",
  observaciones: v.observaciones ?? "",
});

const aInput = (p: Permisos): DatosVinculoInput => ({
  parentesco: p.parentesco || null,
  esPrincipal: p.esPrincipal,
  responsableFinanciero: p.responsableFinanciero,
  tieneCustodia: p.tieneCustodia,
  autorizadoRecoger: p.autorizadoRecoger,
  puedeVerNotas: p.puedeVerNotas,
  puedeVerPagos: p.puedeVerPagos,
  recibeNotificaciones: p.recibeNotificaciones,
  restringido: p.restringido,
  motivoRestriccion: p.restringido ? p.motivoRestriccion : null,
  vigenteHasta: p.vigenteHasta || null,
  observaciones: p.observaciones || null,
});

// Ficha de los encargados de un alumno: quién es el contacto principal, quién paga, quién puede
// recogerlo, restricciones judiciales y tutores temporales. Pensada para la secretaría y portería.
export default function EncargadosAlumno({ alumnoId, onCambio }: { alumnoId: number; onCambio: () => void }) {
  const [datos, setDatos] = useState<EncargadosAlumnoDto | null>(null);
  const [error, setError] = useState("");
  const [exito, setExito] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [editando, setEditando] = useState<number | null>(null);
  const [permisos, setPermisos] = useState<Permisos>(permisosPorDefecto());

  const [agregando, setAgregando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<EncargadoBusquedaDto[]>([]);
  const [elegido, setElegido] = useState<EncargadoBusquedaDto | null>(null);
  const [nuevo, setNuevo] = useState({ nombres: "", apellidos: "", email: "" });
  const [modoNuevo, setModoNuevo] = useState(false);
  const [credencial, setCredencial] = useState<string | null>(null);

  const [quitando, setQuitando] = useState<VinculoEncargadoDto | null>(null);
  const [motivo, setMotivo] = useState("");

  async function cargar() {
    setDatos(await getEncargadosDeAlumno(alumnoId));
  }

  useEffect(() => {
    setDatos(null);
    setEditando(null);
    setAgregando(false);
    setError("");
    setExito("");
    cargar().catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los encargados."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  useEffect(() => {
    if (!agregando || modoNuevo || busqueda.trim().length < 3) { setResultados([]); return; }
    const t = setTimeout(() => {
      buscarEncargados(busqueda.trim()).then(setResultados).catch(() => setResultados([]));
    }, 300);
    return () => clearTimeout(t);
  }, [busqueda, agregando, modoNuevo]);

  async function ejecutar(accion: () => Promise<{ message: string }>) {
    setGuardando(true);
    setError("");
    try {
      const res = await accion();
      setExito(res.message);
      await cargar();
      onCambio();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      return false;
    } finally {
      setGuardando(false);
    }
  }

  function abrirEdicion(v: VinculoEncargadoDto) {
    setAgregando(false);
    setEditando(v.encargadoId);
    setPermisos(permisosDe(v));
  }

  async function guardarEdicion() {
    if (editando === null || !datos) return;
    const input = aInput(permisos);
    // Si no se tocó la vigencia no se reenvía (puede estar vencida y el servidor rechaza fechas pasadas)
    const original = datos.vinculos.find((v) => v.encargadoId === editando);
    if ((original?.vigenteHasta?.slice(0, 10) ?? "") === permisos.vigenteHasta) delete input.vigenteHasta;
    if (await ejecutar(() => actualizarVinculo(alumnoId, editando, input))) setEditando(null);
  }

  function abrirAgregar() {
    setEditando(null);
    setAgregando(true);
    setModoNuevo(false);
    setBusqueda("");
    setElegido(null);
    setNuevo({ nombres: "", apellidos: "", email: "" });
    setCredencial(null);
    setPermisos(permisosPorDefecto());
  }

  async function guardarNuevo() {
    if (!modoNuevo && !elegido) { setError("Busque y seleccione a la persona, o cree una cuenta nueva."); return; }
    const input = {
      ...aInput({ ...permisos, restringido: false }),
      ...(modoNuevo ? { nuevo } : { usuarioId: elegido!.usuarioId }),
    };
    setGuardando(true);
    setError("");
    try {
      const res = await agregarEncargado(alumnoId, input);
      setExito(res.message);
      if (res.data.passwordTemporal) setCredencial(`${modoNuevo ? nuevo.email : elegido?.email} · ${res.data.passwordTemporal}`);
      setAgregando(false);
      await cargar();
      onCambio();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo agregar el encargado.");
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarQuitar() {
    if (!quitando) return;
    if (await ejecutar(() => quitarEncargado(alumnoId, quitando.encargadoId, motivo))) setQuitando(null);
  }

  if (!datos) {
    return error ? <AlertBanner type="error" message={error} /> : <p className="text-sm text-stone-500">Cargando encargados…</p>;
  }

  const activos = datos.vinculos.filter((v) => v.activo);
  const anteriores = datos.vinculos.filter((v) => !v.activo);
  const restringidos = activos.filter((v) => v.restringido);
  const set = <K extends keyof Permisos>(k: K, v: Permisos[K]) => setPermisos((p) => ({ ...p, [k]: v }));

  const formularioPermisos = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Select label="Parentesco" value={permisos.parentesco} onChange={(e) => set("parentesco", e.target.value)}>
          <option value="">Sin indicar</option>
          {datos.parentescos.map((p) => <option key={p}>{p}</option>)}
        </Select>
        <Input label="Vigente hasta" type="date" value={permisos.vigenteHasta} onChange={(e) => set("vigenteHasta", e.target.value)} />
      </div>
      <p className="text-xs text-stone-500 -mt-1">Fecha de fin solo para tutores temporales (ej. abuelos mientras los padres están fuera del país).</p>
      {!permisos.restringido && (
        <div className="grid grid-cols-1 gap-2 rounded-lg border border-stone-200 p-3">
          <Toggle checked={permisos.esPrincipal} onChange={(v) => set("esPrincipal", v)} label="Contacto principal del colegio" />
          <Toggle checked={permisos.responsableFinanciero} onChange={(v) => set("responsableFinanciero", v)} label="Responsable de pagos" />
          <Toggle checked={permisos.tieneCustodia} onChange={(v) => set("tieneCustodia", v)} label="Tiene la custodia" />
          <Toggle checked={permisos.autorizadoRecoger} onChange={(v) => set("autorizadoRecoger", v)} label="Autorizado a recoger al alumno" />
          <Toggle checked={permisos.puedeVerNotas} onChange={(v) => set("puedeVerNotas", v)} label="Puede ver notas y conducta" />
          <Toggle checked={permisos.puedeVerPagos} onChange={(v) => set("puedeVerPagos", v)} label="Puede ver y hacer pagos" />
          <Toggle checked={permisos.recibeNotificaciones} onChange={(v) => set("recibeNotificaciones", v)} label="Recibe notificaciones y correos" />
        </div>
      )}
      {editando !== null && (
        <div className={`rounded-lg border p-3 space-y-2 ${permisos.restringido ? "border-danger-600/30 bg-danger-50" : "border-stone-200"}`}>
          <Toggle checked={permisos.restringido} onChange={(v) => set("restringido", v)} label="Restricción judicial (orden de alejamiento)" />
          {permisos.restringido && (
            <>
              <Textarea label="Motivo / número de orden" rows={2} value={permisos.motivoRestriccion} onChange={(e) => set("motivoRestriccion", e.target.value)}
                placeholder="Ej. Orden de alejamiento No. 01080-2026-00118, Juzgado de Familia" />
              <p className="text-xs text-danger-700">Pierde todo acceso: no verá información, no recibirá avisos y no podrá recoger al alumno.</p>
            </>
          )}
        </div>
      )}
      <Input label="Observaciones" value={permisos.observaciones} onChange={(e) => set("observaciones", e.target.value)} placeholder="Ej. Convenio de custodia del 12/03/2025" />
    </div>
  );

  return (
    <div className="space-y-5">
      <div>
        <p className="font-semibold text-stone-900">{datos.alumno.nombre}</p>
        <p className="text-sm text-stone-500">{datos.alumno.grado} · {activos.length} de {datos.maximo} encargados activos</p>
      </div>

      {restringidos.map((v) => (
        <div key={v.encargadoId} className="rounded-lg border-2 border-danger-600 bg-danger-50 p-3 flex gap-2.5">
          <AlertOctagon className="w-5 h-5 text-danger-700 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-danger-800">No entregar al alumno a {nombreDe(v.encargado.usuario)}</p>
            <p className="text-xs text-danger-800 mt-0.5">{v.motivoRestriccion}</p>
          </div>
        </div>
      ))}

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {exito && <AlertBanner type="success" message={exito} onClose={() => setExito("")} />}
      {credencial && (
        <div className="rounded-lg border border-action-200 bg-action-50 p-3 text-sm">
          <p className="font-medium text-stone-800 flex items-center gap-1.5"><KeyRound className="w-4 h-4" />Credenciales del nuevo encargado</p>
          <p className="font-mono-data text-stone-900 mt-1">{credencial}</p>
          <p className="text-xs text-stone-500 mt-1">Entréguelas al encargado; no se volverán a mostrar.</p>
        </div>
      )}

      <ul className="space-y-3">
        {activos.map((v) => (
          <li key={v.encargadoId} className={`rounded-xl border p-4 ${v.restringido ? "border-danger-600/40 bg-danger-50/40" : "border-stone-200"}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-stone-900 text-sm">{nombreDe(v.encargado.usuario)}</p>
                <p className="text-xs text-stone-500 truncate">{v.encargado.usuario.email}{v.parentesco ? ` · ${v.parentesco}` : ""}</p>
              </div>
              {editando !== v.encargadoId && (
                <div className="flex shrink-0">
                  <button onClick={() => abrirEdicion(v)} className="p-1.5 text-stone-400 hover:text-primary-700 rounded cursor-pointer" title="Editar permisos" aria-label="Editar permisos"><Edit className="w-3.5 h-3.5" /></button>
                  <button onClick={() => { setQuitando(v); setMotivo(""); }} className="p-1.5 text-stone-400 hover:text-danger-700 rounded cursor-pointer" title="Quitar encargado" aria-label="Quitar encargado"><UserMinus className="w-3.5 h-3.5" /></button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1 mt-2">
              {v.restringido && <Badge variant="danger">Restringido</Badge>}
              {v.esPrincipal && <Badge variant="primary"><Star className="w-3 h-3" />Contacto principal</Badge>}
              {v.responsableFinanciero && <Badge variant="info"><Wallet className="w-3 h-3" />Paga</Badge>}
              {!v.restringido && <Badge variant={v.tieneCustodia ? "success" : "neutral"}><Home className="w-3 h-3" />{v.tieneCustodia ? "Custodia" : "Sin custodia"}</Badge>}
              {!v.restringido && <Badge variant={v.autorizadoRecoger ? "success" : "warning"}>{v.autorizadoRecoger ? <Car className="w-3 h-3" /> : <CarFront className="w-3 h-3" />}{v.autorizadoRecoger ? "Puede recogerlo" : "NO puede recogerlo"}</Badge>}
              {v.vigenteHasta && <Badge variant={v.vigente ? "warning" : "neutral"}><Clock className="w-3 h-3" />{v.vigente ? `Hasta ${formatFecha(v.vigenteHasta)}` : "Vencido"}</Badge>}
            </div>

            {!v.restringido && (
              <div className="flex flex-wrap gap-3 mt-2 text-xs">
                <span className={v.puedeVerNotas ? "text-stone-600" : "text-stone-400 line-through"}><BookOpen className="w-3 h-3 inline mr-0.5" />Notas</span>
                <span className={v.puedeVerPagos ? "text-stone-600" : "text-stone-400 line-through"}><CreditCard className="w-3 h-3 inline mr-0.5" />Pagos</span>
                <span className={v.recibeNotificaciones ? "text-stone-600" : "text-stone-400"}>{v.recibeNotificaciones ? <Bell className="w-3 h-3 inline mr-0.5" /> : <BellOff className="w-3 h-3 inline mr-0.5" />}Avisos</span>
              </div>
            )}
            {v.observaciones && <p className="text-xs text-stone-500 mt-2 italic">{v.observaciones}</p>}

            {editando === v.encargadoId && (
              <div className="mt-4 pt-4 border-t border-stone-100">
                {formularioPermisos}
                <div className="flex justify-end gap-2 mt-3">
                  <Btn variant="outline" size="sm" onClick={() => setEditando(null)} disabled={guardando}>Cancelar</Btn>
                  <Btn variant="primary" size="sm" loading={guardando} onClick={guardarEdicion}>Guardar</Btn>
                </div>
              </div>
            )}
          </li>
        ))}
        {activos.length === 0 && <p className="text-sm text-stone-500">El alumno no tiene encargados activos.</p>}
      </ul>

      {/* Agregar encargado */}
      {!agregando ? (
        activos.length < datos.maximo && (
          <Btn variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} onClick={abrirAgregar}>Agregar encargado</Btn>
        )
      ) : (
        <div className="rounded-xl border-2 border-primary-200 p-4 space-y-3">
          <p className="text-sm font-semibold text-stone-800">Agregar encargado</p>
          <div className="flex gap-1 p-1 rounded-lg bg-stone-100">
            {[{ id: false, label: "Ya tiene cuenta" }, { id: true, label: "Crear cuenta nueva" }].map((o) => (
              <button key={String(o.id)} type="button" onClick={() => { setModoNuevo(o.id); setElegido(null); }}
                className={`flex-1 px-2 py-1.5 rounded-md text-xs font-medium cursor-pointer ${modoNuevo === o.id ? "bg-white text-primary-700 shadow-sm" : "text-stone-500"}`}>
                {o.label}
              </button>
            ))}
          </div>

          {!modoNuevo ? (
            elegido ? (
              <div className="flex items-center justify-between rounded-lg bg-primary-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-stone-900">{elegido.nombre}</p>
                  <p className="text-xs text-stone-500">{elegido.email} · {elegido.rol}</p>
                </div>
                <button onClick={() => setElegido(null)} className="text-xs text-primary-700 hover:underline cursor-pointer">Cambiar</button>
              </div>
            ) : (
              <div>
                <Input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o correo (mín. 3 letras)" prefix={<Search className="w-4 h-4" />} />
                {resultados.length > 0 && (
                  <ul className="mt-1 border border-stone-200 rounded-lg divide-y divide-stone-100 max-h-48 overflow-y-auto">
                    {resultados.map((r) => (
                      <li key={r.usuarioId}>
                        <button type="button" onClick={() => setElegido(r)} className="w-full text-left px-3 py-2 hover:bg-stone-50 cursor-pointer">
                          <p className="text-sm text-stone-900">{r.nombre}</p>
                          <p className="text-xs text-stone-500">{r.email} · {r.rol}{r.esEncargado ? ` · ${r.alumnosACargo} alumno(s) a cargo` : ""}</p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="text-xs text-stone-500 mt-1">Si la persona ya trabaja en el colegio (ej. es catedrático), se le agrega el rol de Encargado a su misma cuenta.</p>
              </div>
            )
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <Input label="Nombres" value={nuevo.nombres} onChange={(e) => setNuevo((n) => ({ ...n, nombres: e.target.value }))} />
              <Input label="Apellidos" value={nuevo.apellidos} onChange={(e) => setNuevo((n) => ({ ...n, apellidos: e.target.value }))} />
              <div className="col-span-2">
                <Input label="Correo electrónico" type="email" value={nuevo.email} onChange={(e) => setNuevo((n) => ({ ...n, email: e.target.value }))} />
              </div>
            </div>
          )}

          {formularioPermisos}
          {activos.length === 0 && <p className="text-xs text-stone-500">Al ser el primer encargado, quedará como contacto principal y responsable de pagos.</p>}

          <div className="flex justify-end gap-2">
            <Btn variant="outline" size="sm" onClick={() => setAgregando(false)} disabled={guardando}>Cancelar</Btn>
            <Btn variant="primary" size="sm" loading={guardando} onClick={guardarNuevo}>Agregar</Btn>
          </div>
        </div>
      )}

      {quitando && (
        <div className="rounded-xl border-2 border-danger-600/30 p-4 space-y-3">
          <p className="text-sm text-stone-700">
            ¿Quitar a <strong>{nombreDe(quitando.encargado.usuario)}</strong> como encargado? Perderá el acceso a la información del alumno. El historial se conserva.
          </p>
          <Textarea label="Motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. Cambio de tutor legal" />
          <div className="flex justify-end gap-2">
            <Btn variant="outline" size="sm" onClick={() => setQuitando(null)} disabled={guardando}>Cancelar</Btn>
            <Btn variant="destructive" size="sm" loading={guardando} onClick={confirmarQuitar}>Quitar</Btn>
          </div>
        </div>
      )}

      {anteriores.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-stone-500 hover:text-stone-700">Encargados anteriores ({anteriores.length})</summary>
          <ul className="mt-2 space-y-1">
            {anteriores.map((v) => (
              <li key={v.encargadoId} className="text-xs text-stone-500">
                {nombreDe(v.encargado.usuario)}{v.parentesco ? ` (${v.parentesco})` : ""} · hasta {v.vigenteHasta ? formatFecha(v.vigenteHasta) : "—"}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="pt-4 border-t border-stone-100">
        <p className="text-sm font-semibold text-stone-700 mb-2">Historial de cambios</p>
        {datos.bitacora.length === 0 ? (
          <p className="text-xs text-stone-500">Sin cambios registrados.</p>
        ) : (
          <ul className="space-y-2.5">
            {datos.bitacora.map((b) => (
              <li key={b.bitacoraId} className="text-xs">
                <span className="font-medium text-stone-700">{b.accion}</span> · <span className="text-stone-400">{formatFechaHora(b.fecha)}</span>
                <p className="text-stone-600">{b.detalle}</p>
                <p className="text-stone-400">{b.usuario ? nombreDe(b.usuario) : "Sistema"}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

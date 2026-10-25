import { useCallback, useEffect, useState } from "react";
import { Plus, Edit, Trash2, BookOpen } from "../../components/Iconos";
import { Card, SectionHeader, Btn, TH, TD, Modal, Select, AlertBanner, EmptyState, Badge, CursoMarca } from "../../components/Ui";
import {
  getGrados, getSeccionesAdmin, getCursosSeccionAdmin, asignarCursoSeccion, cambiarCatedraticoCurso, quitarCursoSeccion,
  type GradoDto, type SeccionAdminDto, type CursoSeccionAdminDto,
} from "../../lib/api";
import { DIAS_SEMANA, etiquetaSeccion, horasSemanales, useCatedraticos } from "./academico";

type Dialogo =
  | { tipo: "asignar" }
  | { tipo: "catedratico"; asignacion: CursoSeccionAdminDto }
  | { tipo: "quitar"; asignacion: CursoSeccionAdminDto };

export default function CursosView() {
  const anioActual = new Date().getFullYear();
  const [ciclo, setCiclo] = useState(anioActual);
  const [ciclos, setCiclos] = useState<number[]>([anioActual]);
  const [grados, setGrados] = useState<GradoDto[]>([]);
  const [secciones, setSecciones] = useState<SeccionAdminDto[]>([]);
  const [asignaciones, setAsignaciones] = useState<CursoSeccionAdminDto[]>([]);
  const [filtroSeccion, setFiltroSeccion] = useState<number | "todas">("todas");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const { catedraticos, error: errorCat } = useCatedraticos();

  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [form, setForm] = useState({ seccionId: 0, cursoId: 0, catedraticoId: 0 });
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s, a] = await Promise.all([getGrados(), getSeccionesAdmin({ anioLectivo: ciclo }), getCursosSeccionAdmin()]);
      setGrados(g);
      setSecciones(s.secciones);
      setCiclos([...new Set([anioActual, anioActual + 1, ...s.ciclos])].sort((x, y) => y - x));
      setAsignaciones(a.filter((x) => x.seccion.anioLectivo === ciclo));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los cursos.");
    } finally {
      setLoading(false);
    }
  }, [ciclo, anioActual]);

  useEffect(() => { cargar(); }, [cargar]);

  const visibles = asignaciones
    .filter((a) => filtroSeccion === "todas" || a.seccionId === filtroSeccion)
    .sort((a, b) => etiquetaSeccion(a.seccion).localeCompare(etiquetaSeccion(b.seccion)) || a.curso.nombre.localeCompare(b.curso.nombre));

  // Cursos de la malla del grado que la sección aún no tiene
  const seccionForm = secciones.find((s) => s.seccionId === form.seccionId);
  const cursosDisponibles = seccionForm
    ? (grados.find((g) => g.gradoId === seccionForm.grado.gradoId)?.cursos ?? [])
        .filter((c) => !asignaciones.some((a) => a.seccionId === seccionForm.seccionId && a.cursoId === c.cursoId))
    : [];
  const pendientes = secciones.reduce((acc, s) => {
    const malla = grados.find((g) => g.gradoId === s.grado.gradoId)?.cursos.length ?? 0;
    return acc + Math.max(0, malla - asignaciones.filter((a) => a.seccionId === s.seccionId).length);
  }, 0);

  function abrir(d: Dialogo) {
    setDialogo(d);
    setErrorDialogo("");
    if (d.tipo === "asignar") setForm({ seccionId: filtroSeccion === "todas" ? 0 : filtroSeccion, cursoId: 0, catedraticoId: 0 });
    if (d.tipo === "catedratico") setForm({ seccionId: d.asignacion.seccionId, cursoId: d.asignacion.cursoId, catedraticoId: d.asignacion.catedraticoId });
  }

  async function confirmar() {
    if (!dialogo) return;
    setGuardando(true);
    setErrorDialogo("");
    try {
      const res =
        dialogo.tipo === "asignar" ? await asignarCursoSeccion(form)
        : dialogo.tipo === "catedratico" ? await cambiarCatedraticoCurso(dialogo.asignacion.cursoSeccionId, form.catedraticoId)
        : await quitarCursoSeccion(dialogo.asignacion.cursoSeccionId);
      setAviso(res.message ?? "Cambios guardados.");
      setDialogo(null);
      await cargar();
    } catch (e) {
      setErrorDialogo(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  const listaCatedraticos = catedraticos ?? [];

  return (
    <div className="space-y-5">
      <SectionHeader title="Cursos" subtitle="Cursos de la malla asignados a cada sección y su catedrático"
        action={
          <div className="flex items-center gap-2">
            <Select aria-label="Ciclo escolar" value={ciclo} onChange={(e) => { setCiclo(Number(e.target.value)); setFiltroSeccion("todas"); }}>
              {ciclos.map((c) => <option key={c} value={c}>Ciclo {c}</option>)}
            </Select>
            <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} disabled={secciones.length === 0} onClick={() => abrir({ tipo: "asignar" })}>Asignar curso</Btn>
          </div>
        } />

      {(error || errorCat) && <AlertBanner type="error" message={error || errorCat} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}
      {!loading && pendientes > 0 && (
        <AlertBanner type="warning" message={`Faltan ${pendientes} curso(s) de la malla por asignar en las secciones de ${ciclo}. Sin curso asignado los alumnos no tienen notas ni horario de esa materia.`} />
      )}

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-stone-100">
          <Select aria-label="Filtrar por sección" value={filtroSeccion} onChange={(e) => setFiltroSeccion(e.target.value === "todas" ? "todas" : Number(e.target.value))}>
            <option value="todas">Todas las secciones</option>
            {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{etiquetaSeccion(s)}</option>)}
          </Select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr><TH>Curso</TH><TH>Grado · Sección</TH><TH>Catedrático</TH><TH>Horario</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">Cargando cursos…</td></tr>
              ) : visibles.length === 0 ? (
                <tr><td colSpan={5}><EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados"
                  description={secciones.length ? "Asigne los cursos de la malla a cada sección." : `No hay secciones en ${ciclo}. Créelas en Grados y Secciones.`} /></td></tr>
              ) : visibles.map((a) => (
                <tr key={a.cursoSeccionId} className="hover:bg-sand-50 transition-colors">
                  <TD><span className="flex items-center gap-3"><CursoMarca nombre={a.curso.nombre} size="sm" /><span className="font-semibold text-stone-900">{a.curso.nombre}</span></span></TD>
                  <TD>{etiquetaSeccion(a.seccion)}</TD>
                  <TD>{a.catedratico.usuario.nombres} {a.catedratico.usuario.apellidos}</TD>
                  <TD>
                    {a.horarios.length ? (
                      <span className="text-stone-500 text-xs">
                        {[...new Set(a.horarios.map((h) => DIAS_SEMANA[h.diaSemana].slice(0, 3)))].join("/")} · {horasSemanales(a.horarios)} h/sem
                      </span>
                    ) : <Badge variant="warning">Sin horario</Badge>}
                  </TD>
                  <TD className="text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => abrir({ tipo: "catedratico", asignacion: a })} aria-label="Cambiar catedrático"
                        className="p-1.5 text-stone-400 hover:text-primary-700 rounded cursor-pointer"><Edit className="w-3.5 h-3.5" /></button>
                      <button onClick={() => abrir({ tipo: "quitar", asignacion: a })} aria-label="Quitar curso"
                        className="p-1.5 text-stone-400 hover:text-danger-700 rounded cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={!!dialogo} onClose={() => !guardando && setDialogo(null)}
        title={dialogo?.tipo === "asignar" ? "Asignar curso" : dialogo?.tipo === "catedratico" ? "Cambiar catedrático" : "Quitar curso"}
        footer={<>
          <Btn variant="ghost" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant={dialogo?.tipo === "quitar" ? "destructive" : "primary"} loading={guardando}
            disabled={dialogo?.tipo === "asignar" ? !form.seccionId || !form.cursoId || !form.catedraticoId : dialogo?.tipo === "catedratico" ? !form.catedraticoId : false}
            onClick={confirmar}>
            {dialogo?.tipo === "quitar" ? "Quitar" : "Guardar"}
          </Btn>
        </>}>
        <div className="space-y-3">
          {dialogo?.tipo === "asignar" && (
            <>
              <Select label="Sección" value={form.seccionId || ""} onChange={(e) => setForm({ seccionId: Number(e.target.value), cursoId: 0, catedraticoId: form.catedraticoId })}>
                <option value="">Seleccione…</option>
                {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{etiquetaSeccion(s)}</option>)}
              </Select>
              <Select label="Curso (de la malla del grado)" value={form.cursoId || ""} disabled={!form.seccionId} onChange={(e) => setForm({ ...form, cursoId: Number(e.target.value) })}>
                <option value="">{form.seccionId && cursosDisponibles.length === 0 ? "Todos los cursos ya están asignados" : "Seleccione…"}</option>
                {cursosDisponibles.map((c) => <option key={c.cursoId} value={c.cursoId}>{c.nombre}</option>)}
              </Select>
            </>
          )}
          {(dialogo?.tipo === "asignar" || dialogo?.tipo === "catedratico") && (
            <>
              {dialogo.tipo === "catedratico" && <p className="text-sm text-stone-600">{dialogo.asignacion.curso.nombre} — {etiquetaSeccion(dialogo.asignacion.seccion)}</p>}
              <Select label="Catedrático" value={form.catedraticoId || ""} onChange={(e) => setForm({ ...form, catedraticoId: Number(e.target.value) })}>
                <option value="">Seleccione…</option>
                {listaCatedraticos.map((c) => (
                  <option key={c.catedraticoId} value={c.catedraticoId}>
                    {c.nombre}{c.especialidad ? ` — ${c.especialidad}` : ""} ({horasSemanales(c.cursos.flatMap((x) => x.horarios))} h/sem)
                  </option>
                ))}
              </Select>
              {listaCatedraticos.length === 0 && <p className="text-xs text-stone-500">No hay catedráticos en la sede. Créelos en Usuarios.</p>}
              {dialogo.tipo === "catedratico" && <p className="text-xs text-stone-500">Si el nuevo catedrático ya tiene clase en alguno de los bloques de este curso, el sistema no permitirá el cambio.</p>}
            </>
          )}
          {dialogo?.tipo === "quitar" && (
            <p className="text-sm text-stone-600">
              ¿Quitar {dialogo.asignacion.curso.nombre} de {etiquetaSeccion(dialogo.asignacion.seccion)}? Solo es posible si aún no tiene notas ni asistencia registradas.
            </p>
          )}
          {errorDialogo && <AlertBanner type="error" message={errorDialogo} />}
        </div>
      </Modal>
    </div>
  );
}

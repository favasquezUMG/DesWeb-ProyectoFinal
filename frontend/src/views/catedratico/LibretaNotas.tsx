import { useEffect, useMemo, useState } from "react";
import { BookText, CheckCircle2, Plus, Save } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, Tabs, EmptyState } from "../../components/Ui";
import { getLibreta, guardarNotasActividad, type ActividadDto, type LibretaDto } from "../../lib/api";
import ActividadModal, { type ActividadEnEdicion } from "./ActividadModal";
import {
  CursoSelect, Cargando, EstadoNota, UNIDAD_LABEL, NOTA_APROBACION, PUNTEO_POR_TIPO, actividadesPorTipo, calcularTotales, errorMsg,
  iniciales, redondear, sumaPuntos, useMisCursos,
  type TotalesAlumno,
} from "./shared";

type Borradores = Record<string, string>; // "actividadId-alumnoId" -> valor escrito

const clave = (actividadId: number, alumnoId: number) => `${actividadId}-${alumnoId}`;

export default function LibretaNotas() {
  const { cursos, seleccion, setSeleccion, loading: cargandoCursos, error: errorCursos } = useMisCursos();
  const [libreta, setLibreta] = useState<LibretaDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [borradores, setBorradores] = useState<Borradores>({});
  const [unidad, setUnidad] = useState(UNIDAD_LABEL[1]);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [edicion, setEdicion] = useState<ActividadEnEdicion | null>(null);

  async function cargar(cursoSeccionId: number) {
    setCargando(true);
    setError("");
    try {
      setLibreta(await getLibreta(cursoSeccionId));
      setBorradores({});
    } catch (err) {
      setError(errorMsg(err, "No se pudo cargar la libreta."));
      setLibreta(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    if (seleccion) cargar(seleccion);
  }, [seleccion]);

  const notasGuardadas = useMemo(
    () => new Map((libreta?.notas ?? []).map((n) => [clave(n.actividadId, n.alumnoId), n.valor])),
    [libreta],
  );

  const actividades = useMemo(
    () => new Map((libreta?.unidades ?? []).flatMap((u) => u.actividades.map((a) => [a.actividadId, a] as const))),
    [libreta],
  );

  // Valor visible de una casilla: lo escrito si hay borrador, si no lo guardado
  function valorCasilla(actividadId: number, alumnoId: number): string {
    const k = clave(actividadId, alumnoId);
    if (k in borradores) return borradores[k];
    const v = notasGuardadas.get(k);
    return v === undefined ? "" : String(v);
  }

  // Solo los borradores que realmente difieren de lo guardado
  const cambios = useMemo(() => Object.entries(borradores).filter(([k, v]) => {
    const original = notasGuardadas.get(k);
    return v.trim() === "" ? original !== undefined : Number(v) !== original;
  }), [borradores, notasGuardadas]);
  const clavesCambiadas = useMemo(() => new Set(cambios.map(([k]) => k)), [cambios]);

  const errores = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(borradores)) {
      if (v.trim() === "") continue;
      const max = actividades.get(Number(k.split("-")[0]))?.puntosMaximos ?? 0;
      const n = Number(v);
      if (isNaN(n) || n < 0 || n > max) out[k] = `0–${max}`;
    }
    return out;
  }, [borradores, actividades]);

  // Totales con lo que el catedrático va escribiendo, para ver el efecto antes de guardar
  const totales = useMemo(() => {
    if (!libreta) return new Map<number, TotalesAlumno>();
    const notas = libreta.alumnos.flatMap((a) =>
      [...actividades.keys()].flatMap((actividadId) => {
        const v = valorCasilla(actividadId, a.alumnoId);
        const n = Number(v);
        return v.trim() === "" || isNaN(n) ? [] : [{ actividadId, alumnoId: a.alumnoId, valor: n }];
      }),
    );
    return calcularTotales({ ...libreta, notas });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [libreta, borradores, actividades]);

  function cambiarCurso(id: number) {
    if (cambios.length > 0 && !window.confirm("Tiene notas sin guardar. ¿Desea descartarlas?")) return;
    setSeleccion(id);
  }

  function handleChange(actividadId: number, alumnoId: number, valor: string) {
    setBorradores((prev) => ({ ...prev, [clave(actividadId, alumnoId)]: valor }));
    setGuardado(false);
  }

  async function handleGuardar() {
    if (!libreta || cambios.length === 0 || Object.keys(errores).length > 0) return;
    setGuardando(true);
    setError("");

    const porActividad = new Map<number, { alumnoId: number; valor: number | null }[]>();
    for (const [k, v] of cambios) {
      const [actividadId, alumnoId] = k.split("-").map(Number);
      const lista = porActividad.get(actividadId) ?? [];
      lista.push({ alumnoId, valor: v.trim() === "" ? null : Number(v) });
      porActividad.set(actividadId, lista);
    }

    try {
      for (const [actividadId, notas] of porActividad) {
        await guardarNotasActividad(actividadId, notas);
      }
      await cargar(libreta.cursoSeccionId);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err) {
      setError(errorMsg(err, "No se pudieron guardar las notas."));
      // Lo que alcanzó a guardarse se refleja recargando sin perder los borradores
      try {
        const actual = await getLibreta(libreta.cursoSeccionId);
        setLibreta(actual);
      } catch { /* se queda con lo que tenía */ }
    } finally {
      setGuardando(false);
    }
  }

  // Tras crear o editar una actividad se recarga la libreta sin perder las notas escritas
  async function recargarActividades() {
    if (!libreta) return;
    setLibreta(await getLibreta(libreta.cursoSeccionId));
  }

  if (cargandoCursos) return <Cargando texto="Cargando sus cursos..." />;
  if (errorCursos) return <AlertBanner type="error" message={errorCursos} />;
  if (cursos.length === 0) {
    return <EmptyState icon={<BookText className="w-10 h-10" />} title="Sin cursos asignados" description="Aún no tiene cursos asignados en este ciclo." />;
  }

  const unidadActual = libreta?.unidades.find((u) => UNIDAD_LABEL[u.numero] === unidad);
  const idxUnidad = libreta && unidadActual ? libreta.unidades.findIndex((u) => u.unidadId === unidadActual.unidadId) : -1;
  const zona = unidadActual ? actividadesPorTipo(unidadActual.actividades, "Zona") : [];
  const examenes = unidadActual ? actividadesPorTipo(unidadActual.actividades, "Examen") : [];
  const puntosZona = sumaPuntos(zona);
  const puntosExamen = sumaPuntos(examenes);
  const hayErrores = Object.keys(errores).length > 0;
  const dirty = cambios.length > 0;

  function celdaNota(act: ActividadDto, alumnoId: number, nombreAlumno: string) {
    const k = clave(act.actividadId, alumnoId);
    const err = errores[k];
    return (
      <td key={act.actividadId} className="px-2 py-2 text-center">
        <div className="flex flex-col items-center gap-1">
          <input
            type="number" min="0" max={act.puntosMaximos} step="0.5"
            value={valorCasilla(act.actividadId, alumnoId)}
            onChange={(e) => handleChange(act.actividadId, alumnoId, e.target.value)}
            placeholder="—"
            aria-label={`Nota de ${act.nombre} de ${nombreAlumno}`}
            aria-invalid={!!err}
            className={`w-16 text-center border rounded-lg px-2 py-1.5 text-sm font-mono-data font-semibold focus:outline-none focus:ring-2 transition-colors
              ${err ? "border-danger-500 bg-danger-50 text-danger-800 focus:ring-danger-500" : clavesCambiadas.has(k) ? "border-warning-400 bg-warning-50 text-stone-800 focus:ring-primary-700" : "border-stone-200 bg-white text-stone-800 focus:ring-primary-700 focus:border-primary-700"}`}
          />
          {err && <span className="text-[10px] text-danger-700 leading-tight">{err}</span>}
        </div>
      </td>
    );
  }

  function encabezadoActividad(act: ActividadDto) {
    return (
      <th key={act.actividadId} className="px-2 py-2 text-center text-xs font-semibold text-stone-500">
        <button
          onClick={() => unidadActual && setEdicion({ unidadId: unidadActual.unidadId, actividad: act })}
          className="flex flex-col items-center gap-0.5 mx-auto hover:text-primary-700 cursor-pointer"
          title="Editar actividad"
        >
          <span className="max-w-28 truncate">{act.nombre}</span>
          <span className="text-[10px] font-normal text-stone-400">(0–{act.puntosMaximos})</span>
        </button>
      </th>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SectionHeader
          title="Libreta de Notas"
          subtitle={`Cada unidad: zona ${PUNTEO_POR_TIPO.Zona} + examen ${PUNTEO_POR_TIPO.Examen} = 100 · Nota final = promedio de unidades · ${NOTA_APROBACION} o más = aprobado`}
        />
        <div className="flex flex-wrap gap-2 items-center">
          {dirty && (
            <span className="text-xs text-warning-700 flex items-center gap-1 bg-warning-50 px-2 py-1 rounded-full border border-warning-200">
              <span className="w-1.5 h-1.5 rounded-full bg-warning-600 animate-pulse" />Cambios sin guardar
            </span>
          )}
          {guardado && (
            <span className="text-xs text-success-700 flex items-center gap-1 bg-success-50 px-2 py-1 rounded-full border border-success-200">
              <CheckCircle2 className="w-3.5 h-3.5" />Notas guardadas
            </span>
          )}
          <CursoSelect cursos={cursos} value={seleccion} onChange={cambiarCurso} />
          <Btn variant="primary" size="sm" icon={<Save className="w-4 h-4" />} loading={guardando} onClick={handleGuardar} disabled={!dirty || hayErrores}>
            Guardar notas
          </Btn>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {hayErrores && (
        <AlertBanner type="error" title="Valores fuera de rango" message="Una o más notas superan el punteo de su actividad. Corrija los campos marcados en rojo antes de guardar." />
      )}

      <Tabs tabs={Object.values(UNIDAD_LABEL)} active={unidad} onChange={setUnidad} />

      {cargando || !libreta ? <Cargando /> : !unidadActual ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant={puntosZona > PUNTEO_POR_TIPO.Zona ? "danger" : "primary"}>Zona: {puntosZona} de {PUNTEO_POR_TIPO.Zona} pts asignados</Badge>
              <Badge variant={puntosExamen > PUNTEO_POR_TIPO.Examen ? "danger" : "info"}>Examen: {puntosExamen} de {PUNTEO_POR_TIPO.Examen} pts asignados</Badge>
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} disabled={puntosZona >= PUNTEO_POR_TIPO.Zona}
                onClick={() => setEdicion({ unidadId: unidadActual.unidadId, tipo: "Zona" })}>
                Tarea / actividad de zona
              </Btn>
              <Btn variant="outline" size="sm" icon={<Plus className="w-4 h-4" />} disabled={puntosExamen >= PUNTEO_POR_TIPO.Examen}
                onClick={() => setEdicion({ unidadId: unidadActual.unidadId, tipo: "Examen" })}>
                Examen
              </Btn>
            </div>
          </div>

          {unidadActual.actividades.length === 0 ? (
            <EmptyState
              icon={<BookText className="w-10 h-10" />}
              title="Sin actividades en esta unidad"
              description="Agregue las tareas de la zona y el examen de la unidad para poder ingresar notas."
            />
          ) : libreta.alumnos.length === 0 ? (
            <EmptyState icon={<BookText className="w-10 h-10" />} title="Sin alumnos" description="La sección no tiene alumnos inscritos." />
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-stone-50 text-[11px] font-semibold uppercase tracking-wider">
                      <th className="sticky left-0 bg-stone-50 z-10" />
                      {zona.length > 0 && (
                        <th colSpan={zona.length + 1} className="px-2 pt-2 text-center text-primary-800 border-b-2 border-primary-200">
                          Zona ({PUNTEO_POR_TIPO.Zona} pts)
                        </th>
                      )}
                      {examenes.length > 0 && (
                        <th colSpan={examenes.length} className="px-2 pt-2 text-center text-info-800 border-b-2 border-info-200">
                          Examen ({PUNTEO_POR_TIPO.Examen} pts)
                        </th>
                      )}
                      <th colSpan={3} />
                    </tr>
                    <tr className="bg-stone-50 border-b border-stone-200">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider sticky left-0 bg-stone-50 z-10 min-w-52">Alumno</th>
                      {zona.map(encabezadoActividad)}
                      {zona.length > 0 && (
                        <th className="px-3 py-2 text-center text-xs font-semibold text-primary-800 bg-primary-50 uppercase">
                          Total zona
                          <span className="block text-[10px] font-normal normal-case text-primary-700">de {puntosZona}</span>
                        </th>
                      )}
                      {examenes.map(encabezadoActividad)}
                      <th className="px-3 py-2 text-center text-xs font-semibold text-stone-600 bg-stone-100 uppercase">
                        Total unidad
                        <span className="block text-[10px] font-normal normal-case text-stone-400">de 100</span>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-stone-500 uppercase">
                        Nota final
                        <span className="block text-[10px] font-normal normal-case text-stone-400">promedio</span>
                      </th>
                      <th className="px-3 py-2 text-center text-xs font-semibold text-stone-500 uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {libreta.alumnos.map((al) => {
                      const t = totales.get(al.alumnoId);
                      const nu = t && idxUnidad >= 0 ? t.unidades[idxUnidad] : undefined;
                      const nombreAlumno = `${al.nombres} ${al.apellidos}`;
                      const final = t ? redondear(t.total) : 0;
                      return (
                        <tr key={al.alumnoId} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-3 sticky left-0 bg-white z-10">
                            <div className="flex items-center gap-2.5">
                              <div className="w-6 h-6 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                                {iniciales(al.nombres, al.apellidos)}
                              </div>
                              <span className="font-medium text-stone-900 whitespace-nowrap">{al.apellidos}, {al.nombres}</span>
                            </div>
                          </td>
                          {zona.map((act) => celdaNota(act, al.alumnoId, nombreAlumno))}
                          {zona.length > 0 && (
                            <td className="px-3 py-3 text-center font-mono-data font-bold text-primary-800 bg-primary-50/60">{nu ? redondear(nu.zona) : 0}</td>
                          )}
                          {examenes.map((act) => celdaNota(act, al.alumnoId, nombreAlumno))}
                          <td className={`px-3 py-3 text-center font-mono-data font-bold bg-stone-50 ${nu && nu.total >= NOTA_APROBACION ? "text-success-700" : "text-stone-800"}`}>
                            {nu ? redondear(nu.total) : 0}
                          </td>
                          <td className="px-3 py-3 text-center">
                            {t?.conNotas ? (
                              <span className={`font-mono-data font-bold ${final >= NOTA_APROBACION ? "text-success-700" : "text-stone-700"}`}>{final}</span>
                            ) : <span className="text-stone-300 font-mono-data">—</span>}
                          </td>
                          <td className="px-3 py-3 text-center"><EstadoNota totales={t} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="px-4 py-2 text-[11px] text-stone-400 border-t border-stone-100">
                Haga clic en el nombre de una actividad para editarla. Deje una casilla vacía para borrar la nota.
              </p>
            </Card>
          )}
        </>
      )}

      <ActividadModal
        libreta={libreta ?? { cursoSeccionId: 0, curso: "", grado: "", seccion: "", unidades: [], alumnos: [], notas: [] }}
        edicion={libreta ? edicion : null}
        onClose={() => setEdicion(null)}
        onGuardado={recargarActividades}
      />
    </div>
  );
}

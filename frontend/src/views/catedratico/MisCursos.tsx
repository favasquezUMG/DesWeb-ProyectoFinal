import { useEffect, useMemo, useState } from "react";
import { BookOpen, Download, Pencil, Plus, Trash2 } from "lucide-react";
import { Card, SectionHeader, Btn, Badge, AlertBanner, EmptyState, Modal, Tabs, TH, TD } from "../../components/Ui";
import {
  deleteActividad, getLibreta, getResumenAsistencia,
  type ActividadDto, type LibretaDto, type ResumenAsistenciaDto, type TipoActividad,
} from "../../lib/api";
import ActividadModal, { type ActividadEnEdicion } from "./ActividadModal";
import {
  Cargando, CursoSelect, EstadoNota, NOTA_APROBACION, PUNTEO_POR_TIPO, TIPO_LABEL, UNIDAD_LABEL,
  actividadesPorTipo, calcularTotales, errorMsg, estadoAcademico, formatFechaCorta, redondear, sumaPuntos, useMisCursos,
  type TotalesAlumno,
} from "./shared";

// Descarga la libreta del curso como CSV (lo abre Excel). El BOM hace que respete las tildes.
function exportarCsv(nombreArchivo: string, libreta: LibretaDto, totales: Map<number, TotalesAlumno>, resumen: ResumenAsistenciaDto | null) {
  const asistencia = new Map((resumen?.alumnos ?? []).map((a) => [a.alumnoId, a.porcentaje]));
  const celda = (v: string | number) => {
    const t = String(v);
    return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const encabezado = [
    "Apellidos", "Nombres",
    ...libreta.unidades.map((u) => UNIDAD_LABEL[u.numero] ?? `Unidad ${u.numero}`),
    "Nota final", "Estado", "% asistencia",
  ];
  const filas = libreta.alumnos.map((a) => {
    const t = totales.get(a.alumnoId);
    const estado = !t?.conNotas ? "Sin notas" : { aprobado: "Aprobado", reprobado: "Reprobado", "en-curso": "En curso" }[estadoAcademico(t)];
    return [
      a.apellidos, a.nombres,
      ...libreta.unidades.map((_, i) => (t?.conNotas ? redondear(t.unidades[i].total) : "")),
      t?.conNotas ? redondear(t.total) : "",
      estado,
      asistencia.get(a.alumnoId) ?? "",
    ];
  });
  const csv = "﻿" + [encabezado, ...filas].map((f) => f.map(celda).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nombreArchivo;
  link.click();
  URL.revokeObjectURL(url);
}

const TABS = ["Estudiantes", "Notas", "Asistencia", "Actividades"];

export default function MisCursos() {
  const { cursos, curso, seleccion, setSeleccion, loading: cargandoCursos, error: errorCursos } = useMisCursos();
  const [tab, setTab] = useState(TABS[0]);
  const [libreta, setLibreta] = useState<LibretaDto | null>(null);
  const [resumen, setResumen] = useState<ResumenAsistenciaDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function recargarLibreta() {
    if (!seleccion) return;
    try {
      setLibreta(await getLibreta(seleccion));
    } catch (err) {
      setError(errorMsg(err, "No se pudo recargar el curso."));
    }
  }

  useEffect(() => {
    if (!seleccion) return;
    let cancelled = false;
    setCargando(true);
    setError("");
    Promise.all([getLibreta(seleccion), getResumenAsistencia(seleccion)])
      .then(([lib, res]) => {
        if (cancelled) return;
        setLibreta(lib);
        setResumen(res);
      })
      .catch((err) => { if (!cancelled) setError(errorMsg(err, "No se pudo cargar la información del curso.")); })
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, [seleccion]);

  const totales = useMemo(() => (libreta ? calcularTotales(libreta) : new Map()), [libreta]);
  const asistenciaPorAlumno = useMemo(
    () => new Map((resumen?.alumnos ?? []).map((a) => [a.alumnoId, a])),
    [resumen],
  );

  if (cargandoCursos) return <Cargando texto="Cargando sus cursos..." />;
  if (errorCursos) return <AlertBanner type="error" message={errorCursos} />;
  if (cursos.length === 0) {
    return <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin cursos asignados" description="Aún no tiene cursos asignados en este ciclo." />;
  }

  const titulo = curso ? `${curso.curso.nombre} — ${curso.seccion.grado.nombre} ${curso.seccion.nombre}` : "Mis Cursos";
  const ciclo = curso?.seccion.anioLectivo;
  const subtitulo = [ciclo && `Ciclo ${ciclo}`, libreta && `${libreta.alumnos.length} alumnos inscritos`].filter(Boolean).join(" · ");

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SectionHeader title={titulo} subtitle={subtitulo || undefined} />
        <div className="flex flex-wrap gap-2 items-center">
          <CursoSelect cursos={cursos} value={seleccion} onChange={setSeleccion} />
          <Btn variant="outline" size="sm" icon={<Download className="w-4 h-4" />}
            disabled={!libreta || cargando || libreta.alumnos.length === 0}
            onClick={() => libreta && exportarCsv(`Notas ${titulo.replace(/[\\/:*?"<>|]/g, "")}.csv`, libreta, totales, resumen)}>
            Exportar notas
          </Btn>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Tabs tabs={TABS} active={tab} onChange={setTab} />

      {cargando || !libreta ? <Cargando /> : (
        <>
          {tab === "Estudiantes" && (
            libreta.alumnos.length === 0 ? (
              <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin alumnos" description="La sección no tiene alumnos inscritos." />
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr><TH>Alumno</TH><TH className="text-center">Nota final (promedio)</TH><TH className="text-center">Asistencia</TH><TH className="text-center">Estado académico</TH></tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {libreta.alumnos.map((a) => {
                        const t = totales.get(a.alumnoId);
                        const asis = asistenciaPorAlumno.get(a.alumnoId);
                        return (
                          <tr key={a.alumnoId} className="hover:bg-stone-50">
                            <TD><span className="font-medium text-stone-900">{a.apellidos}, {a.nombres}</span></TD>
                            <TD className="text-center">
                              {t?.conNotas ? (
                                <span className={`font-mono-data font-semibold ${t.total >= NOTA_APROBACION ? "text-success-700" : "text-stone-700"}`}>{redondear(t.total)}</span>
                              ) : <span className="text-stone-300">—</span>}
                            </TD>
                            <TD className="text-center">
                              {asis ? (
                                <span className={`font-mono-data text-sm ${asis.porcentaje >= 80 ? "text-stone-700" : "text-danger-700 font-semibold"}`}>{asis.porcentaje}%</span>
                              ) : <span className="text-stone-300">—</span>}
                            </TD>
                            <TD className="text-center"><EstadoNota totales={t} /></TD>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {tab === "Notas" && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-50 border-b border-stone-100">
                    <tr>
                      <TH>Alumno</TH>
                      {libreta.unidades.map((u) => (
                        <TH key={u.unidadId} className="text-center">
                          {UNIDAD_LABEL[u.numero] ?? `Unidad ${u.numero}`}
                          <span className="block text-[10px] font-normal normal-case text-stone-400">zona + examen</span>
                        </TH>
                      ))}
                      <TH className="text-center">Nota final</TH>
                      <TH className="text-center">Estado</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50">
                    {libreta.alumnos.map((a) => {
                      const t = totales.get(a.alumnoId);
                      return (
                        <tr key={a.alumnoId} className="hover:bg-stone-50">
                          <TD><span className="font-medium text-stone-900 whitespace-nowrap">{a.apellidos}, {a.nombres}</span></TD>
                          {libreta.unidades.map((u, i) => {
                            const nu = t?.unidades[i];
                            return (
                              <TD key={u.unidadId} className="text-center">
                                {t?.conNotas && nu ? (
                                  <div className="flex flex-col items-center">
                                    <span className={`font-mono-data font-semibold ${nu.total >= NOTA_APROBACION ? "text-success-700" : "text-stone-800"}`}>{redondear(nu.total)}</span>
                                    <span className="text-[10px] text-stone-400 font-mono-data">{redondear(nu.zona)} + {redondear(nu.examen)}</span>
                                  </div>
                                ) : "—"}
                              </TD>
                            );
                          })}
                          <TD className="text-center">
                            {t?.conNotas ? <span className={`font-mono-data font-bold ${t.total >= NOTA_APROBACION ? "text-success-700" : "text-stone-800"}`}>{redondear(t.total)}</span> : "—"}
                          </TD>
                          <TD className="text-center"><EstadoNota totales={t} /></TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {tab === "Asistencia" && (
            !resumen || resumen.diasRegistrados === 0 ? (
              <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin registros de asistencia" description="Aún no se ha pasado lista en este curso." />
            ) : (
              <Card className="overflow-hidden">
                <div className="px-4 py-3 border-b border-stone-100 text-sm text-stone-600">
                  Se ha pasado lista <strong>{resumen.diasRegistrados}</strong> {resumen.diasRegistrados === 1 ? "día" : "días"}.
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-stone-50 border-b border-stone-100">
                      <tr>
                        <TH>Alumno</TH><TH className="text-center">Presentes</TH><TH className="text-center">Tardes</TH>
                        <TH className="text-center">Ausentes</TH><TH className="text-center">Justificados</TH><TH className="text-center">% asistencia</TH>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {resumen.alumnos.map((a) => (
                        <tr key={a.alumnoId} className="hover:bg-stone-50">
                          <TD><span className="font-medium text-stone-900">{a.apellidos}, {a.nombres}</span></TD>
                          <TD className="text-center font-mono-data">{a.presentes}</TD>
                          <TD className="text-center font-mono-data">{a.tardes}</TD>
                          <TD className="text-center font-mono-data">{a.ausentes}</TD>
                          <TD className="text-center font-mono-data">{a.justificados}</TD>
                          <TD className="text-center">
                            <Badge variant={a.porcentaje >= 80 ? "success" : "danger"}>{a.porcentaje}%</Badge>
                          </TD>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          )}

          {tab === "Actividades" && <ActividadesPanel libreta={libreta} onCambio={recargarLibreta} />}
        </>
      )}
    </div>
  );
}

function ActividadesPanel({ libreta, onCambio }: { libreta: LibretaDto; onCambio: () => Promise<void> }) {
  const [edicion, setEdicion] = useState<ActividadEnEdicion | null>(null);
  const [aEliminar, setAEliminar] = useState<ActividadDto | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");

  const notasPorActividad = (actividadId: number) => libreta.notas.filter((n) => n.actividadId === actividadId).length;

  async function handleEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    setError("");
    try {
      await deleteActividad(aEliminar.actividadId);
      setAEliminar(null);
      await onCambio();
    } catch (err) {
      setError(errorMsg(err, "No se pudo eliminar la actividad."));
    } finally {
      setEliminando(false);
    }
  }

  function grupo(unidadId: number, actividades: ActividadDto[], tipo: TipoActividad) {
    const lista = actividadesPorTipo(actividades, tipo);
    const asignado = sumaPuntos(lista);
    const maximo = PUNTEO_POR_TIPO[tipo];
    return (
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-stone-500">
            {TIPO_LABEL[tipo]} · <span className={asignado > maximo ? "text-danger-700" : asignado === maximo ? "text-success-700" : ""}>{asignado} de {maximo} pts</span>
          </p>
          <Btn variant="ghost" size="sm" icon={<Plus className="w-4 h-4" />} disabled={asignado >= maximo}
            onClick={() => setEdicion({ unidadId, tipo })}>
            {tipo === "Zona" ? "Tarea / actividad" : "Examen"}
          </Btn>
        </div>
        {lista.length === 0 ? (
          <p className="text-sm text-stone-400 pb-2">Sin {tipo === "Zona" ? "actividades de zona" : "examen"}.</p>
        ) : (
          <div className="space-y-2">
            {lista.map((a) => (
              <div key={a.actividadId} className="flex items-center justify-between gap-3 p-3 bg-stone-50 border border-stone-100 rounded-xl">
                <div className="min-w-0">
                  <p className="font-medium text-stone-900 text-sm truncate">{a.nombre}</p>
                  <p className="text-xs text-stone-500">
                    {formatFechaCorta(a.fecha)} · {notasPorActividad(a.actividadId)}/{libreta.alumnos.length} calificados
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={tipo === "Examen" ? "info" : "neutral"}>{a.puntosMaximos} pts</Badge>
                  <button onClick={() => setEdicion({ unidadId, actividad: a })} className="p-1.5 text-stone-400 hover:text-primary-700 cursor-pointer" aria-label={`Editar ${a.nombre}`}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => { setError(""); setAEliminar(a); }} className="p-1.5 text-stone-400 hover:text-danger-700 cursor-pointer" aria-label={`Eliminar ${a.nombre}`}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AlertBanner
        type="info"
        message={`Cada unidad vale 100 puntos: zona ${PUNTEO_POR_TIPO.Zona} (tareas, proyectos, laboratorios...) y examen ${PUNTEO_POR_TIPO.Examen}. La nota final es el promedio de las unidades.`}
      />
      {error && !aEliminar && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      {libreta.unidades.map((u) => (
        <Card key={u.unidadId} className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-stone-800 text-base">{UNIDAD_LABEL[u.numero] ?? `Unidad ${u.numero}`}</h3>
            <Badge variant={sumaPuntos(u.actividades) === 100 ? "success" : "neutral"}>{sumaPuntos(u.actividades)} / 100 pts</Badge>
          </div>
          <div className="space-y-4">
            {grupo(u.unidadId, u.actividades, "Zona")}
            {grupo(u.unidadId, u.actividades, "Examen")}
          </div>
        </Card>
      ))}

      <ActividadModal libreta={libreta} edicion={edicion} onClose={() => setEdicion(null)} onGuardado={onCambio} />

      <Modal
        open={!!aEliminar}
        onClose={() => setAEliminar(null)}
        title="Eliminar actividad"
        footer={
          <>
            <Btn variant="ghost" onClick={() => setAEliminar(null)}>Cancelar</Btn>
            <Btn variant="destructive" loading={eliminando} onClick={handleEliminar}>Eliminar</Btn>
          </>
        }
      >
        {aEliminar && (
          <div className="space-y-3">
            {error && <AlertBanner type="error" message={error} />}
            <p className="text-sm text-stone-600">
              ¿Eliminar <strong>{aEliminar.nombre}</strong>?
              {notasPorActividad(aEliminar.actividadId) > 0 && (
                <> También se borrarán las <strong>{notasPorActividad(aEliminar.actividadId)}</strong> notas registradas en ella.</>
              )}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

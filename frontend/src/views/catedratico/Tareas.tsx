import { useEffect, useMemo, useState } from "react";
import { BookText, Edit, Inbox, Plus, Tablero } from "../../components/Iconos";
import { AlertBanner, Badge, Btn, Card, Drawer, EmptyState, Input, SectionHeader, Tabs, Textarea } from "../../components/Ui";
import { ArchivosPorSubir, ElegirArchivos, EstadoTareaBadge, ListaArchivos, formatFechaHora } from "../../components/Tareas";
import {
  agregarMaterialTarea, calificarEntrega, devolverEntrega, getEntregasTarea, getLibreta, marcarEntregaEnClase, quitarMaterialTarea,
  subirArchivosTarea, type ActividadDto, type EntregasTareaDto, type EstadoTarea, type LibretaDto,
} from "../../lib/api";
import ActividadModal, { type ActividadEnEdicion } from "./ActividadModal";
import { Cargando, CursoSelect, PUNTEO_POR_TIPO, UNIDAD_LABEL, actividadesPorTipo, errorMsg, formatLimite, iniciales, sumaPuntos, useMisCursos } from "./shared";

type AlumnoBandeja = EntregasTareaDto["alumnos"][number];

const plural = (n: number, palabra: string) => `${n} ${palabra}${n === 1 ? "" : "s"}`;

const FILTROS: { label: string; incluye: (e: EstadoTarea) => boolean }[] = [
  { label: "Por revisar", incluye: (e) => e === "Entregada" },
  { label: "Todas", incluye: () => true },
  { label: "Sin entregar", incluye: (e) => e === "Pendiente" || e === "Atrasada" },
  { label: "Devueltas", incluye: (e) => e === "Devuelta" },
  { label: "Calificadas", incluye: (e) => e === "Calificada" },
];

export default function Tareas() {
  const { cursos, seleccion, setSeleccion, loading: cargandoCursos, error: errorCursos } = useMisCursos();
  const [libreta, setLibreta] = useState<LibretaDto | null>(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [unidad, setUnidad] = useState(UNIDAD_LABEL[1]);
  const [tareaId, setTareaId] = useState<number | null>(null);
  const [edicion, setEdicion] = useState<ActividadEnEdicion | null>(null);

  async function cargar(cursoSeccionId: number) {
    setCargando(true);
    setError("");
    try {
      setLibreta(await getLibreta(cursoSeccionId));
    } catch (err) {
      setError(errorMsg(err, "No se pudieron cargar las tareas."));
      setLibreta(null);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    setTareaId(null);
    if (seleccion) cargar(seleccion);
  }, [seleccion]);

  const unidadActual = libreta?.unidades.find((u) => UNIDAD_LABEL[u.numero] === unidad);
  const tareas = useMemo(() => (unidadActual?.actividades ?? []).filter((a) => a.aceptaEntregas), [unidadActual]);
  const sinEntregas = (unidadActual?.actividades ?? []).filter((a) => !a.aceptaEntregas && a.tipo === "Zona");
  const tarea = tareas.find((t) => t.actividadId === tareaId) ?? null;
  const zonaLlena = unidadActual ? sumaPuntos(actividadesPorTipo(unidadActual.actividades, "Zona")) >= PUNTEO_POR_TIPO.Zona : true;

  if (cargandoCursos) return <Cargando texto="Cargando sus cursos..." />;
  if (errorCursos) return <AlertBanner type="error" message={errorCursos} />;
  if (cursos.length === 0) {
    return <EmptyState icon={<BookText className="w-10 h-10" />} title="Sin cursos asignados" description="Aún no tiene cursos asignados en este ciclo." />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SectionHeader title="Tareas y entregas" subtitle="Publique tareas en línea, revise lo que entregan y califique: la nota pasa sola a la libreta." />
        <div className="flex flex-wrap gap-2 items-center">
          <CursoSelect cursos={cursos} value={seleccion} onChange={setSeleccion} />
          <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} disabled={!unidadActual || zonaLlena}
            title={zonaLlena ? "La zona de esta unidad ya tiene sus 60 puntos asignados" : undefined}
            onClick={() => unidadActual && setEdicion({ unidadId: unidadActual.unidadId, tipo: "Zona", enLinea: true })}>
            Nueva tarea en línea
          </Btn>
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Tabs tabs={Object.values(UNIDAD_LABEL)} active={unidad} onChange={(u) => { setUnidad(u); setTareaId(null); }} />

      {/* Con la zona llena no cabe una actividad nueva: se puede convertir una que ya existe */}
      {unidadActual && sinEntregas.length > 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-sm text-stone-700">
            {zonaLlena
              ? <><span className="font-semibold">La zona de esta unidad ya tiene sus {PUNTEO_POR_TIPO.Zona} puntos asignados</span>, así que no cabe una tarea nueva. Puede recibir entregas en línea en una actividad que ya existe:</>
              : "También puede recibir entregas en línea en una actividad que ya existe:"}
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            {sinEntregas.map((a) => (
              <Btn key={a.actividadId} variant="outline" size="sm" icon={<Plus className="w-4 h-4" />}
                onClick={() => setEdicion({ unidadId: unidadActual.unidadId, actividad: a, enLinea: true })}>
                {a.nombre} ({a.puntosMaximos} pts)
              </Btn>
            ))}
          </div>
        </Card>
      )}

      {cargando || !libreta ? <Cargando /> : tareas.length === 0 ? (
        <EmptyState
          icon={<Tablero className="w-10 h-10" />}
          title="Sin tareas en línea en esta unidad"
          description="Cree una tarea en línea, o edite una actividad de la libreta y marque &quot;Recibir entregas en línea&quot;."
        />
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] gap-5 items-start">
          <ul className="flex flex-col gap-2.5" aria-label="Tareas de la unidad">
            {tareas.map((t) => (
              <li key={t.actividadId}>
                <TarjetaTarea tarea={t} activa={t.actividadId === tareaId} onClick={() => setTareaId(t.actividadId)} />
              </li>
            ))}
          </ul>
          {tarea ? (
            <BandejaTarea
              key={tarea.actividadId}
              actividadId={tarea.actividadId}
              onEditar={() => unidadActual && setEdicion({ unidadId: unidadActual.unidadId, actividad: tarea })}
              onCambio={() => libreta && getLibreta(libreta.cursoSeccionId).then(setLibreta).catch(() => undefined)}
            />
          ) : (
            <Card className="p-8 hidden lg:block">
              <EmptyState icon={<Inbox className="w-10 h-10" />} title="Elija una tarea" description="Vea quién entregó, abra los archivos y califique." />
            </Card>
          )}
        </div>
      )}

      <ActividadModal
        libreta={libreta ?? { cursoSeccionId: 0, curso: "", grado: "", seccion: "", unidades: [], alumnos: [], notas: [] }}
        edicion={libreta ? edicion : null}
        onClose={() => setEdicion(null)}
        onGuardado={async () => { if (libreta) setLibreta(await getLibreta(libreta.cursoSeccionId)); }}
      />
    </div>
  );
}

function TarjetaTarea({ tarea, activa, onClick }: { tarea: ActividadDto; activa: boolean; onClick: () => void }) {
  const vencida = !!tarea.fechaLimite && new Date(tarea.fechaLimite) < new Date();
  return (
    <button type="button" onClick={onClick} aria-pressed={activa}
      className={`w-full text-left rounded-[20px] border-[1.5px] p-4 transition-colors cursor-pointer
        ${activa ? "border-primary-600 bg-primary-50/60" : "border-stone-200 bg-white hover:border-stone-400"}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="font-display font-bold text-stone-900 leading-tight">{tarea.nombre}</span>
        {tarea.porRevisar > 0 && <Badge variant="warning">{tarea.porRevisar} por revisar</Badge>}
      </div>
      <p className={`text-[13px] mt-1.5 ${vencida ? "text-stone-500" : "text-stone-700 font-semibold"}`}>
        {tarea.fechaLimite ? `${vencida ? "Cerró" : "Vence"}: ${formatLimite(tarea.fechaLimite)}` : "Sin fecha límite"}
      </p>
      <p className="text-xs text-stone-400 mt-0.5">{tarea.puntosMaximos} pts</p>
    </button>
  );
}

function BandejaTarea({ actividadId, onEditar, onCambio }: { actividadId: number; onEditar: () => void; onCambio: () => void }) {
  const [datos, setDatos] = useState<EntregasTareaDto | null>(null);
  const [error, setError] = useState("");
  const [filtro, setFiltro] = useState(FILTROS[0].label);
  const [revisando, setRevisando] = useState<number | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  async function cargar() {
    try {
      setDatos(await getEntregasTarea(actividadId));
    } catch (err) {
      setError(errorMsg(err, "No se pudieron cargar las entregas."));
    }
  }

  useEffect(() => { cargar(); }, [actividadId]);

  // Tras calificar o devolver se recarga la bandeja y el contador de la lista
  async function trasCambio() {
    await cargar();
    onCambio();
  }

  async function subirMaterial(archivos: File[]) {
    setSubiendo(true);
    setError("");
    try {
      const subidas = await subirArchivosTarea(actividadId, archivos);
      const material = await agregarMaterialTarea(actividadId, subidas);
      setDatos((d) => (d ? { ...d, material } : d));
    } catch (err) {
      setError(errorMsg(err, "No se pudo subir el material."));
    } finally {
      setSubiendo(false);
    }
  }

  async function quitarMaterial(archivoId: number) {
    if (!window.confirm("¿Quitar este archivo de la tarea?")) return;
    try {
      await quitarMaterialTarea(archivoId);
      setDatos((d) => (d ? { ...d, material: d.material.filter((m) => m.archivoId !== archivoId) } : d));
    } catch (err) {
      setError(errorMsg(err, "No se pudo quitar el archivo."));
    }
  }

  if (!datos) return error ? <AlertBanner type="error" message={error} /> : <Cargando />;

  const { tarea, alumnos } = datos;
  const cuenta = (f: (e: EstadoTarea) => boolean) => alumnos.filter((a) => f(a.estado)).length;
  const entregaron = alumnos.filter((a) => a.entrega).length;
  const filtroActual = FILTROS.find((f) => f.label === filtro) ?? FILTROS[0];
  const visibles = alumnos.filter((a) => filtroActual.incluye(a.estado));
  const alumno = alumnos.find((a) => a.alumnoId === revisando) ?? null;

  return (
    <div className="space-y-4 min-w-0">
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Card className="p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-2xl font-bold text-stone-900 leading-tight">{tarea.nombre}</h3>
            <p className="text-sm text-stone-500 mt-1">
              {UNIDAD_LABEL[tarea.unidad]} · {tarea.puntosMaximos} pts
              {tarea.fechaLimite && <> · Límite: <span className="font-semibold text-stone-700">{formatLimite(tarea.fechaLimite)}</span></>}
              {!tarea.permiteAtrasadas && " · No acepta atrasadas"}
            </p>
          </div>
          <Btn variant="outline" size="sm" icon={<Edit className="w-4 h-4" />} onClick={onEditar}>Editar</Btn>
        </div>
        {tarea.instrucciones && <p className="text-[15px] text-stone-700 whitespace-pre-line leading-relaxed">{tarea.instrucciones}</p>}
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-stone-500">Material de apoyo</p>
          <ListaArchivos archivos={datos.material} onQuitar={(a) => quitarMaterial(a.archivoId)} onError={setError} />
          <ElegirArchivos onElegir={subirMaterial} disabled={subiendo} texto={subiendo ? "Subiendo..." : "Agregar material"} />
        </div>
      </Card>

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="primary">{entregaron} de {alumnos.length} entregaron</Badge>
        <Badge variant="warning">{cuenta((e) => e === "Entregada")} por revisar</Badge>
        <Badge variant="success">{plural(cuenta((e) => e === "Calificada"), "calificada")}</Badge>
        <Badge variant="info">{plural(cuenta((e) => e === "Devuelta"), "devuelta")}</Badge>
        <Badge variant="danger">{cuenta((e) => e === "Atrasada" || e === "Pendiente")} sin entregar</Badge>
      </div>

      <Tabs tabs={FILTROS.map((f) => f.label)} active={filtro} onChange={setFiltro} />

      {visibles.length === 0 ? (
        <p className="text-sm text-stone-400 py-6 text-center">No hay alumnos en este filtro.</p>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-stone-100">
            {visibles.map((a) => (
              <li key={a.alumnoId}>
                <button type="button" onClick={() => setRevisando(a.alumnoId)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-sand-50 transition-colors cursor-pointer">
                  <span className="w-9 h-9 rounded-full bg-sand-100 text-stone-700 flex items-center justify-center text-xs font-bold shrink-0">{iniciales(a.nombres, a.apellidos)}</span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-semibold text-stone-900 truncate">{a.apellidos}, {a.nombres}</span>
                    <span className="block text-xs text-stone-500 mt-0.5">
                      {a.entrega
                        ? a.entrega.enClase ? "Entregada en clase" : `${formatFechaHora(a.entrega.fechaEntrega)} · ${a.entrega.archivos.length} archivo${a.entrega.archivos.length === 1 ? "" : "s"}`
                        : a.entregaPorEncargado ? "La entrega su encargado" : "Aún no entrega"}
                    </span>
                  </span>
                  <span className="hidden sm:block"><EstadoTareaBadge estado={a.estado} tarde={a.entrega?.tarde} vista="catedratico" /></span>
                  <span className="w-14 text-right font-display font-bold tabular-nums text-stone-900 shrink-0">
                    {a.nota ?? <span className="text-stone-300">—</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <RevisionEntrega
        alumno={alumno}
        actividadId={actividadId}
        puntosMaximos={tarea.puntosMaximos}
        onClose={() => setRevisando(null)}
        onCambio={trasCambio}
      />
    </div>
  );
}

function RevisionEntrega({ alumno, actividadId, puntosMaximos, onClose, onCambio }: {
  alumno: AlumnoBandeja | null;
  actividadId: number;
  puntosMaximos: number;
  onClose: () => void;
  onCambio: () => Promise<void>;
}) {
  const [nota, setNota] = useState("");
  const [retro, setRetro] = useState("");
  const [guardando, setGuardando] = useState<"calificar" | "devolver" | "clase" | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setNota(alumno?.nota === null || alumno?.nota === undefined ? "" : String(alumno.nota));
    setRetro(alumno?.entrega?.retroalimentacion ?? "");
    setError("");
  }, [alumno?.alumnoId, alumno?.entrega?.entregaId, alumno?.nota]);

  const entrega = alumno?.entrega ?? null;
  const valor = Number(nota);
  const notaValida = nota.trim() !== "" && !isNaN(valor) && valor >= 0 && valor <= puntosMaximos;

  async function ejecutar(accion: "calificar" | "devolver" | "clase", fn: () => Promise<unknown>, cerrar = true) {
    setGuardando(accion);
    setError("");
    try {
      await fn();
      await onCambio();
      if (cerrar) onClose();
    } catch (err) {
      setError(errorMsg(err, "No se pudo guardar."));
    } finally {
      setGuardando(null);
    }
  }

  return (
    <Drawer
      open={!!alumno}
      onClose={onClose}
      title={alumno ? `${alumno.nombres} ${alumno.apellidos}` : ""}
      footer={entrega ? (
        <>
          {!entrega.enClase && (
            <Btn variant="outline" loading={guardando === "devolver"} disabled={!retro.trim() || !!guardando}
              title={!retro.trim() ? "Escriba qué debe corregir" : undefined}
              onClick={() => alumno && ejecutar("devolver", () => devolverEntrega(actividadId, alumno.alumnoId, retro.trim()))}>
              Devolver
            </Btn>
          )}
          <Btn variant="primary" loading={guardando === "calificar"} disabled={!notaValida || !!guardando}
            onClick={() => alumno && ejecutar("calificar", () => calificarEntrega(actividadId, alumno.alumnoId, valor, retro.trim()))}>
            {alumno?.estado === "Calificada" ? "Actualizar nota" : "Calificar"}
          </Btn>
        </>
      ) : undefined}
    >
      {alumno && (
        <div className="space-y-5">
          {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
          <EstadoTareaBadge estado={alumno.estado} tarde={entrega?.tarde} vista="catedratico" />

          {!entrega ? (
            <div className="space-y-3">
              <p className="text-sm text-stone-600">
                {alumno.entregaPorEncargado ? "Este alumno no tiene acceso al portal: la entrega en línea la hace su encargado." : "El alumno aún no ha entregado."}
              </p>
              <p className="text-sm text-stone-600">Si la entregó en físico (cuaderno, maqueta, hoja), márquela para poder calificarla aquí.</p>
              <Btn variant="outline" loading={guardando === "clase"} onClick={() => ejecutar("clase", () => marcarEntregaEnClase(actividadId, alumno.alumnoId, true), false)}>
                Entregó en clase
              </Btn>
            </div>
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-[13px] text-stone-500">{entrega.enClase ? "Marcada" : "Entregada"}</dt>
                  <dd className="font-semibold text-stone-900">{entrega.enClase ? "En clase" : formatFechaHora(entrega.fechaEntrega)}</dd>
                </div>
                {entrega.entregadoPor && (
                  <div>
                    <dt className="text-[13px] text-stone-500">Entregó</dt>
                    <dd className="font-semibold text-stone-900">{entrega.entregadoPor}</dd>
                  </div>
                )}
              </dl>

              {entrega.comentario && (
                <div>
                  <p className="text-[13px] font-semibold text-stone-500 mb-1">Comentario</p>
                  <p className="text-[15px] text-stone-800 whitespace-pre-line bg-sand-50 rounded-2xl px-4 py-3">{entrega.comentario}</p>
                </div>
              )}
              {!entrega.enClase && (
                <div>
                  <p className="text-[13px] font-semibold text-stone-500 mb-2">Archivos</p>
                  <ListaArchivos archivos={entrega.archivos} onError={setError} vacio="Sin archivos." />
                </div>
              )}

              <div className="space-y-3 pt-2 border-t border-stone-100">
                <Input label={`Nota (0 a ${puntosMaximos})`} type="number" min="0" max={puntosMaximos} step="0.5"
                  value={nota} onChange={(e) => setNota(e.target.value)}
                  error={nota.trim() !== "" && !notaValida ? `Debe estar entre 0 y ${puntosMaximos}` : undefined} />
                <Textarea label="Retroalimentación" rows={4} maxLength={2000} value={retro} onChange={(e) => setRetro(e.target.value)}
                  placeholder="Comentarios para el alumno. Si la devuelve, indique qué debe corregir." />
                {entrega.enClase && alumno.estado !== "Calificada" && (
                  <button type="button" disabled={!!guardando}
                    onClick={() => ejecutar("clase", () => marcarEntregaEnClase(actividadId, alumno.alumnoId, false), false)}
                    className="text-sm font-semibold text-stone-500 hover:text-danger-700 cursor-pointer">
                    Quitar la marca de "entregó en clase"
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </Drawer>
  );
}

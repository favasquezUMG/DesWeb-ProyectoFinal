/**
 * Tablero de tareas en línea de un alumno, tipo kanban: por hacer, atrasadas, entregadas y calificadas.
 * Lo usan el alumno (sus tareas) y el encargado (las de cada hijo). Quién puede entregar lo decide
 * el backend: el alumno si tiene portal; si no, su encargado.
 */
import { useEffect, useMemo, useState } from "react";
import {
  getTableroTareas, getTareaAlumno, guardarEntrega, subirArchivosTarea,
  type ArchivoTareaDto, type EstadoTarea, type TableroTareasDto, type TareaAlumnoDto,
} from "../lib/api";
import { AlertBanner, Btn, Card, CursoMarca, Drawer, EmptyState, Tabs, Textarea } from "./Ui";
import { ArchivosPorSubir, ElegirArchivos, EstadoTareaBadge, ListaArchivos, formatFechaHora } from "./Tareas";
import { CheckCircle2, Tablero } from "./Iconos";

type TareaTablero = TableroTareasDto["tareas"][number];

const COLUMNAS: { id: string; titulo: string; estados: EstadoTarea[]; vacio: string; acento: string }[] = [
  { id: "hacer", titulo: "Por hacer", estados: ["Pendiente", "Devuelta"], vacio: "Nada pendiente.", acento: "bg-primary-600" },
  { id: "atrasadas", titulo: "Atrasadas", estados: ["Atrasada"], vacio: "Ninguna atrasada.", acento: "bg-danger-600" },
  { id: "entregadas", titulo: "Entregadas", estados: ["Entregada"], vacio: "Aún no hay entregas en revisión.", acento: "bg-warning-500" },
  { id: "calificadas", titulo: "Calificadas", estados: ["Calificada"], vacio: "Aún no hay tareas calificadas.", acento: "bg-success-600" },
];

const errorDe = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

const UNIDADES = ["", "I", "II", "III", "IV"];

/** "Vence hoy a las 23:59", "Vence en 3 días", "Venció hace 2 días" */
export function textoLimite(iso: string | null): { texto: string; urgente: boolean } {
  if (!iso) return { texto: "Sin fecha límite", urgente: false };
  const limite = new Date(iso);
  const ahora = new Date();
  const hora = limite.toLocaleTimeString("es-GT", { hour: "2-digit", minute: "2-digit" });
  const dias = Math.round((new Date(limite).setHours(0, 0, 0, 0) - new Date(ahora).setHours(0, 0, 0, 0)) / 86_400_000);
  if (limite < ahora) {
    return { texto: dias === 0 ? `Venció hoy a las ${hora}` : `Venció hace ${-dias} día${dias === -1 ? "" : "s"}`, urgente: false };
  }
  if (dias === 0) return { texto: `Vence hoy a las ${hora}`, urgente: true };
  if (dias === 1) return { texto: `Vence mañana a las ${hora}`, urgente: true };
  if (dias < 7) return { texto: `Vence el ${limite.toLocaleDateString("es-GT", { weekday: "long" })} a las ${hora}`, urgente: false };
  return { texto: `Vence el ${limite.toLocaleDateString("es-GT", { day: "numeric", month: "short" })}`, urgente: false };
}

export default function TableroTareas({ alumnoId }: { alumnoId: number }) {
  const [tablero, setTablero] = useState<TableroTareasDto | null>(null);
  const [error, setError] = useState("");
  const [curso, setCurso] = useState("");
  const [columnaMovil, setColumnaMovil] = useState(COLUMNAS[0].id);
  const [abierta, setAbierta] = useState<TareaTablero | null>(null);

  async function cargar() {
    try {
      setTablero(await getTableroTareas(alumnoId));
      setError("");
    } catch (e) {
      setError(errorDe(e, "No se pudieron cargar las tareas."));
    }
  }

  useEffect(() => {
    setTablero(null);
    setCurso("");
    setAbierta(null);
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alumnoId]);

  const cursos = useMemo(() => [...new Set((tablero?.tareas ?? []).map((t) => t.curso))].sort(), [tablero]);
  const visibles = (tablero?.tareas ?? []).filter((t) => !curso || t.curso === curso);

  if (error && !tablero) return <AlertBanner type="error" message={error} />;
  if (!tablero) {
    return (
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUMNAS.map((c) => <div key={c.id} className="h-48 rounded-[20px] bg-white border border-stone-200/80 animate-pulse" />)}
      </div>
    );
  }
  if (tablero.tareas.length === 0) {
    return <EmptyState icon={<Tablero className="w-10 h-10" />} title="Sin tareas en línea" description="Cuando los catedráticos publiquen tareas para entregar en línea aparecerán aquí." />;
  }

  // En celular cada pestaña lleva cuántas tareas tiene su columna
  const pestanas = COLUMNAS.map((c) => `${c.titulo} (${visibles.filter((t) => c.estados.includes(t.estado)).length})`);

  const columna = (c: (typeof COLUMNAS)[number]) => {
    const tareas = visibles.filter((t) => c.estados.includes(t.estado));
    return (
      <section key={c.id} aria-label={c.titulo} className="rounded-[22px] bg-sand-50 border border-stone-200/70 p-3 flex flex-col gap-2.5 min-w-0">
        <h3 className="flex items-center gap-2 px-1 pt-1 font-display font-bold text-stone-900">
          <span className={`w-2.5 h-2.5 rounded-full ${c.acento}`} aria-hidden="true" />
          {c.titulo}
          <span className="ml-auto text-sm font-semibold text-stone-400 tabular-nums">{tareas.length}</span>
        </h3>
        {tareas.length === 0 ? <p className="text-sm text-stone-400 px-1 pb-2">{c.vacio}</p> : tareas.map((t) => (
          <TarjetaTarea key={t.actividadId} tarea={t} onClick={() => setAbierta(t)} />
        ))}
      </section>
    );
  };

  return (
    <div className="space-y-4">
      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {cursos.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por curso">
          {["", ...cursos].map((c) => (
            <button key={c || "todos"} type="button" onClick={() => setCurso(c)} aria-pressed={curso === c}
              className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer
                ${curso === c ? "bg-primary-800 text-white" : "bg-white border-[1.5px] border-stone-200 text-stone-600 hover:text-stone-900"}`}>
              {c || "Todos los cursos"}
            </button>
          ))}
        </div>
      )}

      {/* En celular una columna a la vez; en pantallas grandes el tablero completo */}
      <div className="lg:hidden space-y-3">
        <Tabs tabs={pestanas} active={pestanas[COLUMNAS.findIndex((c) => c.id === columnaMovil)]}
          onChange={(t) => setColumnaMovil(COLUMNAS[pestanas.indexOf(t)].id)} />
        {columna(COLUMNAS.find((c) => c.id === columnaMovil) ?? COLUMNAS[0])}
      </div>
      <div className="hidden lg:grid grid-cols-4 gap-4 items-start">{COLUMNAS.map(columna)}</div>

      <DetalleTarea
        alumnoId={alumnoId}
        resumen={abierta}
        onClose={() => setAbierta(null)}
        onEntregada={cargar}
      />
    </div>
  );
}

function TarjetaTarea({ tarea, onClick }: { tarea: TareaTablero; onClick: () => void }) {
  const limite = textoLimite(tarea.fechaLimite);
  const pendiente = tarea.estado === "Pendiente" || tarea.estado === "Devuelta" || tarea.estado === "Atrasada";
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-[18px] bg-white border border-stone-200 hover:border-stone-400 p-3.5 transition-colors cursor-pointer">
      <div className="flex items-start gap-2.5">
        <CursoMarca nombre={tarea.curso} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-stone-500 truncate">{tarea.curso} · Unidad {UNIDADES[tarea.unidad] ?? tarea.unidad}</p>
          <p className="font-display font-bold text-stone-900 leading-snug mt-0.5">{tarea.nombre}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
        {tarea.estado === "Calificada" ? (
          <span className="font-display font-bold text-lg tabular-nums text-stone-900">{tarea.nota}<span className="text-sm text-stone-400"> / {tarea.puntosMaximos}</span></span>
        ) : (
          <span className={`text-[13px] ${pendiente && limite.urgente ? "text-danger-700 font-bold" : "text-stone-500"}`}>
            {pendiente ? limite.texto : tarea.fechaEntrega ? `Entregada ${formatFechaHora(tarea.fechaEntrega)}` : ""}
          </span>
        )}
        {(tarea.estado === "Devuelta" || tarea.tarde) && <EstadoTareaBadge estado={tarea.estado === "Devuelta" ? "Devuelta" : tarea.estado} tarde={tarea.tarde} />}
      </div>
    </button>
  );
}

function DetalleTarea({ alumnoId, resumen, onClose, onEntregada }: {
  alumnoId: number;
  resumen: TareaTablero | null;
  onClose: () => void;
  onEntregada: () => Promise<void>;
}) {
  const [detalle, setDetalle] = useState<TareaAlumnoDto | null>(null);
  const [error, setError] = useState("");
  const [comentario, setComentario] = useState("");
  const [nuevos, setNuevos] = useState<File[]>([]);
  const [quitar, setQuitar] = useState<number[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState("");

  async function cargar(actividadId: number) {
    try {
      const d = await getTareaAlumno(alumnoId, actividadId);
      setDetalle(d);
      setComentario(d.entrega?.comentario ?? "");
    } catch (e) {
      setError(errorDe(e, "No se pudo abrir la tarea."));
    }
  }

  useEffect(() => {
    setDetalle(null);
    setError("");
    setExito("");
    setNuevos([]);
    setQuitar([]);
    if (resumen) cargar(resumen.actividadId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumen?.actividadId, alumnoId]);

  const archivosActuales: ArchivoTareaDto[] = (detalle?.entrega?.archivos ?? []).filter((a) => !quitar.includes(a.archivoId));
  const hayCambios = nuevos.length > 0 || quitar.length > 0 || comentario.trim() !== (detalle?.entrega?.comentario ?? "");
  const vacia = archivosActuales.length + nuevos.length === 0 && !comentario.trim();

  async function entregar() {
    if (!detalle) return;
    setEnviando(true);
    setError("");
    try {
      const subidas = await subirArchivosTarea(detalle.tarea.actividadId, nuevos, alumnoId);
      await guardarEntrega(detalle.tarea.actividadId, alumnoId, { comentario: comentario.trim(), archivos: subidas, quitar });
      setNuevos([]);
      setQuitar([]);
      setExito(detalle.entrega ? "Entrega actualizada." : "¡Tarea entregada!");
      await Promise.all([cargar(detalle.tarea.actividadId), onEntregada()]);
    } catch (e) {
      setError(errorDe(e, "No se pudo entregar la tarea."));
    } finally {
      setEnviando(false);
    }
  }

  const entrega = detalle?.entrega ?? null;
  const limite = detalle ? textoLimite(detalle.tarea.fechaLimite) : null;

  return (
    <Drawer
      open={!!resumen}
      onClose={onClose}
      title={resumen?.nombre ?? ""}
      footer={detalle?.puedeEntregar ? (
        <Btn variant="primary" loading={enviando} disabled={!hayCambios || vacia}
          title={vacia ? "Adjunte un archivo o escriba un comentario" : undefined} onClick={entregar}>
          {entrega ? "Guardar cambios" : "Entregar tarea"}
        </Btn>
      ) : undefined}
    >
      {!detalle ? (
        error ? <AlertBanner type="error" message={error} /> : <p className="text-sm text-stone-500 py-6">Cargando...</p>
      ) : (
        <div className="space-y-5">
          {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
          {exito && (
            <div className="flex items-center gap-2 rounded-2xl bg-success-50 text-success-800 px-4 py-3 text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5" />{exito}
            </div>
          )}

          <div className="flex items-start gap-3">
            <CursoMarca nombre={detalle.tarea.curso} />
            <div className="min-w-0">
              <p className="font-semibold text-stone-900">{detalle.tarea.curso}</p>
              <p className="text-[13px] text-stone-500">
                {resumen?.catedratico} · Unidad {UNIDADES[detalle.tarea.unidad]} · {detalle.tarea.puntosMaximos} pts
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <EstadoTareaBadge estado={detalle.estado} tarde={entrega?.tarde} />
            {limite && <span className={`text-[13px] ${limite.urgente && !entrega ? "text-danger-700 font-bold" : "text-stone-500"}`}>{limite.texto}</span>}
          </div>

          {detalle.estado === "Calificada" && detalle.nota !== null && (
            <div className="rounded-[20px] bg-success-50 px-5 py-4">
              <p className="text-[13px] font-semibold text-success-800">Nota</p>
              <p className="font-display font-bold text-4xl tabular-nums text-success-800">{detalle.nota}<span className="text-lg text-success-700"> / {detalle.tarea.puntosMaximos}</span></p>
            </div>
          )}
          {entrega?.retroalimentacion && (
            <div className={`rounded-[20px] px-5 py-4 ${detalle.estado === "Devuelta" ? "bg-info-50" : "bg-sand-50"}`}>
              <p className="text-[13px] font-semibold text-stone-600">
                {detalle.estado === "Devuelta" ? "El catedrático pide corregir:" : "Comentario del catedrático"}
              </p>
              <p className="text-[15px] text-stone-800 whitespace-pre-line mt-1">{entrega.retroalimentacion}</p>
            </div>
          )}

          {detalle.tarea.instrucciones && (
            <div>
              <p className="text-[13px] font-semibold text-stone-500 mb-1">Instrucciones</p>
              <p className="text-[15px] text-stone-800 whitespace-pre-line leading-relaxed">{detalle.tarea.instrucciones}</p>
            </div>
          )}
          {detalle.material.length > 0 && (
            <div>
              <p className="text-[13px] font-semibold text-stone-500 mb-2">Material de apoyo</p>
              <ListaArchivos archivos={detalle.material} onError={setError} />
            </div>
          )}

          <Card className="p-4 space-y-3">
            <p className="font-display font-bold text-stone-900">Entrega</p>
            {entrega?.enClase ? (
              <p className="text-sm text-stone-600">Se entregó en clase.</p>
            ) : (
              <>
                {entrega && (
                  <p className="text-[13px] text-stone-500">
                    Entregada {formatFechaHora(entrega.fechaEntrega)}{entrega.entregadoPor ? ` por ${entrega.entregadoPor}` : ""}
                  </p>
                )}
                <ListaArchivos
                  archivos={archivosActuales}
                  onQuitar={detalle.puedeEntregar ? (a) => setQuitar((q) => [...q, a.archivoId]) : undefined}
                  onError={setError}
                  vacio={!detalle.puedeEntregar && !entrega ? "Sin entrega." : undefined}
                />
                {detalle.puedeEntregar ? (
                  <>
                    <ArchivosPorSubir archivos={nuevos} onQuitar={(i) => setNuevos((n) => n.filter((_, j) => j !== i))} />
                    <ElegirArchivos onElegir={(f) => setNuevos((n) => [...n, ...f])} disabled={enviando} />
                    <Textarea label="Comentario (opcional)" rows={3} maxLength={2000} value={comentario}
                      onChange={(e) => setComentario(e.target.value)} placeholder="Algo que el catedrático deba saber de su entrega" />
                  </>
                ) : entrega?.comentario ? (
                  <p className="text-[15px] text-stone-800 whitespace-pre-line bg-sand-50 rounded-2xl px-4 py-3">{entrega.comentario}</p>
                ) : null}
                {!detalle.puedeEntregar && (
                  <p className="text-[13px] text-stone-500">
                    {detalle.motivoNoEditable ?? "Esta tarea la entrega el alumno desde su portal."}
                  </p>
                )}
              </>
            )}
          </Card>
        </div>
      )}
    </Drawer>
  );
}

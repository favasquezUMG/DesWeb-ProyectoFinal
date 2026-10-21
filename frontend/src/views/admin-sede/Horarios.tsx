import { useCallback, useEffect, useState } from "react";
import { Plus, X, CalendarCheck } from "lucide-react";
import { Card, SectionHeader, Btn, AlertBanner, Modal, Select, Input, EmptyState } from "../../components/Ui";
import {
  getSeccionesAdmin, getCursosSeccionAdmin, crearHorario, eliminarHorario,
  type SeccionAdminDto, type CursoSeccionAdminDto,
} from "../../lib/api";
import { DIAS_SEMANA, etiquetaSeccion, horasSemanales } from "./academico";

const PALETA = [
  "bg-primary-50 text-primary-900 border-primary-200",
  "bg-info-50 text-info-800 border-info-200",
  "bg-success-50 text-success-800 border-success-200",
  "bg-warning-50 text-warning-800 border-warning-200",
  "bg-action-50 text-action-800 border-action-200",
  "bg-stone-100 text-stone-800 border-stone-200",
];

interface Bloque { horarioId: number; cursoSeccionId: number; diaSemana: number; horaInicio: string; horaFin: string; curso: string; catedratico: string; color: string }

export default function HorariosView() {
  const anioActual = new Date().getFullYear();
  const [secciones, setSecciones] = useState<SeccionAdminDto[]>([]);
  const [seccionId, setSeccionId] = useState<number | null>(null);
  const [cursos, setCursos] = useState<CursoSeccionAdminDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const [nuevo, setNuevo] = useState<{ cursoSeccionId: number; diaSemana: number; horaInicio: string; horaFin: string } | null>(null);
  const [aQuitar, setAQuitar] = useState<Bloque | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState("");

  useEffect(() => {
    // Secciones del ciclo actual y del siguiente (para dejar listo el horario antes de iniciar)
    Promise.all([getSeccionesAdmin({ anioLectivo: anioActual }), getSeccionesAdmin({ anioLectivo: anioActual + 1 })])
      .then(([a, b]) => {
        const todas = [...a.secciones, ...b.secciones];
        setSecciones(todas);
        if (todas.length) setSeccionId(todas[0].seccionId);
        else setLoading(false);
      })
      .catch((e) => { setError(e instanceof Error ? e.message : "No se pudieron cargar las secciones."); setLoading(false); });
  }, [anioActual]);

  const cargarCursos = useCallback(async (id: number) => {
    setLoading(true);
    try {
      setCursos(await getCursosSeccionAdmin({ seccionId: id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el horario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (seccionId !== null) cargarCursos(seccionId); }, [seccionId, cargarCursos]);

  const bloques: Bloque[] = cursos.flatMap((c, i) => c.horarios.map((h) => ({
    horarioId: h.horarioId,
    cursoSeccionId: c.cursoSeccionId,
    diaSemana: h.diaSemana,
    horaInicio: h.horaInicio,
    horaFin: h.horaFin,
    curso: c.curso.nombre,
    catedratico: `${c.catedratico.usuario.nombres} ${c.catedratico.usuario.apellidos}`,
    color: PALETA[i % PALETA.length],
  })));
  const dias = [...new Set([1, 2, 3, 4, 5, ...bloques.map((b) => b.diaSemana)])].sort((a, b) => a - b);
  const franjas = [...new Set(bloques.map((b) => `${b.horaInicio}–${b.horaFin}`))].sort();
  const seccion = secciones.find((s) => s.seccionId === seccionId) ?? null;
  const sinHorario = cursos.filter((c) => c.horarios.length === 0);

  function abrirNuevo(diaSemana = 1, franja?: string) {
    const [horaInicio, horaFin] = franja ? franja.split("–") : ["07:00", "07:45"];
    setNuevo({ cursoSeccionId: sinHorario[0]?.cursoSeccionId ?? cursos[0]?.cursoSeccionId ?? 0, diaSemana, horaInicio, horaFin });
    setErrorDialogo("");
  }

  async function guardar() {
    if (!nuevo) return;
    if (nuevo.horaFin <= nuevo.horaInicio) return setErrorDialogo("La hora de fin debe ser posterior a la de inicio.");
    setGuardando(true);
    setErrorDialogo("");
    try {
      await crearHorario(nuevo);
      setAviso("Bloque agregado al horario.");
      setNuevo(null);
      if (seccionId !== null) await cargarCursos(seccionId);
    } catch (e) {
      setErrorDialogo(e instanceof Error ? e.message : "No se pudo guardar el bloque.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar() {
    if (!aQuitar) return;
    setGuardando(true);
    try {
      await eliminarHorario(aQuitar.horarioId);
      setAQuitar(null);
      setAviso("Bloque eliminado.");
      if (seccionId !== null) await cargarCursos(seccionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo eliminar el bloque.");
      setAQuitar(null);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-5">
      <SectionHeader title="Horarios" subtitle={seccion ? `Bloques de clase — ${etiquetaSeccion(seccion)} · ${seccion.anioLectivo}` : "Bloques de clase por sección"}
        action={
          <div className="flex gap-2">
            <Select aria-label="Sección" value={seccionId ?? ""} onChange={(e) => setSeccionId(Number(e.target.value))}>
              {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{etiquetaSeccion(s)} · {s.anioLectivo}</option>)}
            </Select>
            <Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} disabled={cursos.length === 0} onClick={() => abrirNuevo()}>Agregar bloque</Btn>
          </div>
        } />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}
      {sinHorario.length > 0 && (
        <AlertBanner type="warning" message={`Cursos sin horario: ${sinHorario.map((c) => c.curso.nombre).join(", ")}.`} />
      )}

      {secciones.length === 0 && !loading ? (
        <EmptyState icon={<CalendarCheck className="w-10 h-10" />} title="Sin secciones" description="Cree las secciones del ciclo en Grados y Secciones." />
      ) : loading ? (
        <div className="h-64 rounded-xl bg-stone-100 animate-pulse" />
      ) : cursos.length === 0 ? (
        <EmptyState icon={<CalendarCheck className="w-10 h-10" />} title="La sección no tiene cursos" description="Asigne primero los cursos y catedráticos en Cursos." />
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-primary-700 text-white">
                  <th className="px-4 py-3 text-left font-medium w-28">Hora</th>
                  {dias.map((d) => <th key={d} className="px-4 py-3 text-left font-medium">{DIAS_SEMANA[d]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {franjas.map((franja, i) => {
                  const [inicio, fin] = franja.split("–");
                  return (
                    <tr key={franja} className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}>
                      <td className="px-4 py-3 font-mono-data text-stone-500 font-medium whitespace-nowrap">{franja}</td>
                      {dias.map((d) => {
                        const b = bloques.find((x) => x.diaSemana === d && x.horaInicio === inicio && x.horaFin === fin);
                        return (
                          <td key={d} className="px-2 py-2">
                            {b ? (
                              <div className={`relative p-2 rounded-lg border group ${b.color}`}>
                                <p className="font-semibold leading-tight pr-4">{b.curso}</p>
                                <p className="text-[10px] opacity-70 mt-0.5">{b.catedratico}</p>
                                <button onClick={() => setAQuitar(b)} aria-label={`Quitar ${b.curso} del ${DIAS_SEMANA[d]}`}
                                  className="absolute top-1 right-1 p-0.5 rounded opacity-50 hover:opacity-100 hover:text-danger-700 cursor-pointer"><X className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button onClick={() => abrirNuevo(d, franja)} aria-label={`Agregar clase el ${DIAS_SEMANA[d]} de ${franja}`}
                                className="w-full h-12 border border-dashed border-stone-200 rounded-lg flex items-center justify-center text-stone-300 hover:border-primary-300 hover:bg-primary-50 transition-colors cursor-pointer">
                                <Plus className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {franjas.length === 0 && (
                  <tr><td colSpan={dias.length + 1} className="px-4 py-10 text-center text-sm text-stone-500">Aún no hay bloques. Use “Agregar bloque”.</td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-stone-100 text-xs text-stone-500">
            Carga semanal de la sección: {horasSemanales(bloques)} h · {cursos.length} cursos
          </div>
        </Card>
      )}

      <Modal open={!!nuevo} onClose={() => !guardando && setNuevo(null)} title="Agregar bloque de clase"
        footer={<>
          <Btn variant="ghost" onClick={() => setNuevo(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} disabled={!nuevo?.cursoSeccionId} onClick={guardar}>Guardar</Btn>
        </>}>
        {nuevo && (
          <div className="space-y-3">
            <Select label="Curso" value={nuevo.cursoSeccionId} onChange={(e) => setNuevo({ ...nuevo, cursoSeccionId: Number(e.target.value) })}>
              {cursos.map((c) => (
                <option key={c.cursoSeccionId} value={c.cursoSeccionId}>
                  {c.curso.nombre} — {c.catedratico.usuario.nombres} {c.catedratico.usuario.apellidos} ({horasSemanales(c.horarios)} h/sem)
                </option>
              ))}
            </Select>
            <Select label="Día" value={nuevo.diaSemana} onChange={(e) => setNuevo({ ...nuevo, diaSemana: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6].map((d) => <option key={d} value={d}>{DIAS_SEMANA[d]}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Inicio" type="time" value={nuevo.horaInicio} onChange={(e) => setNuevo({ ...nuevo, horaInicio: e.target.value })} />
              <Input label="Fin" type="time" value={nuevo.horaFin} onChange={(e) => setNuevo({ ...nuevo, horaFin: e.target.value })} />
            </div>
            <p className="text-xs text-stone-500">El sistema rechaza el bloque si choca con otra clase de la sección o del mismo catedrático.</p>
            {errorDialogo && <AlertBanner type="error" message={errorDialogo} />}
          </div>
        )}
      </Modal>

      <Modal open={!!aQuitar} onClose={() => !guardando && setAQuitar(null)} title="Quitar bloque"
        footer={<>
          <Btn variant="ghost" onClick={() => setAQuitar(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="destructive" loading={guardando} onClick={quitar}>Quitar</Btn>
        </>}>
        {aQuitar && <p className="text-sm text-stone-600">¿Quitar {aQuitar.curso} del {DIAS_SEMANA[aQuitar.diaSemana].toLowerCase()} de {aQuitar.horaInicio} a {aQuitar.horaFin}?</p>}
      </Modal>
    </div>
  );
}

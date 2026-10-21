import { useEffect, useState } from "react";
import { CheckCircle2, ClipboardList, Save } from "lucide-react";
import { Card, SectionHeader, Btn, AlertBanner, EmptyState, TH, TD } from "../../components/Ui";
import { getListaAsistencia, pasarLista, type EstadoAsistencia, type ListaAsistenciaDto } from "../../lib/api";
import { CursoSelect, Cargando, errorMsg, formatFechaCorta, hoyISO, iniciales, useMisCursos } from "./shared";

const ESTADOS: Array<{ key: EstadoAsistencia; label: string; plural: string; color: string; dot: string }> = [
  { key: "Presente", label: "P", plural: "Presentes", color: "bg-success-600 text-white", dot: "bg-success-600" },
  { key: "Tarde", label: "T", plural: "Tardes", color: "bg-warning-600 text-white", dot: "bg-warning-600" },
  { key: "Ausente", label: "A", plural: "Ausentes", color: "bg-danger-600 text-white", dot: "bg-danger-600" },
  { key: "Justificado", label: "J", plural: "Justificados", color: "bg-info-600 text-white", dot: "bg-info-600" },
];

type AlumnoLista = ListaAsistenciaDto["alumnos"][number];

// "Justificado" no lo elige el catedrático: solo existe cuando la sede aprobó la
// justificación del día, y en ese caso reemplaza a "Ausente".
const ausenteDe = (a: AlumnoLista): EstadoAsistencia => (a.diaJustificado ? "Justificado" : "Ausente");
const opcionesDe = (a: AlumnoLista) => ESTADOS.filter((s) => s.key !== (a.diaJustificado ? "Ausente" : "Justificado"));

const estadoInicial = (a: AlumnoLista): EstadoAsistencia =>
  a.estado ?? (a.diaJustificado || a.ausenteEnOtraClase ? ausenteDe(a) : "Presente");

export default function Asistencia() {
  const { cursos, seleccion, setSeleccion, loading: cargandoCursos, error: errorCursos } = useMisCursos();
  const [fecha, setFecha] = useState(hoyISO());
  const [lista, setLista] = useState<ListaAsistenciaDto | null>(null);
  const [estados, setEstados] = useState<Record<number, EstadoAsistencia>>({});
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    if (!seleccion || !fecha) return;
    let cancelled = false;
    setCargando(true);
    setError("");
    setMensaje("");
    getListaAsistencia(seleccion, fecha)
      .then((data) => {
        if (cancelled) return;
        setLista(data);
        // Si ya se pasó lista se muestra lo registrado. Si no, todos presentes, salvo quien tiene
        // el día justificado o ya fue marcado ausente hoy en una clase anterior.
        setEstados(Object.fromEntries(data.alumnos.map((a) => [a.alumnoId, estadoInicial(a)])));
      })
      .catch((err) => {
        if (cancelled) return;
        setLista(null);
        setError(errorMsg(err, "No se pudo cargar la lista."));
      })
      .finally(() => { if (!cancelled) setCargando(false); });
    return () => { cancelled = true; };
  }, [seleccion, fecha]);

  function marcarTodos(estado: EstadoAsistencia) {
    if (!lista) return;
    setEstados(Object.fromEntries(lista.alumnos.map((a) => [a.alumnoId, estado === "Ausente" ? ausenteDe(a) : estado])));
  }

  async function handleGuardar() {
    if (!lista || !seleccion) return;
    setGuardando(true);
    setError("");
    try {
      const res = await pasarLista({
        cursoSeccionId: seleccion,
        fecha,
        asistencias: lista.alumnos.map((a) => ({ alumnoId: a.alumnoId, estado: estados[a.alumnoId] ?? "Presente" })),
      });
      setMensaje(res.message);
      setLista({ ...lista, yaRegistrada: true });
    } catch (err) {
      setError(errorMsg(err, "No se pudo guardar la asistencia."));
    } finally {
      setGuardando(false);
    }
  }

  if (cargandoCursos) return <Cargando texto="Cargando sus cursos..." />;
  if (errorCursos) return <AlertBanner type="error" message={errorCursos} />;
  if (cursos.length === 0) {
    return <EmptyState icon={<ClipboardList className="w-10 h-10" />} title="Sin cursos asignados" description="Aún no tiene cursos asignados en este ciclo." />;
  }

  const conteo = (estado: EstadoAsistencia) => Object.values(estados).filter((e) => e === estado).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <SectionHeader
          title="Pase de Lista"
          subtitle={lista ? `${lista.curso} — ${lista.grado} ${lista.seccion} · ${formatFechaCorta(fecha)}` : undefined}
        />
        <div className="flex flex-wrap gap-2 items-center">
          <CursoSelect cursos={cursos} value={seleccion} onChange={setSeleccion} />
          <input
            type="date"
            value={fecha}
            max={hoyISO()}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-700"
          />
        </div>
      </div>

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {mensaje && <AlertBanner type="success" message={mensaje} onClose={() => setMensaje("")} />}
      {lista?.yaRegistrada && !mensaje && (
        <AlertBanner type="info" message="Ya se pasó lista en esta fecha. Puede corregir los estados y volver a guardar." />
      )}

      {cargando || !lista ? (cargando ? <Cargando /> : null) : lista.alumnos.length === 0 ? (
        <EmptyState icon={<ClipboardList className="w-10 h-10" />} title="Sin alumnos" description="La sección no tiene alumnos inscritos." />
      ) : (
        <>
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                {ESTADOS.map((s) => (
                  <span key={s.key} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />{s.plural}: <strong>{conteo(s.key)}</strong>
                  </span>
                ))}
              </div>
              <div className="flex gap-2 items-center flex-wrap">
                <span className="text-xs text-stone-500">Marcar todos:</span>
                {ESTADOS.filter((s) => s.key === "Presente" || s.key === "Ausente").map((s) => (
                  <button key={s.key} onClick={() => marcarTodos(s.key)}
                    className={`px-2 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer ${s.color} opacity-80 hover:opacity-100`}>
                    {s.plural}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <table className="w-full">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr><TH>Alumno</TH><TH className="text-center">Estado</TH></tr>
              </thead>
              <tbody className="divide-y divide-stone-50">
                {lista.alumnos.map((a) => (
                  <tr key={a.alumnoId} className="hover:bg-stone-50">
                    <TD>
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-full bg-primary-100 text-primary-800 flex items-center justify-center text-xs font-bold">
                          {iniciales(a.nombres, a.apellidos)}
                        </div>
                        <div>
                          <span className="font-medium text-stone-900 text-sm">{a.apellidos}, {a.nombres}</span>
                          {a.diaJustificado ? (
                            <p className="text-[11px] text-info-700">Ausencia justificada por la sede</p>
                          ) : !a.estado && a.ausenteEnOtraClase && (
                            <p className="text-[11px] text-danger-700">Ausente en una clase anterior hoy</p>
                          )}
                        </div>
                      </div>
                    </TD>
                    <TD className="text-center">
                      <div className="flex justify-center gap-1" role="group" aria-label={`Estado de ${a.nombres} ${a.apellidos}`}>
                        {opcionesDe(a).map((s) => (
                          <button key={s.key} onClick={() => setEstados((prev) => ({ ...prev, [a.alumnoId]: s.key }))}
                            aria-pressed={estados[a.alumnoId] === s.key}
                            aria-label={`Marcar ${s.key.toLowerCase()}`}
                            title={s.key}
                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-all cursor-pointer
                              ${estados[a.alumnoId] === s.key ? s.color + " ring-2 ring-offset-1 ring-primary-300" : "bg-stone-100 text-stone-500 hover:bg-stone-200"}`}>
                            {s.label}
                          </button>
                        ))}
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <p className="text-xs text-stone-500">
            P = Presente · T = Tarde (cuenta como asistencia) · A = Ausente · J = Ausencia justificada por la sede a solicitud del encargado (no cuenta en contra)
          </p>

          <div className="flex justify-end gap-2">
            {mensaje && <span className="text-xs text-success-700 flex items-center gap-1 py-2"><CheckCircle2 className="w-4 h-4" />Asistencia guardada</span>}
            <Btn variant="primary" icon={<Save className="w-4 h-4" />} loading={guardando} onClick={handleGuardar}>
              {lista.yaRegistrada ? "Actualizar asistencia" : "Guardar asistencia"}
            </Btn>
          </div>
        </>
      )}
    </div>
  );
}

import { useCallback, useEffect, useState } from "react";
import { Plus, ChevronDown, X, BookOpen } from "lucide-react";
import { Card, SectionHeader, Btn, Modal, Input, Select, AlertBanner, EmptyState } from "../../components/Ui";
import {
  getGrados, getCursosCatalogo, crearCurso, asignarCursoAGrado, quitarCursoDeGrado,
  type GradoDto, type CursoCatalogoDto,
} from "../../lib/api";

const COLOR_NIVEL = ["bg-purple-100 text-purple-800", "bg-info-100 text-info-800", "bg-primary-100 text-primary-800", "bg-action-100 text-action-800"];

export default function MallaCurricular() {
  const [grados, setGrados] = useState<GradoDto[]>([]);
  const [cursos, setCursos] = useState<CursoCatalogoDto[]>([]);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [agregar, setAgregar] = useState<GradoDto | null>(null);
  const [cursoSel, setCursoSel] = useState<number | "nuevo">("nuevo");
  const [nombreNuevo, setNombreNuevo] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorModal, setErrorModal] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [g, c] = await Promise.all([getGrados(), getCursosCatalogo()]);
      setGrados(g);
      setCursos(c);
      setAbiertos((prev) => (prev.size ? prev : new Set(g.slice(0, 1).map((x) => x.nivel))));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar la malla.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const niveles = [...new Set(grados.map((g) => g.nivel))];
  const toggle = (nivel: string) => setAbiertos((prev) => {
    const n = new Set(prev);
    if (n.has(nivel)) n.delete(nivel); else n.add(nivel);
    return n;
  });

  async function guardar() {
    if (!agregar) return;
    setGuardando(true);
    setErrorModal("");
    try {
      if (cursoSel === "nuevo") {
        if (!nombreNuevo.trim()) throw new Error("Escriba el nombre del curso.");
        await crearCurso({ nombre: nombreNuevo.trim(), gradosIds: [agregar.gradoId] });
      } else {
        await asignarCursoAGrado(cursoSel, agregar.gradoId);
      }
      setAviso(`Curso agregado a ${agregar.nombre}. Las sedes ya pueden asignarlo a sus secciones.`);
      setAgregar(null);
      await cargar();
    } catch (e) {
      setErrorModal(e instanceof Error ? e.message : "No se pudo agregar el curso.");
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(grado: GradoDto, curso: { cursoId: number; nombre: string }) {
    setError("");
    try {
      await quitarCursoDeGrado(curso.cursoId, grado.gradoId);
      setAviso(`${curso.nombre} se quitó de ${grado.nombre}.`);
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo quitar el curso.");
    }
  }

  const disponibles = agregar ? cursos.filter((c) => !agregar.cursos.some((x) => x.cursoId === c.cursoId)) : [];

  return (
    <div className="space-y-6">
      <SectionHeader title="Malla Curricular" subtitle="Cursos que lleva cada grado (CNB). Las sedes asignan estos cursos a sus secciones." />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}

      {loading ? <div className="space-y-3">{[0, 1].map((i) => <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />)}</div>
        : grados.length === 0 ? <EmptyState icon={<BookOpen className="w-10 h-10" />} title="Sin grados" description="No hay grados registrados." />
        : (
          <div className="space-y-3">
            {niveles.map((nivel, i) => {
              const delNivel = grados.filter((g) => g.nivel === nivel);
              return (
                <Card key={nivel} className="overflow-hidden">
                  <button onClick={() => toggle(nivel)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors cursor-pointer text-left">
                    <div className="flex items-center gap-3">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${COLOR_NIVEL[i % COLOR_NIVEL.length]}`}>{nivel}</span>
                      <span className="text-sm text-stone-500">{delNivel.length} grados · {delNivel.reduce((a, g) => a + g.cursos.length, 0)} cursos</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${abiertos.has(nivel) ? "rotate-180" : ""}`} />
                  </button>
                  {abiertos.has(nivel) && (
                    <div className="border-t border-stone-100 divide-y divide-stone-50">
                      {delNivel.map((g) => (
                        <div key={g.gradoId} className="px-5 py-4">
                          <div className="flex items-center justify-between mb-3">
                            <h4 className="font-semibold text-stone-800 text-sm">{g.nombre}</h4>
                            <Btn variant="ghost" size="sm" icon={<Plus className="w-3 h-3" />}
                              onClick={() => { setAgregar(g); setCursoSel("nuevo"); setNombreNuevo(""); setErrorModal(""); }}>Agregar curso</Btn>
                          </div>
                          {g.cursos.length === 0 ? <p className="text-xs text-stone-400">Sin cursos en la malla.</p> : (
                            <div className="flex flex-wrap gap-2">
                              {g.cursos.map((c) => (
                                <span key={c.cursoId} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 text-xs bg-stone-100 text-stone-700 rounded-full border border-stone-200">
                                  {c.nombre}
                                  <button onClick={() => quitar(g, c)} aria-label={`Quitar ${c.nombre} de ${g.nombre}`}
                                    className="p-0.5 rounded-full hover:bg-stone-200 hover:text-danger-700 cursor-pointer"><X className="w-3 h-3" /></button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

      <Modal open={!!agregar} onClose={() => !guardando && setAgregar(null)} title={`Agregar curso — ${agregar?.nombre ?? ""}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setAgregar(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant="primary" loading={guardando} onClick={guardar}>Agregar</Btn>
        </>}>
        <div className="space-y-3">
          <Select label="Curso" value={cursoSel} onChange={(e) => setCursoSel(e.target.value === "nuevo" ? "nuevo" : Number(e.target.value))}>
            <option value="nuevo">+ Crear un curso nuevo</option>
            {disponibles.map((c) => <option key={c.cursoId} value={c.cursoId}>{c.nombre}</option>)}
          </Select>
          {cursoSel === "nuevo" && <Input label="Nombre del curso" value={nombreNuevo} maxLength={100} onChange={(e) => setNombreNuevo(e.target.value)} placeholder="Ej. Robótica" />}
          <p className="text-xs text-stone-500">Quitar un curso de la malla no es posible si alguna sección ya lo tiene asignado.</p>
          {errorModal && <AlertBanner type="error" message={errorModal} />}
        </div>
      </Modal>
    </div>
  );
}

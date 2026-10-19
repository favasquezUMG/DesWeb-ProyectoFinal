import { useCallback, useEffect, useState } from "react";
import { Plus, Edit, Trash2, CopyPlus, Grid3X3 } from "lucide-react";
import { Card, SectionHeader, Btn, Modal, Input, AlertBanner, Select, EmptyState, Badge } from "../../components/Ui";
import {
  getGrados, getSeccionesAdmin, crearSeccion, renombrarSeccion, eliminarSeccion, copiarSecciones,
  type GradoDto, type SeccionAdminDto,
} from "../../lib/api";

type Dialogo =
  | { tipo: "crear"; grado: GradoDto }
  | { tipo: "renombrar"; seccion: SeccionAdminDto }
  | { tipo: "eliminar"; seccion: SeccionAdminDto }
  | { tipo: "copiar" };

export default function GradosView() {
  const anioActual = new Date().getFullYear();
  const [grados, setGrados] = useState<GradoDto[]>([]);
  const [secciones, setSecciones] = useState<SeccionAdminDto[]>([]);
  const [ciclos, setCiclos] = useState<number[]>([]);
  const [ciclo, setCiclo] = useState(anioActual);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [dialogo, setDialogo] = useState<Dialogo | null>(null);
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [errorDialogo, setErrorDialogo] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([getGrados(), getSeccionesAdmin({ anioLectivo: ciclo })]);
      setGrados(g);
      setSecciones(s.secciones);
      setCiclos([...new Set([anioActual, anioActual + 1, ...s.ciclos])].sort((a, b) => b - a));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los grados.");
    } finally {
      setLoading(false);
    }
  }, [ciclo, anioActual]);

  useEffect(() => { cargar(); }, [cargar]);

  function abrir(d: Dialogo) {
    setDialogo(d);
    setErrorDialogo("");
    setNombre(d.tipo === "renombrar" ? d.seccion.nombre : "");
  }

  async function confirmar() {
    if (!dialogo) return;
    setGuardando(true);
    setErrorDialogo("");
    try {
      const res =
        dialogo.tipo === "crear" ? await crearSeccion({ gradoId: dialogo.grado.gradoId, nombre: nombre.trim(), anioLectivo: ciclo })
        : dialogo.tipo === "renombrar" ? await renombrarSeccion(dialogo.seccion.seccionId, nombre.trim())
        : dialogo.tipo === "eliminar" ? await eliminarSeccion(dialogo.seccion.seccionId)
        : await copiarSecciones({ desde: ciclo, hasta: ciclo + 1 });
      setAviso(res.message);
      setDialogo(null);
      if (dialogo.tipo === "copiar") setCiclo(ciclo + 1);
      else await cargar();
    } catch (e) {
      setErrorDialogo(e instanceof Error ? e.message : "No se pudo completar la acción.");
    } finally {
      setGuardando(false);
    }
  }

  const editable = ciclo >= anioActual;
  const niveles = [...new Set(grados.map((g) => g.nivel))];

  return (
    <div className="space-y-5">
      <SectionHeader title="Grados y Secciones" subtitle="Secciones que la sede abre en cada ciclo escolar"
        action={
          <div className="flex items-center gap-2">
            <Select aria-label="Ciclo escolar" value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
              {ciclos.map((c) => <option key={c} value={c}>Ciclo {c}</option>)}
            </Select>
            {secciones.length > 0 && (
              <Btn variant="outline" size="sm" icon={<CopyPlus className="w-4 h-4" />} onClick={() => abrir({ tipo: "copiar" })}>
                Preparar {ciclo + 1}
              </Btn>
            )}
          </div>
        } />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {aviso && <AlertBanner type="success" message={aviso} onClose={() => setAviso("")} />}
      {!editable && <AlertBanner type="info" message={`El ciclo ${ciclo} ya terminó: sus secciones se muestran solo como historial.`} />}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-stone-100 animate-pulse" />)}</div>
      ) : grados.length === 0 ? (
        <EmptyState icon={<Grid3X3 className="w-10 h-10" />} title="Sin grados" description="No hay grados registrados en el sistema." />
      ) : niveles.map((nivel) => (
        <div key={nivel} className="space-y-3">
          <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-wider">{nivel}</h2>
          {grados.filter((g) => g.nivel === nivel).map((g) => {
            const propias = secciones.filter((s) => s.grado.gradoId === g.gradoId);
            return (
              <Card key={g.gradoId} className="p-5">
                <div className="flex items-center justify-between mb-3 gap-3">
                  <div>
                    <h3 className="font-display font-semibold text-stone-900">{g.nombre}</h3>
                    <p className="text-xs text-stone-500">{g.cursos.length} cursos en la malla · {propias.reduce((a, s) => a + s.alumnos, 0)} alumnos</p>
                  </div>
                  {editable && <Btn variant="ghost" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => abrir({ tipo: "crear", grado: g })}>Agregar sección</Btn>}
                </div>
                {propias.length === 0 ? (
                  <p className="text-sm text-stone-400">Sin secciones en {ciclo}.</p>
                ) : (
                  <div className="flex gap-3 flex-wrap">
                    {propias.map((s) => (
                      <div key={s.seccionId} className="flex-1 min-w-40 max-w-xs bg-stone-50 border border-stone-200 rounded-xl p-4 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-stone-800">Sección {s.nombre}</p>
                          <p className="text-sm text-stone-500 font-mono-data">{s.alumnos} alumnos</p>
                          {s.cursos < g.cursos.length && <Badge variant="warning" className="mt-1">{s.cursos}/{g.cursos.length} cursos asignados</Badge>}
                        </div>
                        {editable && (
                          <div className="flex flex-col gap-1">
                            <button onClick={() => abrir({ tipo: "renombrar", seccion: s })} aria-label={`Renombrar sección ${s.nombre}`}
                              className="p-1.5 text-stone-400 hover:text-primary-700 rounded transition-colors cursor-pointer"><Edit className="w-4 h-4" /></button>
                            <button onClick={() => abrir({ tipo: "eliminar", seccion: s })} aria-label={`Eliminar sección ${s.nombre}`}
                              className="p-1.5 text-stone-400 hover:text-danger-700 rounded transition-colors cursor-pointer"><Trash2 className="w-4 h-4" /></button>
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
      ))}

      <Modal open={!!dialogo} onClose={() => !guardando && setDialogo(null)}
        title={dialogo?.tipo === "crear" ? `Nueva sección — ${dialogo.grado.nombre}`
          : dialogo?.tipo === "renombrar" ? "Renombrar sección"
          : dialogo?.tipo === "eliminar" ? "Eliminar sección" : `Preparar el ciclo ${ciclo + 1}`}
        footer={<>
          <Btn variant="ghost" onClick={() => setDialogo(null)} disabled={guardando}>Cancelar</Btn>
          <Btn variant={dialogo?.tipo === "eliminar" ? "destructive" : "primary"} loading={guardando}
            disabled={(dialogo?.tipo === "crear" || dialogo?.tipo === "renombrar") && !nombre.trim()} onClick={confirmar}>
            {dialogo?.tipo === "eliminar" ? "Eliminar" : dialogo?.tipo === "copiar" ? "Abrir secciones" : "Guardar"}
          </Btn>
        </>}>
        <div className="space-y-3">
          {(dialogo?.tipo === "crear" || dialogo?.tipo === "renombrar") && (
            <Input label="Nombre de la sección" value={nombre} maxLength={10} placeholder="Ej. A, B, Matutina"
              onChange={(e) => setNombre(e.target.value)} autoFocus />
          )}
          {dialogo?.tipo === "eliminar" && (
            <p className="text-sm text-stone-600">
              ¿Eliminar {dialogo.seccion.grado.nombre} sección {dialogo.seccion.nombre}? Solo se puede si no tiene alumnos, matrículas ni cursos asignados.
            </p>
          )}
          {dialogo?.tipo === "copiar" && (
            <p className="text-sm text-stone-600">
              Se abrirán para {ciclo + 1} las mismas {secciones.length} secciones de {ciclo}, vacías. Así los padres pueden reinscribir a sus hijos desde su cuenta.
              Los cursos y catedráticos se asignan después en Cursos.
            </p>
          )}
          {errorDialogo && <AlertBanner type="error" message={errorDialogo} />}
        </div>
      </Modal>
    </div>
  );
}

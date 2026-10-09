import { useEffect, useMemo, useState } from "react";
import { Search, Users, AlertOctagon, UserX } from "lucide-react";
import { Card, SectionHeader, Badge, Drawer, AlertBanner, TH, TD } from "../../components/Ui";
import { getAlumnos, type AlumnoDto } from "../../lib/api";
import { nombreDe } from "../../lib/becas";
import EncargadosAlumno from "./EncargadosAlumno";

function gradoSeccion(s: { nombre: string; grado: { nombre: string } }): string {
  return `${s.grado.nombre} "${s.nombre}"`;
}

export default function AlumnosView() {
  const [alumnos, setAlumnos] = useState<AlumnoDto[]>([]);
  const [search, setSearch] = useState("");
  const [gradoFilter, setGradoFilter] = useState("todos");
  const [soloAlertas, setSoloAlertas] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState<AlumnoDto | null>(null);

  function cargar() {
    return getAlumnos().then(setAlumnos);
  }

  useEffect(() => {
    cargar()
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los alumnos."))
      .finally(() => setLoading(false));
  }, []);

  const grados = useMemo(() => [...new Set(alumnos.map((a) => a.seccion.grado.nombre))], [alumnos]);

  const filtrados = alumnos.filter((a) => {
    const texto = `${nombreDe(a.usuario)} ${a.usuario.email ?? ""}`.toLowerCase();
    const sinEncargado = (a.encargadosActivos ?? 0) === 0;
    return texto.includes(search.toLowerCase())
      && (gradoFilter === "todos" || a.seccion.grado.nombre === gradoFilter)
      && (!soloAlertas || a.tieneRestriccion || sinEncargado);
  });

  const conRestriccion = alumnos.filter((a) => a.tieneRestriccion).length;
  const sinEncargado = alumnos.filter((a) => (a.encargadosActivos ?? 0) === 0).length;

  return (
    <div className="space-y-5">
      <SectionHeader title="Alumnos y Encargados" subtitle="Padrón de la sede y adultos responsables de cada alumno" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}
      {(conRestriccion > 0 || sinEncargado > 0) && (
        <AlertBanner type="warning"
          message={[
            conRestriccion ? `${conRestriccion} alumno(s) con restricción judicial registrada (revise antes de entregar al alumno).` : "",
            sinEncargado ? `${sinEncargado} alumno(s) sin encargado activo.` : "",
          ].filter(Boolean).join(" ")} />
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row gap-3 p-4 border-b border-stone-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o correo…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white" />
          </div>
          <select value={gradoFilter} onChange={(e) => setGradoFilter(e.target.value)} aria-label="Filtrar por grado"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700 bg-white">
            <option value="todos">Todos los grados</option>
            {grados.map((g) => <option key={g}>{g}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-primary-700" checked={soloAlertas} onChange={(e) => setSoloAlertas(e.target.checked)} />
            Solo con alertas
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr><TH>Alumno</TH><TH>Grado · Sección</TH><TH>Contacto principal</TH><TH>Encargados</TH><TH className="text-right">Acciones</TH></tr>
            </thead>
            <tbody className="divide-y divide-stone-50">
              {loading ? (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">Cargando alumnos…</td></tr>
              ) : filtrados.map((a) => (
                <tr key={a.alumnoId} className="hover:bg-stone-50 transition-colors">
                  <TD>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-stone-900 text-sm">{nombreDe(a.usuario)}</p>
                      {a.tieneRestriccion && <span title="Tiene una restricción judicial registrada"><AlertOctagon className="w-4 h-4 text-danger-700" /></span>}
                    </div>
                    <p className="text-xs text-stone-400">{a.usuario.email}</p>
                  </TD>
                  <TD><span className="text-stone-600 text-sm">{gradoSeccion(a.seccion)}</span></TD>
                  <TD>{a.contactoPrincipal ? <span className="text-sm">{a.contactoPrincipal}</span> : <span className="text-sm text-danger-700 flex items-center gap-1"><UserX className="w-3.5 h-3.5" />Sin contacto</span>}</TD>
                  <TD>
                    <Badge variant={(a.encargadosActivos ?? 0) === 0 ? "danger" : "neutral"}>{a.encargadosActivos ?? 0} activo(s)</Badge>
                  </TD>
                  <TD className="text-right">
                    <button onClick={() => setAbierto(a)} className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-primary-700 hover:bg-primary-50 rounded-md cursor-pointer">
                      <Users className="w-3.5 h-3.5" />Encargados
                    </button>
                  </TD>
                </tr>
              ))}
              {!loading && filtrados.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-stone-500">No hay alumnos con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer open={!!abierto} onClose={() => setAbierto(null)} title="Encargados del alumno">
        {abierto && <EncargadosAlumno alumnoId={abierto.alumnoId} onCambio={() => { cargar().catch(() => {}); }} />}
      </Drawer>
    </div>
  );
}

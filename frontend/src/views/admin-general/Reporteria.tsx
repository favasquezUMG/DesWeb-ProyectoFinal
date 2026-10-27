import { useEffect, useState } from "react";
import { Download } from "../../components/Iconos";
import { Card, SectionHeader, Btn, Badge, Select, AlertBanner } from "../../components/Ui";
import {
  getSedes, getSeccionesAdmin, getCatedraticosSede, getDashboardSede, descargarReportePdf,
  type SedeDto, type SeccionAdminDto, type CatedraticoSedeDto,
} from "../../lib/api";
import { generarCargaHorariaPdf, generarResumenSedePdf } from "../../lib/reportesPdf";

type Clave = "seccion" | "catedratico" | "resumen" | "carga";

export default function Reporteria() {
  const anioActual = new Date().getFullYear();
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [sedeId, setSedeId] = useState<number | "">("");
  const [ciclo, setCiclo] = useState(anioActual);
  const [ciclos, setCiclos] = useState<number[]>([anioActual]);
  const [secciones, setSecciones] = useState<SeccionAdminDto[]>([]);
  const [seccionId, setSeccionId] = useState<number | "">("");
  const [catedraticos, setCatedraticos] = useState<CatedraticoSedeDto[]>([]);
  const [catedraticoId, setCatedraticoId] = useState<number | "">("");
  const [generando, setGenerando] = useState<Clave | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([getSedes(), getCatedraticosSede()])
      .then(([s, c]) => { setSedes(s); setCatedraticos(c); })
      .catch((e) => setError(e instanceof Error ? e.message : "No se pudieron cargar los filtros."));
  }, []);

  useEffect(() => {
    getSeccionesAdmin({ anioLectivo: ciclo, sedeId: sedeId || undefined })
      .then((r) => {
        setSecciones(r.secciones);
        setCiclos([...new Set([anioActual, ...r.ciclos])].sort((a, b) => b - a));
        setSeccionId("");
      })
      .catch(() => setSecciones([]));
  }, [ciclo, sedeId, anioActual]);

  const sede = sedes.find((s) => s.sedeId === sedeId) ?? null;
  const seccionSeleccionada = secciones.find((s) => s.seccionId === seccionId);
  
  const catedraticosFiltrados = catedraticos.filter((c) => {
    const cumpleSede = !sede || c.sede === sede.nombre;
    const cumpleSeccion = !seccionSeleccionada || c.cursos.some((curso) => {
      return(
        curso.seccion === seccionSeleccionada.nombre ||
        curso.seccion.includes(seccionSeleccionada.nombre)
      );
    });
    return cumpleSede && cumpleSeccion;
  });

  async function generar(clave: Clave) {
    setGenerando(clave);
    setError("");
    try {
      if (clave === "seccion") await descargarReportePdf(`/api/reportes/alumnos-por-rango?seccionId=${seccionId}`, `alumnos-seccion-${seccionId}.pdf`);
      if (clave === "catedratico") await descargarReportePdf(`/api/reportes/notas-por-catedratico/${catedraticoId}`, `notas-catedratico-${catedraticoId}.pdf`);
      if (clave === "resumen") generarResumenSedePdf(await getDashboardSede(sedeId || undefined));
      if (clave === "carga") generarCargaHorariaPdf(catedraticosFiltrados, sede?.nombre ?? "Todas las sedes", ciclo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar el reporte.");
    } finally {
      setGenerando(null);
    }
  }

  const reportes: { clave: Clave; titulo: string; desc: string; tag: string; listo: boolean; falta?: string }[] = [
    { clave: "resumen", titulo: "Resumen de sede", desc: "Alumnos, aprobación por grado, pagos pendientes, becas y alumnos en riesgo.", tag: "Directivo", listo: true },
    { clave: "seccion", titulo: "Aprobados y reprobados por sección", desc: "Promedio de cada alumno de la sección, separados por resultado.", tag: "Académico", listo: !!seccionId, falta: "Elija una sección" },
    { clave: "catedratico", titulo: "Notas por catedrático", desc: "Notas por unidad de todos los cursos que imparte el docente.", tag: "Académico", listo: !!catedraticoId, falta: "Elija un catedrático" },
    { clave: "carga", titulo: "Carga horaria docente", desc: "Cursos asignados y horas semanales de cada catedrático.", tag: "Administrativo", listo: catedraticosFiltrados.length > 0 },
  ];

  return (
    <div className="space-y-6">
      <SectionHeader title="Reportería" subtitle="Informes académicos y administrativos por sede" />

      {error && <AlertBanner type="error" message={error} onClose={() => setError("")} />}

      <Card className="p-5">
        <h3 className="font-semibold text-stone-800 text-sm mb-4">Filtros</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Select label="Sede" value={sedeId} onChange={(e) => { setSedeId(e.target.value ? Number(e.target.value) : ""); setCatedraticoId(""); }}>
            <option value="">Todas las sedes</option>
            {sedes.map((s) => <option key={s.sedeId} value={s.sedeId}>{s.nombre}</option>)}
          </Select>
          <Select label="Ciclo escolar" value={ciclo} onChange={(e) => setCiclo(Number(e.target.value))}>
            {ciclos.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
          <Select label="Sección" value={seccionId} onChange={(e) => {setSeccionId(e.target.value ? Number(e.target.value) : ""); setCatedraticoId("");}}>
            <option value="">Seleccione…</option>
            {secciones.map((s) => <option key={s.seccionId} value={s.seccionId}>{s.grado.nombre} {s.nombre}{sedeId ? "" : ` · ${s.sede.nombre}`}</option>)}
          </Select>
          <Select label="Catedrático" value={catedraticoId} onChange={(e) => setCatedraticoId(e.target.value ? Number(e.target.value) : "")}>
            <option value="">Seleccione…</option>
            {catedraticosFiltrados.map((c) => <option key={c.catedraticoId} value={c.catedraticoId}>{c.nombre}</option>)}
          </Select>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {reportes.map((r) => (
          <Card key={r.clave} className="p-5 hover:shadow-sm transition-shadow flex flex-col">
            <Badge variant={r.tag === "Académico" ? "primary" : r.tag === "Directivo" ? "neutral" : "warning"} className="mb-3 self-start">{r.tag}</Badge>
            <h4 className="font-semibold text-stone-800 text-sm mb-1">{r.titulo}</h4>
            <p className="text-xs text-stone-500 mb-4 flex-1">{r.desc}</p>
            <Btn variant="outline" size="sm" className="w-full justify-center" icon={<Download className="w-3.5 h-3.5" />}
              disabled={!r.listo} loading={generando === r.clave} onClick={() => generar(r.clave)}>
              {r.listo ? "Generar PDF" : r.falta}
            </Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

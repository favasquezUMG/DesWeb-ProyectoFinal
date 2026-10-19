import { useState } from "react";
import { Users, TrendingUp, AlertTriangle, Award, Plus, Download, ChevronRight, MapPin, Edit, MoreVertical, ChevronDown } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import type { View } from "../types";
import { SEDES, METRICS_CONSOLIDADOS, MALLA_CNB } from "../data";
import { Card, MetricCard, SectionHeader, Btn, Badge, TH, TD, EmptyState } from "../components/Ui";
import UsuariosView from "./admin-sede/Usuarios";
import RolesView from "./admin-sede/Roles";
import { useEffect } from "react";
import { generarReporteConsolidadoPdf } from "@/lib/reporteDashboardPdf";
import { SedeDto, SedeMetricaDto, getSedes, getSedesMetricas, ConteoAlumnosDto, getConteoAlumnos, TasaAprobacionDTO,
  getTasaAprobacion, getMoraPagosMetrica,
  MetricaMoraDto,
  MetricaBecaDto,
  getBecasActivasMetrica,
  TendenciaNotasDto,
  getTendenciaNotas,
  BitacoraDto,
  getActividadReciente
} from "@/lib/api";

function DashboardConsolidado() {
  const [sedes, setSedes] = useState<SedeDto[]>([]);
  const [metricasSede, setMetricasSedes] = useState<SedeMetricaDto[]>([]);
  const [alumnosMetric, setAlumnosMetric] = useState<ConteoAlumnosDto | null>(null);
  const [aprobacionMetric, setAprobacionMetric] = useState<TasaAprobacionDTO | null>(null);
  const [moraMetric, setMoraMetric] = useState<MetricaMoraDto | null>(null);
  const [becasActivasMetric, setBecasActivasMetric] = useState<MetricaBecaDto | null>(null);
  const [tendenciaNotasMetric, setTendenciaNotasMetric] = useState<TendenciaNotasDto[]>([]);
  const [actividades, setActividades] = useState<BitacoraDto[]>([]);

  const trendData = METRICS_CONSOLIDADOS.meses.map((m, i) => ({
    mes: m, aprobacion: METRICS_CONSOLIDADOS.tendencia[i]
  }));

  const handleExportar = () => {
    generarReporteConsolidadoPdf({
      alumnos: alumnosMetric,
      aprobacion: aprobacionMetric,
      mora: moraMetric,
      becas: becasActivasMetric,
      tendencia: tendenciaNotasMetric,
      actividades,
    });
  };

  useEffect(() => {
    async function cargarConteo() {
      try {
        const data = await getConteoAlumnos();
        setAlumnosMetric(data);
      } catch (err) {
        console.error("Error al cargar conteo de alumnos:", err);
      }
    }
    cargarConteo();
  }, []);

  useEffect(() => {
    async function cargarSedes() {
      try{
        const data = await getSedes();
        setSedes(data);
      } catch (error) {
        console.error("Error al cargar datos desde el backend:", error)
      }
    }
    cargarSedes();
  
  }, [])

  useEffect(() => {
    async function cargarMetricas() {
      try {
        const data = await getSedesMetricas();
        setMetricasSedes(data);
      } catch (error) {
        console.error("Error al obtener métricas consolidadas:", error);
      }
    }
    cargarMetricas();
  }, []);

  useEffect(() => {
    async function cargarTasaAprobacion() {
      try {
        const data = await getTasaAprobacion();
        setAprobacionMetric(data);
      } catch (err) {
        console.error("Error al cargar tasa de aprobación:", err);
      }
    }
    cargarTasaAprobacion();
  }, []);

  useEffect(() => {
    async function cargarMoraMetric() {
      try {
        const data = await getMoraPagosMetrica();
        setMoraMetric(data);
      } catch (err) {
        console.error("Error al cargar métrica de mora:", err);
      }
    }
    cargarMoraMetric();
  }, []);

  useEffect(() => {
    async function cargarBecasActivasMetric() {
      try {
        const data = await getBecasActivasMetrica();
        setBecasActivasMetric(data);
      } catch (err) {
        console.error("Error al cargar las becas activas:", err);
      }
    }
    cargarBecasActivasMetric()
  }, []);

  useEffect(() => {
    async function cargarTendenciaNotas() {
      try {
        const data = await getTendenciaNotas();
        setTendenciaNotasMetric(data);
      } catch (err) {
        console.error("Error al cargar las tendencias de las notas:", err);
      }
    }
    cargarTendenciaNotas();
  }, []);

  useEffect(() => {
    async function cargarActividades() {
      try {
        const data = await getActividadReciente();
        setActividades(data);
      } catch (err) {
        console.error("Error al cargar las actividades recientes:", err);
      }
    }
    cargarActividades();
  }, []);

  // Mapeamos las sedes obtenidas del backend al formato que consume BarChart
  const sedeData = metricasSede.map((s) => ({
    sede: s.nombre.replace("Sede ", ""), // Nombre limpio para el eje X
    alumnos: s.alumnos,
    aprobacion: s.aprobacion,
    mora: s.mora,
  }));

  const anioActual = new Date().getFullYear(); // 2026
  const colores = [
    "bg-success-600", // Verde
    "bg-info-600",    // Azul
    "bg-warning-600", // Naranja / Amarillo
    "bg-primary-600", // Púrpura / Primario
    "bg-stone-400"    // Gris
  ];

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Consolidado General"
        subtitle={`Ciclo escolar ${anioActual} · Todas las sedes`}
        action={
          <div className="flex gap-2">
            <Btn variant="outline" size="sm" icon={<Download className="w-4 h-4"/>} onClick={handleExportar}>Exportar</Btn>
          </div>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total alumnos"
          value={alumnosMetric ? alumnosMetric.total.toLocaleString() : "..."}
          sub={alumnosMetric ? alumnosMetric.subtexto : "Cargando..."}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard label="Tasa de aprobación"
          value={aprobacionMetric ? `${aprobacionMetric.tasaAprobacion}%` : "..."} 
          sub={aprobacionMetric ? `${aprobacionMetric.subtexto}` : "Cargando..."} 
          icon={<TrendingUp className="w-5 h-5" />}
          variant="success"
        />
        <MetricCard label="En mora de pagos"
          value={moraMetric ? `${moraMetric.porcentajeMora}` : "..."}
          sub={moraMetric ? `${moraMetric.subtexto}` : "Cargando..."}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
        />
        <MetricCard label="Becas activas"
          value={becasActivasMetric ? `${becasActivasMetric.becasActivas}` : "..." } 
          sub={becasActivasMetric ? `${becasActivasMetric.subtexto}` : "Cargando..."}
          icon={<Award className="w-5 h-5" />}
          variant="default" 
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Rendimiento Académico (Toma 2 columnas y ocupa el 100% de la altura) */}
        <Card className="lg:col-span-2 p-5 flex flex-col h-full">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">
            Rendimiento Académico Promedio
          </h3>
          {/* flex-1 y min-h-[280px] fuerzan al gráfico a estirarse al alto de la Card vecina */}
          <div className="flex-1 min-h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tendenciaNotasMetric}>
                <defs>
                  <linearGradient id="colorAp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1a3929" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#1a3929" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${value} pts`, "Promedio"]} />
                <Area type="monotone" dataKey="promedio" stroke="#1a3929" strokeWidth={2} fill="url(#colorAp)" name="Promedio" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Actividad Reciente (Toma 1 columna, altura delimitada y scroll elegante) */}
        <Card className="p-5 flex flex-col h-full">
          <h3 className="font-display font-semibold text-stone-800 text-base mb-4">
            Actividad reciente
          </h3>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 flex-1">
            {actividades.map((act, i) => {
              const color = colores[act.id % colores.length] || colores[i % colores.length];

              return (
                <div key={act.id} className="flex items-start gap-2.5 text-sm pb-1 border-b border-stone-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    {/* line-clamp-2 recorta a máximo 2 líneas para evitar tarjetas gigantes */}
                    <p className="font-medium text-stone-800 text-xs leading-snug line-clamp-2">
                      {act.detalle}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-stone-400 mt-0.5">
                      <span className="font-semibold text-stone-600 truncate max-w-[100px]">
                        {act.usuario}
                      </span>
                      <span>•</span>
                      <span>{new Date(act.fecha).toLocaleDateString("es-GT")}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Sedes comparison */}
      <Card className="p-5">
        <h3 className="font-display font-semibold text-stone-800 text-base mb-4">Comparativa por sede</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sedeData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
            <XAxis dataKey="sede" tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#78716c" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid #e7e5e4", borderRadius: "8px", fontSize: "12px" }} />
            <Legend iconType="circle" iconSize={8} />
            <Bar dataKey="alumnos" name="Alumnos" fill="#1a3929" radius={[3, 3, 0, 0]} />
            <Bar dataKey="aprobacion" name="Aprobación %" fill="#c4560a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function SedesView() {
  const [showNew, setShowNew] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader title="Sedes" subtitle="Administre las sedes del colegio"
        action={<Btn variant="primary" size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowNew(true)}>Agregar sede</Btn>}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {SEDES.map(sede => (
          <Card key={sede.id} className="p-5 hover:shadow-sm transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="font-display font-semibold text-stone-900">{sede.nombre}</h3>
                <p className="flex items-center gap-1 text-xs text-stone-500 mt-0.5"><MapPin className="w-3 h-3" />{sede.ciudad}</p>
              </div>
              <button className="p-1 text-stone-400 hover:text-stone-600 rounded transition-colors"><MoreVertical className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-500">Alumnos</p>
                <p className="font-mono-data font-semibold text-stone-900 text-xl">{sede.alumnos.toLocaleString()}</p>
              </div>
              <div className="bg-stone-50 rounded-lg p-3">
                <p className="text-xs text-stone-500">Catedráticos</p>
                <p className="font-mono-data font-semibold text-stone-900 text-xl">{sede.catedraticos}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 mb-2">
              <span>Tasa de aprobación</span>
              <span className="font-mono-data font-semibold text-success-700">{sede.aprobacion}%</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-1.5 mb-4">
              <div className="bg-success-600 h-1.5 rounded-full" style={{ width: `${sede.aprobacion}%` }} />
            </div>
            <div className="flex gap-2">
              <Btn variant="outline" size="sm" className="flex-1 justify-center" icon={<Edit className="w-3.5 h-3.5" />}>Editar</Btn>
              <Btn variant="ghost" size="sm" className="flex-1 justify-center" icon={<ChevronRight className="w-3.5 h-3.5" />}>Ver detalle</Btn>
            </div>
          </Card>
        ))}

        {/* New sede card */}
        <button onClick={() => setShowNew(true)}
          className="border-2 border-dashed border-stone-300 rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-stone-400 hover:border-primary-400 hover:text-primary-600 hover:bg-primary-50 transition-all min-h-48 cursor-pointer">
          <Plus className="w-8 h-8" />
          <span className="text-sm font-medium">Agregar sede</span>
        </button>
      </div>

      {showNew && (
        <Card className="p-6 border-2 border-primary-200">
          <h3 className="font-display font-semibold text-stone-900 mb-4">Nueva sede</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div><label className="text-sm font-medium text-stone-700 block mb-1">Nombre de la sede</label>
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" placeholder="Ej. Sede Escuintla" /></div>
            <div><label className="text-sm font-medium text-stone-700 block mb-1">Ciudad / Municipio</label>
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" placeholder="Ej. Escuintla, Guatemala" /></div>
            <div><label className="text-sm font-medium text-stone-700 block mb-1">Dirección</label>
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" placeholder="Calle / Zona / Colonia" /></div>
            <div><label className="text-sm font-medium text-stone-700 block mb-1">Teléfono de contacto</label>
              <input className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700" placeholder="(502) 2XXX-XXXX" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Btn variant="outline" size="sm" onClick={() => setShowNew(false)}>Cancelar</Btn>
            <Btn variant="primary" size="sm" onClick={() => setShowNew(false)}>Guardar sede</Btn>
          </div>
        </Card>
      )}
    </div>
  );
}

function MallaCurricular() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["bas"]));

  function toggle(id: string) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const nivelColors: Record<string, string> = {
    pre: "bg-purple-100 text-purple-800",
    pri: "bg-info-100 text-info-800",
    bas: "bg-primary-100 text-primary-800",
    div: "bg-action-100 text-action-800",
  };

  return (
    <div className="space-y-6">
      <SectionHeader title="Malla Curricular Base" subtitle="Currículo Nacional Base (CNB) — MINEDUC. Modificable por cada sede."
        action={<Btn variant="outline" size="sm" icon={<Download className="w-4 h-4" />}>Exportar malla</Btn>}
      />

      <div className="space-y-3">
        {MALLA_CNB.map(nivel => (
          <Card key={nivel.id} className="overflow-hidden">
            <button
              onClick={() => toggle(nivel.id)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-stone-50 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${nivelColors[nivel.id]}`}>{nivel.nivel}</span>
                <span className="text-sm text-stone-500">{nivel.grados.length} grados · {nivel.grados.reduce((a, g) => a + g.cursos.length, 0)} cursos del CNB</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform ${expanded.has(nivel.id) ? "rotate-180" : ""}`} />
            </button>

            {expanded.has(nivel.id) && (
              <div className="border-t border-stone-100 divide-y divide-stone-50">
                {nivel.grados.map(grado => (
                  <div key={grado.nombre} className="px-5 py-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-stone-800 text-sm">{grado.nombre}</h4>
                      <Btn variant="ghost" size="sm" icon={<Plus className="w-3 h-3" />}>Agregar curso propio</Btn>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {grado.cursos.map(curso => (
                        <span key={curso} className="px-2.5 py-1 text-xs bg-stone-100 text-stone-700 rounded-full border border-stone-200">{curso}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}

function Reporteria() {
  const [sede, setSede] = useState("todas");
  const [ciclo, setCiclo] = useState("2025");
  const [grado, setGrado] = useState("todos");

  return (
    <div className="space-y-6">
      <SectionHeader title="Reportería Consolidada" subtitle="Generación de informes académicos y financieros por sede"
        action={<Btn variant="secondary" size="sm" icon={<Download className="w-4 h-4" />}>Descargar PDF</Btn>}
      />

      <Card className="p-5">
        <h3 className="font-semibold text-stone-800 text-sm mb-4">Filtros de reporte</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">Sede</label>
            <select value={sede} onChange={e => setSede(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
              <option value="todas">Todas las sedes</option>
              <option value="central">Sede Central</option>
              <option value="xela">Sede Xela</option>
              <option value="coat">Sede Coatepeque</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">Ciclo escolar</label>
            <select value={ciclo} onChange={e => setCiclo(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-stone-500 block mb-1">Grado</label>
            <select value={grado} onChange={e => setGrado(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-700">
              <option value="todos">Todos los grados</option>
              <option value="1ro">Primero Básico</option>
              <option value="2do">Segundo Básico</option>
              <option value="3ro">Tercero Básico</option>
            </select>
          </div>
          <div className="flex items-end">
            <Btn variant="primary" size="md" className="w-full justify-center">Generar reporte</Btn>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { title: "Reporte de Aprobación por Grado", desc: "Tasas de aprobación y reprobación desglosadas por grado y sección.", tag: "Académico" },
          { title: "Estado de Cuenta General", desc: "Pagos recibidos, saldos pendientes y mora por alumno.", tag: "Financiero" },
          { title: "Asistencia Global", desc: "Porcentaje de asistencia por alumno y por curso.", tag: "Académico" },
          { title: "Becas Otorgadas", desc: "Listado completo de becas, montos y criterios de asignación.", tag: "Financiero" },
          { title: "Carga Horaria por Catedrático", desc: "Horas semanales y cursos asignados por docente.", tag: "Académico" },
          { title: "Resumen Ejecutivo", desc: "Informe consolidado para presentar a Junta Directiva.", tag: "Directivo" },
        ].map(r => (
          <Card key={r.title} className="p-5 hover:shadow-sm transition-shadow">
            <Badge variant={r.tag === "Académico" ? "primary" : r.tag === "Financiero" ? "warning" : "neutral"} className="mb-3">{r.tag}</Badge>
            <h4 className="font-semibold text-stone-800 text-sm mb-1">{r.title}</h4>
            <p className="text-xs text-stone-500 mb-4">{r.desc}</p>
            <Btn variant="outline" size="sm" className="w-full justify-center" icon={<Download className="w-3.5 h-3.5" />}>Descargar PDF</Btn>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function AdminGeneral({ view }: { view: View }) {
  if (view === "ag-sedes") return <SedesView />;
  if (view === "as-usuarios") return <UsuariosView />;
  if (view === "as-roles") return <RolesView />;
  if (view === "ag-malla") return <MallaCurricular />;
  if (view === "ag-reporteria") return <Reporteria />;
  return <DashboardConsolidado />;
}

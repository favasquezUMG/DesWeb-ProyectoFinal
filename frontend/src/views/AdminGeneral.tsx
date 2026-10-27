import { useState } from "react";
import { Users, TrendingUp, AlertTriangle, Award, Plus, Download, ChevronRight, MapPin, Edit, MoreVertical, ChevronDown } from "../components/Iconos";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from "recharts";
import type { View } from "../types";
import { Card, MetricCard, SectionHeader, Btn, Badge, TH, TD, EmptyState } from "../components/Ui";
import UsuariosView from "./admin-sede/Usuarios";
import RolesView from "./admin-sede/Roles";
import SolicitudesView from "./admin-sede/Solicitudes";
import PagosVentanillaView from "./admin-sede/PagosVentanilla";
import SedesView from "./admin-general/Sedes";
import MallaCurricular from "./admin-general/Malla";
import Reporteria from "./admin-general/Reporteria";
import CalendarioView from "./admin-sede/Calendario";
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

  const sedeData = metricasSede.map((s) => ({
    sede: s.nombre.replace("Sede ", ""), // Nombre limpio para el eje X
    alumnos: s.alumnos,
    aprobacion: s.aprobacion,
    mora: s.mora,
  }));

  const anioActual = new Date().getFullYear();
  const colores = [
    "bg-success-600",
    "bg-info-600",
    "bg-warning-600",
    "bg-primary-600",
    "bg-stone-400"
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

      {/* Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Total alumnos"
          value={alumnosMetric?.total.toLocaleString() ?? ""}
          sub={alumnosMetric?.subtexto} cargando={!alumnosMetric}
          icon={<Users className="w-5 h-5" />}
        />
        <MetricCard label="Tasa de aprobación"
          value={aprobacionMetric ? `${aprobacionMetric.tasaAprobacion}%` : ""}
          sub={aprobacionMetric?.subtexto} cargando={!aprobacionMetric}
          icon={<TrendingUp className="w-5 h-5" />}
          variant="success"
        />
        <MetricCard label="En mora de pagos"
          value={moraMetric ? `${moraMetric.porcentajeMora}` : ""}
          sub={moraMetric?.subtexto} cargando={!moraMetric}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="warning"
        />
        <MetricCard label="Becas activas"
          value={becasActivasMetric ? `${becasActivasMetric.becasActivas}` : ""}
          sub={becasActivasMetric?.subtexto} cargando={!becasActivasMetric}
          icon={<Award className="w-5 h-5" />}
          variant="default" 
        />
      </div>

      {/* Gráficas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {/* Rendimiento Académico */}
        <Card className="lg:col-span-2 p-5 flex flex-col h-full">
          <h3 className="font-display font-bold text-stone-900 text-lg mb-4">
            Rendimiento Académico Promedio
          </h3>
          <div className="flex-1 min-h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tendenciaNotasMetric}>
                <defs>
                  <linearGradient id="colorAp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2b3a8c" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#2b3a8c" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd2" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#786f63" }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#786f63" }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(value) => [`${value} pts`, "Promedio"]} />
                <Area type="monotone" dataKey="promedio" stroke="#2b3a8c" strokeWidth={2} fill="url(#colorAp)" name="Promedio" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Actividad Reciente */}
        <Card className="p-5 flex flex-col h-full">
          <h3 className="font-display font-bold text-stone-900 text-lg mb-4">
            Actividad reciente
          </h3>
          <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1 flex-1">
            {actividades.map((act, i) => {
              const color = colores[act.id % colores.length] || colores[i % colores.length];

              return (
                <div key={act.id} className="flex items-start gap-2.5 text-sm pb-1 border-b border-stone-50 last:border-0">
                  <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-stone-800 text-xs leading-snug line-clamp-2">
                      {act.detalle}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-stone-400 mt-0.5">
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

      {/* Comparación de sedes */}
      <Card className="p-5">
        <h3 className="font-display font-bold text-stone-900 text-lg mb-4">Comparativa por sede</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={sedeData} barSize={28}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e6dfd2" />
            <XAxis dataKey="sede" tick={{ fontSize: 11, fill: "#786f63" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#786f63" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ border: "1px solid #e6dfd2", borderRadius: "12px", fontSize: "12px" }} />
            <Legend iconType="circle" iconSize={8} />
            <Bar dataKey="alumnos" name="Alumnos" fill="#2b3a8c" radius={[3, 3, 0, 0]} />
            <Bar dataKey="aprobacion" name="Aprobación %" fill="#b3202a" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

export default function AdminGeneral({ view }: { view: View }) {
  if (view === "ag-sedes") return <SedesView />;
  if (view === "as-usuarios") return <UsuariosView />;
  if (view === "as-roles") return <RolesView />;
  if (view === "as-solicitudes") return <SolicitudesView />;
  if (view === "as-calendario") return <CalendarioView esGlobal />;
  if (view === "as-pagos") return <PagosVentanillaView />;
  if (view === "ag-malla") return <MallaCurricular />;
  if (view === "ag-reporteria") return <Reporteria />;
  return <DashboardConsolidado />;
}

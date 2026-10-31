import { lazy, Suspense, useEffect, useState } from "react";
import {
  MapPin, Phone, Menu, X, FileSearch, ClipboardEdit, Avanzar,
} from "../components/iconos/publicos";
import { Btn, Skeleton } from "../components/Ui";
import { getInfoInicio, type InfoInicioDto } from "../lib/api";

const RecorridoVirtual = lazy(() => import("../components/RecorridoVirtual"));

export type Portal = "estudiante" | "personal";

interface HomeProps {
  onLogin: (portal: Portal) => void;
  onSolicitud: () => void;
  onConsulta: () => void;
}

const NAV_LINKS = [
  { label: "Nosotros", href: "#nosotros" },
  { label: "Niveles", href: "#niveles" },
  { label: "Recorrido", href: "#recorrido" },
  { label: "Sedes", href: "#sedes" },
  { label: "Admisiones", href: "#admisiones" },
  { label: "Contacto", href: "#contacto" },
];

// Textos descriptivos por nivel; los niveles y grados vienen de la base de datos
const DESCRIPCION_NIVEL: Record<string, string> = {
  Preprimaria: "Aprendizaje a través del juego: lenguaje, motricidad, convivencia y hábitos para empezar la escuela con confianza.",
  Primaria: "Bases sólidas en lectura, matemática y ciencias, con grupos reducidos y acompañamiento personalizado.",
  "Básico": "Desarrollo del pensamiento crítico, trabajo en equipo y orientación vocacional temprana.",
  Diversificado: "Preparación universitaria, proyectos de investigación y prácticas con enfoque profesional.",
};

// Teléfono para los datos estructurados: los de 8 dígitos son de Guatemala
const internacional = (telefono: string) => (/^\d{8}$/.test(telefono) ? `+502 ${telefono}` : telefono);

function formatearTelefono(telefono: string | null): string | null {
  if (!telefono) return null;
  return /^\d{8}$/.test(telefono) ? `${telefono.slice(0, 4)}-${telefono.slice(4)}` : telefono;
}

function rangoGrados(grados: string[]): string {
  if (grados.length <= 1) return grados[0] ?? "";
  return `${grados[0]} a ${grados[grados.length - 1]}`;
}

export default function Home({ onLogin, onSolicitud, onConsulta }: HomeProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [info, setInfo] = useState<InfoInicioDto | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recorridoAbierto, setRecorridoAbierto] = useState(false);

  useEffect(() => {
    getInfoInicio()
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const sedes = info?.sedes ?? [];
  const niveles = info?.niveles ?? [];
  const totalGrados = niveles.reduce((total, n) => total + n.grados.length, 0);
  const rangoNiveles = niveles.length > 1
    ? `de ${niveles[0].nivel} a ${niveles[niveles.length - 1].nivel}`
    : niveles.length === 1 ? `de ${niveles[0].nivel}` : "";

  // Agrega las sedes a los datos estructurados de index.html (las sedes viven en la base de datos)
  useEffect(() => {
    const script = document.getElementById("datos-colegio");
    if (!script || !info?.sedes.length) return;
    try {
      const datos = JSON.parse(script.textContent ?? "{}");
      datos.department = info.sedes.map((s) => ({
        "@type": "School",
        name: `Colegio Vanguardia, ${s.nombre}`,
        ...(s.direccion ? { address: { "@type": "PostalAddress", streetAddress: s.direccion, addressCountry: "GT" } } : {}),
        ...(s.telefono ? { telephone: internacional(s.telefono) } : {}),
      }));
      const telefono = info.sedes.find((s) => s.telefono)?.telefono;
      if (telefono) datos.telephone = internacional(telefono);
      script.textContent = JSON.stringify(datos);
    } catch {
      // Si el JSON no se puede leer se deja como vino en el HTML
    }
  }, [info]);

  return (
    <div className="min-h-screen bg-sand-100 text-stone-900">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-sand-100/95 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-[72px] flex items-center justify-between gap-4">
          <a href="#inicio" className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-[14px] bg-action-500 text-white flex items-center justify-center font-display font-extrabold text-xl rotate-[-4deg] shrink-0">V</span>
            <span className="leading-tight">
              <span className="block font-display font-bold text-lg">Colegio Vanguardia</span>
              <span className="block text-stone-500 text-xs font-medium">Portal académico</span>
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-7 text-[15px] font-semibold text-stone-600">
            {NAV_LINKS.map(l => <a key={l.href} href={l.href} className="hover:text-stone-900 transition-colors">{l.label}</a>)}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <button type="button" onClick={() => onLogin("estudiante")} className="px-5 py-2.5 rounded-full bg-stone-900 text-white text-sm font-bold hover:bg-anil-800 transition-colors cursor-pointer">
              Iniciar sesión
            </button>
          </div>

          <button type="button" className="md:hidden w-10 h-10 -mr-1 rounded-full flex items-center justify-center bg-white border-[1.5px] border-stone-200" onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menú">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden px-4 pb-4 space-y-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block px-3 py-2.5 rounded-2xl text-[15px] font-semibold text-stone-700 hover:bg-white">{l.label}</a>
            ))}
            <Btn variant="primary" size="md" className="w-full justify-center mt-2" onClick={() => onLogin("estudiante")}>Iniciar sesión</Btn>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="inicio" className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-16 pb-16">
        <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-7">
            <h1 className="font-display font-extrabold text-[2.9rem] sm:text-6xl lg:text-[4.6rem] leading-[0.98] tracking-tight">
              De Preprimaria a Diversificado
            </h1>
            <p className="text-stone-600 mt-6 text-lg leading-relaxed max-w-xl">
              Colegio Vanguardia{sedes.length > 0 ? `, con ${sedes.length} ${sedes.length === 1 ? "sede" : "sedes"} en Guatemala` : ", en Guatemala"}.
              Notas, tareas, horario, asistencia y pagos de cada alumno se consultan en línea, en el mismo portal para alumnos, familias y docentes.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Btn variant="secondary" size="lg" onClick={onSolicitud} icon={<ClipboardEdit className="w-5 h-5" />}>Solicitar inscripción</Btn>
              <a href="#nosotros" className="inline-flex items-center px-6 py-3 rounded-full border-[1.5px] border-stone-300 text-[15px] font-semibold text-stone-800 hover:border-stone-900 transition-colors">
                Conocer el colegio
              </a>
            </div>
          </div>

          {/* Horario de colores: el sello visual del colegio */}
          <div className="lg:col-span-5" aria-hidden="true">
            <div className="relative mx-auto max-w-md">
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Matemática", "bg-anil-math", "rotate-[-3deg]"], ["Lenguaje", "bg-subject-language", "rotate-[2deg] translate-y-4"], ["Ciencias", "bg-subject-science", "rotate-[-1deg]"],
                  ["Sociales", "bg-subject-social", "rotate-[2deg]"], ["Inglés", "bg-subject-english", "rotate-[-2deg] translate-y-4"], ["Arte", "bg-subject-arts", "rotate-[3deg]"],
                ].map(([n, bg, t]) => (
                  <div key={n} className={`aspect-square rounded-[26px] ${bg} ${t} p-4 flex flex-col justify-between textile-pattern ${n === "Sociales" ? "text-stone-900" : "text-white"}`}>
                    <span className="font-display font-extrabold text-5xl leading-none">{n.charAt(0)}</span>
                    <span className="text-sm font-bold">{n}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className="scroll-mt-20 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-7">
              <SectionTitle titulo="Quiénes somos" texto="Acompañamos a cada alumno desde sus primeros años hasta la universidad, de la mano de su familia y de docentes que lo conocen por su nombre." />
            </div>
            {(sedes.length > 0 || niveles.length > 0) && (
              <dl className="lg:col-span-5 grid grid-cols-3 gap-3">
                {sedes.length > 0 && (
                  <Dato valor={sedes.length} texto={sedes.length === 1 ? "sede" : "sedes"} />
                )}
                {niveles.length > 0 && (
                  <Dato valor={niveles.length} texto={niveles.length === 1 ? "nivel" : "niveles"} />
                )}
                {totalGrados > 0 && (
                  <Dato valor={totalGrados} texto={totalGrados === 1 ? "grado" : "grados"} />
                )}
              </dl>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-12">
            <article className="relative overflow-hidden rounded-[28px] bg-anil-800 textile-pattern text-white p-8 sm:p-10 flex flex-col">
              <h3 className="font-display text-3xl font-bold">Misión</h3>
              <p className="text-[17px] text-white/80 leading-relaxed mt-3 max-w-md">
                Brindar una educación integral y de calidad que desarrolle las capacidades académicas, humanas y
                sociales de nuestros alumnos, en alianza con las familias y con el apoyo de docentes comprometidos.
              </p>
            </article>
            <article className="relative overflow-hidden rounded-[28px] bg-subject-social text-stone-900 p-8 sm:p-10 flex flex-col">
              <h3 className="font-display text-3xl font-bold">Visión</h3>
              <p className="text-[17px] text-stone-800 leading-relaxed mt-3 max-w-md">
                Ser la red de colegios referente en Guatemala por su excelencia académica, su innovación
                pedagógica y la formación de ciudadanos responsables con su comunidad.
              </p>
            </article>
          </div>

        </div>
      </section>

      {/* Niveles */}
      <section id="niveles" className="scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionTitle titulo="Niveles que impartimos" texto="Un camino completo, desde los primeros años hasta la preparación para la universidad." />
          <EstadoCarga cargando={cargando} error={error} vacio={!!info && niveles.length === 0} textoVacio="Aún no hay niveles registrados." />
          <ol className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
            {niveles.map((n, i) => (
              <li key={n.nivel} className="relative rounded-[24px] bg-white border border-stone-200/80 p-6 pt-8 flex flex-col overflow-hidden">
                <span className={`absolute top-0 left-0 right-0 h-2 ${["bg-subject-social", "bg-subject-science", "bg-subject-math", "bg-subject-english"][i % 4]}`} />
                <h3 className="font-display text-[1.7rem] leading-tight font-bold">{n.nivel}</h3>
                <p className="text-sm font-semibold text-primary-700 mt-1">{rangoGrados(n.grados)}</p>
                <p className="text-[15px] text-stone-600 leading-relaxed mt-4">
                  {DESCRIPCION_NIVEL[n.nivel] ?? `${n.grados.length} ${n.grados.length === 1 ? "grado" : "grados"}: ${n.grados.join(", ")}.`}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Recorrido virtual */}
      <section id="recorrido" className="scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
          <SectionTitle titulo="Recorra el colegio desde casa" texto="Camine por la recepción, las aulas, el laboratorio, la biblioteca y la cancha como si estuviera aquí. Arrastre para mirar alrededor y use las flechas para avanzar." />
          <div className="mt-10">
            {recorridoAbierto ? (
              <Suspense fallback={<div className="w-full h-[68vh] min-h-[420px] max-h-[720px] rounded-[28px] bg-stone-900" />}>
                <RecorridoVirtual />
              </Suspense>
            ) : (
              <button type="button" onClick={() => setRecorridoAbierto(true)}
                className="group relative w-full h-[340px] sm:h-[420px] rounded-[28px] overflow-hidden bg-anil-800 textile-pattern text-white text-left cursor-pointer">
                <PortadaRecorrido />
                <span className="absolute inset-x-0 bottom-0 p-6 sm:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-5 bg-gradient-to-t from-stone-900/80 to-transparent">
                  <span>
                    <span className="block font-display text-3xl sm:text-4xl font-bold leading-tight">9 espacios en 360°</span>
                    <span className="block text-white/75 text-[15px] mt-1">De la entrada a la cancha, en computadora o en celular.</span>
                  </span>
                  <span className="inline-flex items-center gap-2 self-start sm:self-auto px-6 py-3 rounded-full bg-action-500 group-hover:bg-action-600 transition-colors font-bold">
                    Iniciar recorrido<Avanzar className="w-4 h-4 rotate-90" />
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Sedes */}
      <section id="sedes" className="scroll-mt-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <SectionTitle titulo="Nuestras sedes" texto="Visítenos en la sede más cercana. En todas puede solicitar información e inscribir a sus hijos." />
          <EstadoCarga cargando={cargando} error={error} vacio={!!info && sedes.length === 0} textoVacio="Aún no hay sedes registradas." />
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-10">
            {sedes.map((s, i) => {
              const tono = TONOS_SEDE[i % TONOS_SEDE.length];
              return (
                <li key={s.sedeId} className="rounded-[26px] border border-stone-200/80 bg-white overflow-hidden flex flex-col">
                  <div className={`${tono.fondo} ${tono.texto} px-6 pt-10 pb-6`}>
                    <h3 className="font-display text-[1.9rem] font-bold leading-tight">{s.nombre}</h3>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    {s.direccion && (
                      <p className="text-[15px] text-stone-600 flex items-start gap-2 leading-snug">
                        <MapPin className="w-5 h-5 text-action-600 shrink-0" />{s.direccion}
                      </p>
                    )}
                    {s.telefono && (
                      <p className="text-[15px] font-semibold text-stone-800 flex items-center gap-2 mt-2 tabular-nums">
                        <Phone className="w-5 h-5 text-action-600 shrink-0" />{formatearTelefono(s.telefono)}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Admisiones */}
      <section id="admisiones" className="scroll-mt-20 px-4 sm:px-6 py-20">
        <div className="max-w-6xl mx-auto rounded-[32px] bg-anil-800 textile-pattern text-white p-8 sm:p-12 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h2 className="font-display text-4xl sm:text-5xl font-bold leading-[1.05]">Inscripciones abiertas</h2>
            <p className="text-white/75 mt-5 text-[17px] leading-relaxed">
              Complete la solicitud en línea, adjunte los documentos del alumno y reciba una constancia con su
              número de solicitud. Le notificaremos por correo en un plazo máximo de 5 días hábiles.
            </p>
          </div>
          <div className="space-y-3">
            <button type="button" onClick={onSolicitud}
              className="w-full flex items-center gap-4 p-5 rounded-[22px] bg-action-500 text-left hover:bg-action-600 transition-colors cursor-pointer">
              <span className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0"><ClipboardEdit className="w-5 h-5" /></span>
              <span className="flex-1">
                <span className="block font-display text-xl font-bold">Solicitar inscripción</span>
                <span className="block text-sm text-white/85">Primer ingreso de un alumno al colegio</span>
              </span>
            </button>
            <button type="button" onClick={onConsulta}
              className="w-full flex items-center gap-4 p-5 rounded-[22px] bg-white/10 text-left hover:bg-white/15 transition-colors cursor-pointer">
              <span className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0"><FileSearch className="w-5 h-5" /></span>
              <span className="flex-1">
                <span className="block font-display text-xl font-bold">Consultar estado de solicitud</span>
                <span className="block text-sm text-white/70">Con su número de solicitud o DPI y correo</span>
              </span>
            </button>
          </div>
        </div>
      </section>

      {/* Pie con el contacto: es donde se busca la dirección y el teléfono */}
      <footer id="contacto" className="scroll-mt-20 bg-stone-900 text-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-4">
            <div className="flex items-center gap-3">
              <span className="w-9 h-9 rounded-xl bg-action-500 text-white flex items-center justify-center font-display font-extrabold rotate-[-4deg]">V</span>
              <p className="font-display font-bold text-white text-lg">Colegio Vanguardia</p>
            </div>
            <dl className="mt-6 space-y-3 text-[15px]">
              <div>
                <dt className="text-xs font-semibold text-white/50">Correo</dt>
                <dd><a href="mailto:info@colegiovanguardia.edu.gt" className="text-white font-semibold hover:underline [overflow-wrap:anywhere]">info@colegiovanguardia.edu.gt</a></dd>
              </div>
              <div>
                <dt className="text-xs font-semibold text-white/50">Horario de atención</dt>
                <dd className="text-white">Lunes a viernes, de 7:00 a 15:00</dd>
              </div>
            </dl>
          </div>
          {sedes.length > 0 && (
            <div className="md:col-span-8">
              <h2 className="text-xs font-semibold text-white/50">Sedes</h2>
              <ul className="mt-3 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-[15px]">
                {sedes.map((s) => (
                  <li key={s.sedeId}>
                    <p className="font-semibold text-white">{s.nombre}</p>
                    {s.direccion && <p className="leading-snug">{s.direccion}</p>}
                    {s.telefono && <a href={`tel:${internacional(s.telefono).replace(/\s/g, "")}`} className="tabular-nums hover:text-white">{formatearTelefono(s.telefono)}</a>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="border-t border-white/10">
          <p className="max-w-6xl mx-auto px-4 sm:px-6 py-5 text-xs text-white/50">© {new Date().getFullYear()} Colegio Vanguardia</p>
        </div>
      </footer>
    </div>
  );
}

const TONOS_SEDE = [
  { fondo: "bg-anil-800", texto: "text-white" },
  { fondo: "bg-action-600", texto: "text-white" },
  { fondo: "bg-success-600", texto: "text-white" },
  { fondo: "bg-subject-social", texto: "text-stone-900" },
];

/** Ilustración de la portada del recorrido: pasillo en perspectiva con flechas en el piso */
function PortadaRecorrido() {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 800 420" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <path d="M0 0 L330 150 L470 150 L800 0 Z" fill="rgba(255,255,255,0.06)" />
      <path d="M0 420 L330 250 L470 250 L800 420 Z" fill="rgba(255,255,255,0.1)" />
      <rect x="330" y="150" width="140" height="100" fill="rgba(242,183,5,0.85)" />
      <g stroke="rgba(255,255,255,0.22)" strokeWidth="2">
        <path d="M0 0 L330 150 M800 0 L470 150 M0 420 L330 250 M800 420 L470 250" />
        <path d="M120 55 V365 M220 100 V310 M290 132 V268 M680 55 V365 M580 100 V310 M510 132 V268" />
      </g>
      <g fill="#ffffff">
        <path d="M400 268 L440 300 L418 300 L418 330 L382 330 L382 300 L360 300 Z" opacity="0.95" />
        <path d="M400 222 L418 236 L408 236 L408 248 L392 248 L392 236 L382 236 Z" opacity="0.6" />
      </g>
    </svg>
  );
}

function SectionTitle({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-4xl sm:text-[2.75rem] leading-[1.05] font-bold text-stone-900">{titulo}</h2>
      {texto && <p className="text-[17px] text-stone-600 mt-3 leading-relaxed">{texto}</p>}
    </div>
  );
}

function EstadoCarga({ cargando, error, vacio, textoVacio }: { cargando: boolean; error: string | null; vacio: boolean; textoVacio: string }) {
  if (cargando) {
    return (
      <div role="status" className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-10">
        <span className="sr-only">Cargando…</span>
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className={`h-48 rounded-[24px] ${i > 1 ? "hidden lg:block" : i > 0 ? "hidden sm:block" : ""}`} />)}
      </div>
    );
  }
  if (error) return <p className="text-sm text-danger-700 mt-8">{error}</p>;
  if (vacio) return <p className="text-sm text-stone-500 mt-8">{textoVacio}</p>;
  return null;
}

function Dato({ valor, texto }: { valor: number | string; texto: string }) {
  return (
    // El número se ve arriba, pero el lector de pantalla lee primero la etiqueta (dt antes de dd)
    <div className="rounded-[22px] bg-sand-100 px-5 py-4 flex flex-col-reverse">
      <dt className="text-sm font-semibold text-stone-600 mt-2 leading-snug">{texto}</dt>
      <dd className="font-display font-extrabold text-5xl leading-none tabular-nums text-primary-800">{valor}</dd>
    </div>
  );
}

import { useEffect, useState } from "react";
import {
  GraduationCap, Users2, ShieldCheck, MapPin, Phone, Mail, Clock,
  Award, Heart, Lightbulb, Menu, X, FileSearch, ClipboardEdit,
  Target, Binoculars, School,
} from "../components/Iconos";
import { Btn } from "../components/Ui";
import { getInfoInicio, type InfoInicioDto } from "../lib/api";

export type Portal = "estudiante" | "personal";

interface HomeProps {
  onLogin: (portal: Portal) => void;
  onSolicitud: () => void;
  onConsulta: () => void;
}

const NAV_LINKS = [
  { label: "Nosotros", href: "#nosotros" },
  { label: "Niveles", href: "#niveles" },
  { label: "Sedes", href: "#sedes" },
  { label: "Admisiones", href: "#admisiones" },
  { label: "Contacto", href: "#contacto" },
];

const VALORES = [
  { Icon: Award, titulo: "Excelencia", texto: "Exigencia académica acompañada de seguimiento cercano a cada alumno." },
  { Icon: Heart, titulo: "Formación integral", texto: "Valores, deporte, arte y convivencia como parte del día a día." },
  { Icon: Lightbulb, titulo: "Innovación", texto: "Tecnología al servicio del aprendizaje y de la comunicación con las familias." },
];

// Textos descriptivos por nivel; los niveles y grados vienen de la base de datos
const DESCRIPCION_NIVEL: Record<string, string> = {
  Preprimaria: "Aprendizaje a través del juego: lenguaje, motricidad, convivencia y hábitos para empezar la escuela con confianza.",
  Primaria: "Bases sólidas en lectura, matemática y ciencias, con grupos reducidos y acompañamiento personalizado.",
  "Básico": "Desarrollo del pensamiento crítico, trabajo en equipo y orientación vocacional temprana.",
  Diversificado: "Preparación universitaria, proyectos de investigación y prácticas con enfoque profesional.",
};

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

  useEffect(() => {
    getInfoInicio()
      .then(setInfo)
      .catch((e: Error) => setError(e.message))
      .finally(() => setCargando(false));
  }, []);

  const sedes = info?.sedes ?? [];
  const niveles = info?.niveles ?? [];
  const rangoNiveles = niveles.length > 1
    ? `de ${niveles[0].nivel} a ${niveles[niveles.length - 1].nivel}`
    : niveles.length === 1 ? `de ${niveles[0].nivel}` : "";
  const telefonoContacto = formatearTelefono(sedes.find(s => s.telefono)?.telefono ?? null);

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
              Formamos a los líderes del mañana
            </h1>
            <p className="text-stone-600 mt-6 text-lg leading-relaxed max-w-xl">
              Colegio Vanguardia ofrece educación {rangoNiveles} en sedes de todo el país,
              con un sistema académico en línea que mantiene a alumnos, familias y docentes conectados.
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
              <div className="relative mt-9 mx-4 rounded-[22px] bg-anil-800 text-white px-5 py-4 flex items-center gap-4 rotate-[-1.5deg]">
                <GraduationCap className="w-7 h-7 text-subject-social shrink-0" />
                <p className="text-sm font-semibold leading-snug">Notas, horario, asistencia y pagos en un solo lugar para toda la familia.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Accesos al portal */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-16">
        <div className="grid md:grid-cols-2 gap-4">
          <PortalButton
            Icon={GraduationCap}
            titulo="Estudiantes y familias"
            texto="Notas, horario, pagos y avisos"
            onClick={() => onLogin("estudiante")}
            destacado
          />
          <PortalButton
            Icon={ShieldCheck}
            titulo="Catedráticos y administración"
            texto="Gestión académica y de sede"
            onClick={() => onLogin("personal")}
          />
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className="scroll-mt-20 bg-white relative">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end">
            <div className="lg:col-span-7">
              <SectionTitle titulo="Una institución con visión de futuro" texto="Acompañamos a cada alumno desde sus primeros años hasta la universidad, de la mano de su familia y de docentes que lo conocen por su nombre." />
            </div>
            {(sedes.length > 0 || niveles.length > 0) && (
              <dl className="lg:col-span-5 grid grid-cols-2 gap-3">
                {sedes.length > 0 && (
                  <div className="rounded-[22px] bg-sand-100 px-5 py-4">
                    <dd className="font-display font-extrabold text-5xl leading-none tabular-nums text-primary-800">{sedes.length}</dd>
                    <dt className="text-sm font-semibold text-stone-600 mt-2">{sedes.length === 1 ? "sede en el país" : "sedes en el país"}</dt>
                  </div>
                )}
                {niveles.length > 0 && (
                  <div className="rounded-[22px] bg-sand-100 px-5 py-4">
                    <dd className="font-display font-extrabold text-5xl leading-none tabular-nums text-action-600">{niveles.length}</dd>
                    <dt className="text-sm font-semibold text-stone-600 mt-2">{niveles.length === 1 ? "nivel educativo" : "niveles educativos"}</dt>
                  </div>
                )}
              </dl>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-5 mt-12">
            <article className="relative overflow-hidden rounded-[28px] bg-anil-800 textile-pattern text-white p-8 sm:p-10 min-h-[280px] flex flex-col">
              <span className="icono-color w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8"><Target /></span>
              <h3 className="font-display text-3xl font-bold mt-6">Misión</h3>
              <p className="text-[17px] text-white/80 leading-relaxed mt-3 max-w-md">
                Brindar una educación integral y de calidad que desarrolle las capacidades académicas, humanas y
                sociales de nuestros alumnos, en alianza con las familias y con el apoyo de docentes comprometidos.
              </p>
            </article>
            <article className="relative overflow-hidden rounded-[28px] bg-subject-social text-stone-900 p-8 sm:p-10 min-h-[280px] flex flex-col">
              <span className="icono-color-granate w-14 h-14 rounded-2xl bg-white/60 flex items-center justify-center [&>svg]:w-8 [&>svg]:h-8 text-stone-900"><Binoculars /></span>
              <h3 className="font-display text-3xl font-bold mt-6">Visión</h3>
              <p className="text-[17px] text-stone-800 leading-relaxed mt-3 max-w-md">
                Ser la red de colegios referente en Guatemala por su excelencia académica, su innovación
                pedagógica y la formación de ciudadanos responsables con su comunidad.
              </p>
              <span className="absolute -right-16 -bottom-24 w-44 h-44 rounded-full border-[16px] border-white/25" aria-hidden="true" />
            </article>
          </div>

          <div className="mt-14">
            <h3 className="font-display text-2xl font-bold">Lo que nos mueve</h3>
            <ul className="grid sm:grid-cols-3 gap-x-8 gap-y-8 mt-6">
              {VALORES.map(({ Icon, titulo, texto }, i) => (
                <li key={titulo} className="flex gap-4">
                  <span className={`icono-color w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0 [&>svg]:w-6 [&>svg]:h-6 ${["bg-action-600", "bg-success-600", "bg-subject-english"][i % 3]}`}><Icon /></span>
                  <div>
                    <p className="font-display text-xl font-bold leading-tight">{titulo}</p>
                    <p className="text-[15px] text-stone-600 mt-1.5 leading-relaxed">{texto}</p>
                  </div>
                </li>
              ))}
            </ul>
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
              <li key={n.nivel} className="relative rounded-[24px] bg-white border border-stone-200/80 p-6 pt-14 flex flex-col overflow-hidden">
                <span className={`absolute top-0 left-0 right-0 h-2 ${["bg-subject-social", "bg-subject-science", "bg-subject-math", "bg-subject-english"][i % 4]}`} />
                <span className="absolute top-5 left-6 font-display font-extrabold text-sm text-stone-400">Etapa {i + 1}</span>
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
                  <div className={`relative h-36 ${tono.fondo} overflow-hidden`} aria-hidden="true">
                    <MapaSede trazo={tono.trazo} />
                    <span className={`absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[70%] w-14 h-14 rounded-full rounded-br-none rotate-45 flex items-center justify-center ${tono.pin}`}>
                      <span className="-rotate-45 icono-color [&>svg]:w-6 [&>svg]:h-6"><School /></span>
                    </span>
                  </div>
                  <div className="p-6 flex flex-col flex-1">
                    <h3 className="font-display text-2xl font-bold leading-tight">{s.nombre}</h3>
                    {s.direccion && (
                      <p className="text-[15px] text-stone-600 flex items-start gap-2 mt-3 leading-snug">
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

      {/* Contacto */}
      <section id="contacto" className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <SectionTitle titulo="Estamos para servirle" />
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          {telefonoContacto && <ContactItem Icon={Phone} titulo="Teléfono" texto={telefonoContacto} />}
          <ContactItem Icon={Mail} titulo="Correo" texto="info@colegiovanguardia.edu.gt" />
          <ContactItem Icon={Clock} titulo="Horario de atención" texto="Lunes a viernes, de 7:00 a 15:00" />
        </div>
      </section>

      <footer className="bg-stone-900 text-white/70">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row gap-6 items-start sm:items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-xl bg-action-500 text-white flex items-center justify-center font-display font-extrabold rotate-[-4deg]">V</span>
            <div>
              <p className="font-display font-bold text-white">Colegio Vanguardia</p>
              <p className="text-xs text-white/50 mt-0.5">© {new Date().getFullYear()} Colegio Vanguardia. Todos los derechos reservados.</p>
            </div>
          </div>
          <div className="flex items-center gap-5 text-sm font-semibold">
            <button type="button" onClick={() => onLogin("estudiante")} className="hover:text-white flex items-center gap-1.5 cursor-pointer"><Users2 className="w-4 h-4" />Estudiantes</button>
            <button type="button" onClick={() => onLogin("personal")} className="hover:text-white flex items-center gap-1.5 cursor-pointer"><ShieldCheck className="w-4 h-4" />Personal</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

const TONOS_SEDE = [
  { fondo: "bg-anil-800", trazo: "rgba(255,255,255,0.18)", pin: "bg-subject-social text-stone-900" },
  { fondo: "bg-action-600", trazo: "rgba(255,255,255,0.2)", pin: "bg-white text-action-700" },
  { fondo: "bg-success-600", trazo: "rgba(255,255,255,0.2)", pin: "bg-subject-social text-stone-900" },
  { fondo: "bg-subject-social", trazo: "rgba(52,68,154,0.18)", pin: "bg-anil-800 text-white" },
];

/** Plano de calles ilustrativo (no es un mapa real) */
function MapaSede({ trazo }: { trazo: string }) {
  return (
    <svg className="absolute inset-0 w-full h-full" viewBox="0 0 320 144" preserveAspectRatio="xMidYMid slice" fill="none">
      <g stroke={trazo} strokeLinecap="round">
        <path d="M-10 40 H330 M-10 98 H330" strokeWidth="10" />
        <path d="M60 -10 V160 M170 -10 V160 M262 -10 V160" strokeWidth="8" />
        <path d="M-10 140 L120 10 M200 160 L330 30" strokeWidth="5" />
        <path d="M100 0 V40 M220 98 V144 M20 70 H60 M262 70 H320" strokeWidth="3" />
      </g>
      <circle cx="290" cy="122" r="14" fill={trazo} />
      <circle cx="28" cy="18" r="9" fill={trazo} />
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
  if (cargando) return <p className="text-sm text-stone-400 mt-8">Cargando…</p>;
  if (error) return <p className="text-sm text-danger-700 mt-8">{error}</p>;
  if (vacio) return <p className="text-sm text-stone-500 mt-8">{textoVacio}</p>;
  return null;
}

function PortalButton({ Icon, titulo, texto, onClick, destacado = false }: { Icon: typeof GraduationCap; titulo: string; texto: string; onClick: () => void; destacado?: boolean }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full flex items-center gap-3 sm:gap-4 p-4 sm:p-6 rounded-[24px] text-left transition-colors cursor-pointer
        ${destacado ? "bg-anil-800 text-white hover:bg-anil-900" : "bg-white border-[1.5px] border-stone-200 hover:border-stone-900"}`}>
      <span className={`w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center shrink-0 ${destacado ? "bg-subject-social text-stone-900" : "bg-sand-100 text-primary-700"}`}><Icon className="w-6 h-6" /></span>
      <span className="flex-1 min-w-0">
        <span className="block font-display text-lg sm:text-xl font-bold leading-tight">{titulo}</span>
        <span className={`block text-sm mt-0.5 ${destacado ? "text-white/70" : "text-stone-500"}`}>{texto}</span>
      </span>
      <span className={`text-sm font-bold shrink-0 ${destacado ? "text-subject-social" : "text-primary-700"}`}>Entrar</span>
    </button>
  );
}

function ContactItem({ Icon, titulo, texto }: { Icon: typeof Phone; titulo: string; texto: string }) {
  return (
    <div className="rounded-[22px] bg-white border border-stone-200/80 p-4 sm:p-5 flex items-center gap-3 sm:gap-4 min-w-0">
      <span className="w-11 h-11 rounded-full bg-sand-100 text-action-500 flex items-center justify-center shrink-0"><Icon className="w-5 h-5" /></span>
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-stone-500">{titulo}</p>
        <p className="text-[15px] text-stone-900 font-semibold [overflow-wrap:anywhere]">{texto}</p>
      </div>
    </div>
  );
}

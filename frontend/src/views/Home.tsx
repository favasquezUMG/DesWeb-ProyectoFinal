import { useState } from "react";
import {
  BookOpen, GraduationCap, Users2, ShieldCheck, MapPin, Phone, Mail, Clock,
  Award, Heart, Lightbulb, Menu, X, ArrowRight, FileSearch, ClipboardEdit, School,
} from "lucide-react";
import { Btn, Card, Badge } from "../components/Ui";

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

const NIVELES = [
  {
    nivel: "Primaria",
    grados: "Primero a Sexto",
    texto: "Bases sólidas en lectura, matemática y ciencias, con grupos reducidos y acompañamiento personalizado.",
  },
  {
    nivel: "Básico",
    grados: "Primero a Tercero",
    texto: "Desarrollo del pensamiento crítico, trabajo en equipo y orientación vocacional temprana.",
  },
  {
    nivel: "Diversificado",
    grados: "Bachillerato en Ciencias y Letras",
    texto: "Preparación universitaria, proyectos de investigación y prácticas con enfoque profesional.",
  },
];

const SEDES = [
  { nombre: "Sede Central", direccion: "Zona 1, Ciudad de Guatemala", telefono: "2255-0001" },
  { nombre: "Sede Norte", direccion: "Zona 18, Ciudad de Guatemala", telefono: "2255-0002" },
  { nombre: "Sede Sur", direccion: "Villa Nueva, Guatemala", telefono: "2255-0003" },
  { nombre: "Sede Mixco", direccion: "Zona 4 de Mixco, Guatemala", telefono: "2255-0004" },
  { nombre: "Sede Antigua", direccion: "Antigua Guatemala, Sacatepéquez", telefono: "7832-0005" },
  { nombre: "Sede Quetzaltenango", direccion: "Zona 3, Quetzaltenango", telefono: "7761-0006" },
];

const CIFRAS = [
  { valor: "10", label: "Sedes en el país" },
  { valor: "+25", label: "Años de trayectoria" },
  { valor: "3", label: "Niveles educativos" },
  { valor: "100%", label: "Gestión en línea" },
];

export default function Home({ onLogin, onSolicitud, onConsulta }: HomeProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-sand-100">
      {/* Barra superior */}
      <header className="sticky top-0 z-30 bg-primary-700 text-white textile-pattern border-b border-primary-600">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a href="#inicio" className="min-w-0">
            <p className="font-display font-bold text-lg leading-tight">Colegio Vanguardia</p>
            <p className="text-primary-200 text-[11px] tracking-widest uppercase">Portal Académico</p>
          </a>

          <nav className="hidden lg:flex items-center gap-6 text-sm text-primary-100">
            {NAV_LINKS.map(l => <a key={l.href} href={l.href} className="hover:text-white transition-colors">{l.label}</a>)}
          </nav>

          <div className="hidden md:flex items-center gap-2">
            <Btn variant="secondary" size="sm" onClick={() => onLogin("estudiante")}>Iniciar sesión</Btn>
          </div>

          <button type="button" className="md:hidden p-2 -mr-2" onClick={() => setMenuOpen(v => !v)} aria-label="Abrir menú">
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-primary-600 px-4 py-3 space-y-1">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href} onClick={() => setMenuOpen(false)} className="block py-2 text-sm text-primary-100 hover:text-white">{l.label}</a>
            ))}
            <Btn variant="secondary" size="sm" className="w-full justify-center mt-2" onClick={() => onLogin("estudiante")}>Iniciar sesión</Btn>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="inicio" className="relative overflow-hidden bg-primary-700 textile-pattern">
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full border-2 border-white/8" />
        <div className="absolute top-10 right-10 w-48 h-48 rounded-full border border-white/5" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-16 md:py-24 grid md:grid-cols-5 gap-10 items-center">
          <div className="md:col-span-3">
            <p className="font-display text-white/60 text-sm tracking-widest uppercase">Educación que transforma</p>
            <h1 className="font-display text-white text-4xl sm:text-5xl lg:text-6xl font-bold mt-3 leading-tight">
              Formamos a los líderes del mañana
            </h1>
            <p className="text-primary-200 mt-5 text-base sm:text-lg leading-relaxed max-w-xl">
              Colegio Vanguardia ofrece educación de Primaria a Diversificado en sedes de todo el país,
              con un sistema académico en línea que mantiene a alumnos, familias y docentes conectados.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <Btn variant="secondary" size="lg" onClick={onSolicitud} icon={<ClipboardEdit className="w-4 h-4" />}>Solicitar inscripción</Btn>
              <a href="#nosotros" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md border border-white/30 text-white text-base font-medium hover:bg-white/10 transition-colors">
                Conocer más <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Accesos al portal */}
          <div className="md:col-span-2">
            <Card className="p-6">
              <h2 className="font-display text-xl font-semibold text-stone-900">Acceso al portal</h2>
              <p className="text-stone-500 text-sm mt-1 mb-5">Seleccione cómo desea ingresar.</p>
              <div className="space-y-3">
                <PortalButton
                  Icon={GraduationCap}
                  titulo="Estudiantes y familias"
                  texto="Notas, horario, pagos y avisos"
                  onClick={() => onLogin("estudiante")}
                />
                <PortalButton
                  Icon={ShieldCheck}
                  titulo="Catedráticos y administración"
                  texto="Gestión académica y de sede"
                  onClick={() => onLogin("personal")}
                />
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Cifras */}
      <section className="bg-white border-b border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {CIFRAS.map(c => (
            <div key={c.label} className="text-center">
              <p className="font-display text-3xl sm:text-4xl font-semibold text-primary-700">{c.valor}</p>
              <p className="text-xs sm:text-sm text-stone-500 mt-1">{c.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <SectionTitle eyebrow="Nosotros" titulo="Una institución con visión de futuro" />
        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="p-2 rounded-lg bg-primary-50 text-primary-700"><BookOpen className="w-5 h-5" /></span>
              <h3 className="font-display text-lg font-semibold text-stone-900">Misión</h3>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Brindar una educación integral y de calidad que desarrolle las capacidades académicas, humanas y
              sociales de nuestros alumnos, en alianza con las familias y con el apoyo de docentes comprometidos.
            </p>
          </Card>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-3">
              <span className="p-2 rounded-lg bg-action-50 text-action-600"><Lightbulb className="w-5 h-5" /></span>
              <h3 className="font-display text-lg font-semibold text-stone-900">Visión</h3>
            </div>
            <p className="text-sm text-stone-600 leading-relaxed">
              Ser la red de colegios referente en Guatemala por su excelencia académica, su innovación
              pedagógica y la formación de ciudadanos responsables con su comunidad.
            </p>
          </Card>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 mt-6">
          {VALORES.map(({ Icon, titulo, texto }) => (
            <div key={titulo} className="rounded-xl border border-stone-200 p-5 textile-pattern-light bg-sand-50">
              <Icon className="w-5 h-5 text-primary-700" />
              <p className="font-semibold text-stone-900 mt-3">{titulo}</p>
              <p className="text-sm text-stone-600 mt-1">{texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Niveles */}
      <section id="niveles" className="scroll-mt-16 bg-white border-y border-stone-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <SectionTitle eyebrow="Oferta educativa" titulo="Niveles que impartimos" />
          <div className="grid md:grid-cols-3 gap-6 mt-8">
            {NIVELES.map((n, i) => (
              <Card key={n.nivel} className="p-6 flex flex-col">
                <span className="font-mono-data text-xs text-stone-400">0{i + 1}</span>
                <h3 className="font-display text-2xl font-semibold text-primary-700 mt-1">{n.nivel}</h3>
                <Badge variant="primary" className="self-start mt-2">{n.grados}</Badge>
                <p className="text-sm text-stone-600 leading-relaxed mt-4">{n.texto}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Sedes */}
      <section id="sedes" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <SectionTitle eyebrow="Presencia nacional" titulo="Nuestras sedes" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          {SEDES.map(s => (
            <Card key={s.nombre} className="p-5">
              <div className="flex items-start gap-3">
                <span className="p-2 rounded-lg bg-primary-50 text-primary-700 shrink-0"><School className="w-4 h-4" /></span>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-900">{s.nombre}</p>
                  <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-1"><MapPin className="w-3.5 h-3.5 shrink-0" />{s.direccion}</p>
                  <p className="text-sm text-stone-500 flex items-center gap-1.5 mt-0.5 font-mono-data"><Phone className="w-3.5 h-3.5 shrink-0" />{s.telefono}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
        <p className="text-sm text-stone-500 mt-4">Y además en Escuintla, Cobán, Huehuetenango y Petén.</p>
      </section>

      {/* Admisiones */}
      <section id="admisiones" className="scroll-mt-16 bg-primary-700 textile-pattern">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="font-display text-white/60 text-sm tracking-widest uppercase">Admisiones</p>
            <h2 className="font-display text-white text-3xl sm:text-4xl font-bold mt-2">Inscripciones abiertas</h2>
            <p className="text-primary-200 mt-4 leading-relaxed">
              Complete la solicitud en línea, adjunte los documentos del alumno y reciba una constancia con su
              número de solicitud. Le notificaremos por correo en un plazo máximo de 5 días hábiles.
            </p>
          </div>
          <div className="space-y-3">
            <button type="button" onClick={onSolicitud}
              className="w-full flex items-center gap-4 p-5 rounded-xl bg-white text-left hover:bg-sand-50 transition-colors cursor-pointer">
              <span className="p-2.5 rounded-lg bg-action-50 text-action-600"><ClipboardEdit className="w-5 h-5" /></span>
              <span className="flex-1">
                <span className="block font-semibold text-stone-900">Solicitar inscripción</span>
                <span className="block text-sm text-stone-500">Primer ingreso de un alumno al colegio</span>
              </span>
              <ArrowRight className="w-4 h-4 text-stone-400" />
            </button>
            <button type="button" onClick={onConsulta}
              className="w-full flex items-center gap-4 p-5 rounded-xl bg-white/10 border border-white/20 text-left text-white hover:bg-white/15 transition-colors cursor-pointer">
              <span className="p-2.5 rounded-lg bg-white/10"><FileSearch className="w-5 h-5" /></span>
              <span className="flex-1">
                <span className="block font-semibold">Consultar estado de solicitud</span>
                <span className="block text-sm text-primary-200">Con su número de solicitud o DPI y correo</span>
              </span>
              <ArrowRight className="w-4 h-4 text-primary-200" />
            </button>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="scroll-mt-16 max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <SectionTitle eyebrow="Contacto" titulo="Estamos para servirle" />
        <div className="grid sm:grid-cols-3 gap-4 mt-8">
          <ContactItem Icon={Phone} titulo="Teléfono" texto="2255-0001" />
          <ContactItem Icon={Mail} titulo="Correo" texto="info@colegiovanguardia.edu.gt" />
          <ContactItem Icon={Clock} titulo="Horario de atención" texto="Lunes a viernes, 7:00 – 15:00" />
        </div>
      </section>

      <footer className="bg-primary-800 text-primary-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div>
            <p className="font-display font-bold text-white">Colegio Vanguardia</p>
            <p className="text-xs text-primary-300 mt-1">© {new Date().getFullYear()} Colegio Vanguardia · Todos los derechos reservados</p>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <button type="button" onClick={() => onLogin("estudiante")} className="hover:text-white flex items-center gap-1.5 cursor-pointer"><Users2 className="w-4 h-4" />Estudiantes</button>
            <button type="button" onClick={() => onLogin("personal")} className="hover:text-white flex items-center gap-1.5 cursor-pointer"><ShieldCheck className="w-4 h-4" />Personal</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, titulo }: { eyebrow: string; titulo: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-action-600 uppercase tracking-widest">{eyebrow}</p>
      <h2 className="font-display text-3xl font-semibold text-stone-900 mt-1">{titulo}</h2>
    </div>
  );
}

function PortalButton({ Icon, titulo, texto, onClick }: { Icon: typeof GraduationCap; titulo: string; texto: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-stone-200 bg-white text-left hover:border-primary-700 hover:bg-primary-50 transition-colors cursor-pointer group">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-700 group-hover:bg-white"><Icon className="w-5 h-5" /></span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-stone-900">{titulo}</span>
        <span className="block text-xs text-stone-500">{texto}</span>
      </span>
      <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-primary-700" />
    </button>
  );
}

function ContactItem({ Icon, titulo, texto }: { Icon: typeof Phone; titulo: string; texto: string }) {
  return (
    <Card className="p-5 flex items-center gap-3">
      <span className="p-2 rounded-lg bg-primary-50 text-primary-700 shrink-0"><Icon className="w-4 h-4" /></span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">{titulo}</p>
        <p className="text-sm text-stone-900 font-medium break-words">{texto}</p>
      </div>
    </Card>
  );
}

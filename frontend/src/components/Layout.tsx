import { useEffect, useState, type ReactNode } from "react";
import type { Role, View } from "../types";
import type { AppUser } from "../types";
import { menuDe, tituloDeVista, type ItemMenu } from "../lib/navegacion";
import NotificacionesMenu from "./NotificacionesMenu";
import MiCuentaModal from "./MiCuentaModal";
import {
  LayoutDashboard, School, BookOpen, FileBarChart, Users, ShieldCheck,
  GraduationCap, UserCheck, Grid3X3, BookMarked, CalendarDays, Bell,
  ClipboardList, Clock, BookOpenCheck, CalendarCheck, Star, CreditCard, FileText,
  User, ChevronLeft, ChevronRight, Menu, X, ChevronDown,
  LogOut, Settings, Award, BookText, Layers, MessageSquare, BellRing, Repeat, FileCheck2, FileSignature, Tablero
} from "./Iconos";
import type { Icono } from "./Iconos";

type NavItem = ItemMenu & { Icon: Icono };

const ICONO_VISTA: Partial<Record<View, Icono>> = {
  "ag-dashboard": LayoutDashboard,
  "ag-sedes": School,
  "ag-malla": Layers,
  "ag-reporteria": FileBarChart,
  "as-solicitudes": FileText,
  "as-calendario": CalendarDays,
  "as-usuarios": Users,
  "as-pagos": CreditCard,
  "as-roles": ShieldCheck,
  "as-dashboard": LayoutDashboard,
  "as-catedraticos": GraduationCap,
  "as-alumnos": UserCheck,
  "as-grados": Grid3X3,
  "as-cursos": BookMarked,
  "as-horarios": Clock,
  "as-becas": Award,
  "as-justificaciones": FileCheck2,
  "as-notificaciones": Bell,
  "cat-dashboard": LayoutDashboard,
  "cat-cursos": BookOpen,
  "cat-notas": BookText,
  "cat-tareas": Tablero,
  "cat-asistencia": ClipboardList,
  "cat-horario": CalendarCheck,
  "cat-calendario": CalendarDays,
  "cat-comunicacion": MessageSquare,
  "alu-dashboard": LayoutDashboard,
  "alu-notas": BookOpenCheck,
  "alu-tareas": Tablero,
  "alu-horario": Clock,
  "alu-calendario": CalendarDays,
  "pad-dashboard": LayoutDashboard,
  "pad-matricula": BookMarked,
  "pad-notas": Star,
  "pad-tareas": Tablero,
  "pad-asistencia": ClipboardList,
  "pad-horario": Clock,
  "pad-calendario": CalendarDays,
  "pad-pagos": CreditCard,
  "pad-circulares": FileSignature,
  "pad-becas": Award,
  "pad-avisos": BellRing,
  "pad-perfil": User,
};

const ROLE_LABELS: Record<Role, string> = {
  "admin-general": "Administrador General",
  "admin-sede": "Director de Sede",
  "catedratico": "Catedrático",
  "alumno": "Alumno",
  "padre": "Padre / Encargado",
};

const NOMBRES_DE_SISTEMA: Record<string, string> = {
  "Administrador General": "Administrador General",
  "Administrador de Sede": "Director de Sede",
  "Catedratico": "Catedrático",
  "Alumno": "Alumno",
  "Encargado": "Padre / Encargado",
};

// Nombre que se muestra para un rol (los creados por el colegio se muestran tal cual)
export function etiquetaRol(nombre: string): string {
  return NOMBRES_DE_SISTEMA[nombre] ?? nombre;
}

function etiquetaDe(user: AppUser): string {
  return user.roleName ? etiquetaRol(user.roleName) : ROLE_LABELS[user.role];
}

function navDe(user: AppUser): NavItem[] {
  return menuDe(user).map((item) => ({ ...item, Icon: ICONO_VISTA[item.view] ?? LayoutDashboard }));
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="w-10 h-10 rounded-[14px] bg-action-500 text-white flex items-center justify-center font-display font-extrabold text-xl shrink-0 rotate-[-4deg]">V</div>
      {!compact && (
        <div className="min-w-0 leading-tight">
          <p className="font-display font-bold text-white text-[17px] truncate">Vanguardia</p>
          <p className="text-white/55 text-xs font-medium">Sistema académico</p>
        </div>
      )}
    </div>
  );
}

function NavBoton({ label, Icon, active, collapsed, onClick }: {
  label: string; Icon: typeof LayoutDashboard; active: boolean; collapsed: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={`w-full flex items-center gap-3 py-2.5 text-[14.5px] transition-colors duration-150 mb-1 cursor-pointer text-left
        ${collapsed ? "justify-center px-0" : "pl-3.5 pr-3"}
        ${active
          ? "nav-tab-active bg-sand-100 text-anil-800 font-bold rounded-l-2xl"
          : "text-white/75 font-medium rounded-2xl mr-3 hover:bg-white/10 hover:text-white"}`}
      aria-current={active ? "page" : undefined}
    >
      <Icon weight={active ? "fill" : "duotone"} className={`w-5 h-5 shrink-0 ${active ? "text-action-600" : ""}`} aria-hidden="true" />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );
}

function Sidebar({ user, currentView, onNavigate, collapsed, onToggle }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const navItems = navDe(user);

  return (
    <aside className={`hidden lg:flex flex-col h-screen bg-anil-800 textile-pattern text-white shrink-0 sidebar-transition sticky top-0 relative ${collapsed ? "w-[76px]" : "w-[264px]"}`}>
      <div className={`flex items-center h-[76px] shrink-0 ${collapsed ? "justify-center" : "justify-between pl-5 pr-3"}`}>
        <Logo compact={collapsed} />
        {!collapsed && (
          <button onClick={onToggle} className="w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors shrink-0 cursor-pointer" aria-label="Colapsar menú">
            <ChevronLeft className="w-4 h-4" />
          </button>
        )}
      </div>
      {collapsed && (
        <button onClick={onToggle} className="mx-auto mb-2 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" aria-label="Expandir menú">
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      <nav className={`flex-1 overflow-y-auto scrollbar-hide py-4 ${collapsed ? "pl-3" : "pl-3"}`}>
        {navItems.map(({ label, view, Icon }) => (
          <NavBoton key={view} label={label} Icon={Icon} active={currentView === view} collapsed={collapsed} onClick={() => onNavigate(view)} />
        ))}
      </nav>

      <div className={`shrink-0 border-t border-white/10 ${collapsed ? "py-4 flex justify-center" : "px-5 py-4"}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-full bg-subject-social text-stone-900 flex items-center justify-center text-xs font-bold shrink-0">{user.initials}</div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white text-[13px] font-semibold truncate">{user.name}</p>
              <p className="text-white/55 text-xs truncate">{etiquetaDe(user)}</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

const fechaHoy = () => {
  const t = new Date().toLocaleDateString("es-GT", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

function Topbar({ user, currentView, navItems, sede, onNavigate, onLogout, onMenuOpen, onCambiarRol }: {
  user: AppUser;
  currentView: View;
  navItems: NavItem[];
  onNavigate: (v: View) => void;
  sede?: string;
  onLogout: () => void;
  onMenuOpen: () => void;
  onCambiarRol?: (rolId: number) => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [cuentaOpen, setCuentaOpen] = useState(false);
  const currentLabel = navItems.find(n => n.view === currentView)?.label ?? "";

  return (
    <header className="sticky top-0 z-30 h-[76px] bg-sand-100 flex items-center gap-2 sm:gap-3 px-4 md:px-8 shrink-0">
      <button
        onClick={onMenuOpen}
        className="lg:hidden w-10 h-10 rounded-full bg-anil-800 text-white flex items-center justify-center"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      <div className="min-w-0">
        <p className="lg:hidden font-display font-bold text-stone-900 text-base truncate">{currentLabel || "Vanguardia"}</p>
        <p className="hidden lg:block text-sm font-medium text-stone-500">{fechaHoy()}</p>
      </div>

      <div className="flex-1" />

      {sede && (
        <div className="hidden sm:flex items-center gap-2 h-10 px-4 rounded-full border-[1.5px] border-stone-200 text-[13px] font-semibold text-stone-700">
          <School className="w-4 h-4 text-primary-600" />
          {sede}
        </div>
      )}

      <NotificacionesMenu />

      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          className="flex items-center gap-2 h-10 pl-1 pr-3 rounded-full bg-white border-[1.5px] border-stone-200 hover:border-stone-400 transition-colors cursor-pointer"
          aria-label="Menú de usuario"
          aria-expanded={userMenuOpen}
        >
          <div className="w-8 h-8 rounded-full shrink-0 bg-subject-social text-stone-900 flex items-center justify-center text-xs font-bold">{user.initials}</div>
          <span className="hidden md:block text-sm font-semibold text-stone-800 max-w-32 truncate">{user.name.split(" ")[0]}</span>
          <ChevronDown className="w-4 h-4 text-stone-500" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-3xl shadow-xl p-2 z-50 border border-stone-200/70">
            <div className="flex items-center gap-3 px-3 py-3">
              <div className="w-10 h-10 rounded-full bg-subject-social text-stone-900 flex items-center justify-center text-sm font-bold shrink-0">{user.initials}</div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-stone-900 truncate">{user.name}</p>
                <p className="text-xs text-stone-500 truncate">{user.email}</p>
                <p className="text-xs text-primary-700 font-semibold mt-0.5">{etiquetaDe(user)}</p>
              </div>
            </div>
            {onCambiarRol && (user.roles?.length ?? 0) > 1 && (
              <div className="py-1 my-1 border-y border-stone-100">
                <p className="px-3 pt-1.5 pb-1 text-xs font-semibold text-stone-500">Entrar como</p>
                {user.roles!.filter(r => r.rolId !== user.roleId).map(r => (
                  <button key={r.rolId} className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                    onClick={() => { setUserMenuOpen(false); onCambiarRol(r.rolId); }}>
                    <Repeat className="w-4 h-4 text-stone-400" />{etiquetaRol(r.nombre)}
                  </button>
                ))}
              </div>
            )}
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer" onClick={() => { setUserMenuOpen(false); setCuentaOpen(true); }}>
              <Settings className="w-4 h-4 text-stone-400" />Mi cuenta
            </button>
            <button className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-sm font-medium text-danger-700 hover:bg-danger-50 transition-colors cursor-pointer" onClick={onLogout}>
              <LogOut className="w-4 h-4" />Cerrar sesión
            </button>
          </div>
        )}
      </div>

      <MiCuentaModal open={cuentaOpen} onClose={() => setCuentaOpen(false)} user={user} rol={etiquetaDe(user)} />
    </header>
  );
}

function MobileSidebar({ user, currentView, onNavigate, open, onClose }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  open: boolean;
  onClose: () => void;
}) {
  const navItems = navDe(user);
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-anil-900/40 lg:hidden transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside className={`fixed left-0 top-0 h-full z-50 w-[280px] bg-anil-800 textile-pattern text-white rounded-r-[28px] lg:hidden transition-transform duration-300 flex flex-col overflow-hidden ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between pl-5 pr-3 h-[76px] shrink-0">
          <Logo />
          <button onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10" aria-label="Cerrar menú"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 pl-3">
          {navItems.map(({ label, view, Icon }) => (
            <NavBoton key={view} label={label} Icon={Icon} active={currentView === view} collapsed={false} onClick={() => { onNavigate(view); onClose(); }} />
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-full bg-subject-social text-stone-900 flex items-center justify-center text-xs font-bold shrink-0">{user.initials}</div>
          <div className="min-w-0">
            <p className="text-white text-[13px] font-semibold truncate">{user.name}</p>
            <p className="text-white/55 text-xs truncate">{etiquetaDe(user)}</p>
          </div>
        </div>
      </aside>
    </>
  );
}

export function Layout({ user, currentView, onNavigate, onLogout, onCambiarRol, sede, children }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  onLogout: () => void;
  onCambiarRol?: (rolId: number) => void;
  sede?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = navDe(user);

  // Cada pantalla con su propio título en la pestaña del navegador
  useEffect(() => {
    const titulo = tituloDeVista(currentView);
    document.title = titulo ? `${titulo} · Colegio Vanguardia` : "Colegio Vanguardia";
  }, [currentView]);

  return (
    <div className="flex h-screen overflow-hidden bg-anil-800">
      <a href="#contenido" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2.5 focus:rounded-full focus:bg-white focus:text-stone-900 focus:font-semibold focus:shadow-lg">
        Saltar al contenido
      </a>
      <Sidebar user={user} currentView={currentView} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <MobileSidebar user={user} currentView={currentView} onNavigate={onNavigate} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-sand-100 lg:rounded-l-[28px]">
        <Topbar user={user} currentView={currentView} navItems={navItems} sede={sede} onNavigate={onNavigate} onLogout={onLogout} onMenuOpen={() => setMobileOpen(true)} onCambiarRol={onCambiarRol} />
        <main id="contenido" tabIndex={-1} className="flex-1 overflow-y-auto focus:outline-none">
          <div className="px-4 pb-10 pt-2 md:px-8 max-w-[1240px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

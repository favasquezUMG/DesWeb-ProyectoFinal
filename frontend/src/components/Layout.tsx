import { useState, type ReactNode } from "react";
import type { Role, View } from "../types";
import type { AppUser } from "../types";
import {
  LayoutDashboard, School, BookOpen, FileBarChart, Users, ShieldCheck,
  GraduationCap, UserCheck, Grid3X3, BookMarked, CalendarDays, Bell,
  ClipboardList, Clock, BookOpenCheck, CalendarCheck, Star, CreditCard,
  User, ChevronLeft, ChevronRight, Menu, X, Search, ChevronDown,
  LogOut, Settings, Award, BookText, Layers
} from "lucide-react";

// ─── Nav item config ──────────────────────────────────────────────────────────

type NavItem = { label: string; view: View; Icon: typeof LayoutDashboard };

const NAV: Record<Role, NavItem[]> = {
  "admin-general": [
    { label: "Dashboard", view: "ag-dashboard", Icon: LayoutDashboard },
    { label: "Sedes", view: "ag-sedes", Icon: School },
    { label: "Malla Curricular", view: "ag-malla", Icon: Layers },
    { label: "Reportería", view: "ag-reporteria", Icon: FileBarChart },
  ],
  "admin-sede": [
    { label: "Dashboard", view: "as-dashboard", Icon: LayoutDashboard },
    { label: "Usuarios", view: "as-usuarios", Icon: Users },
    { label: "Roles y Permisos", view: "as-roles", Icon: ShieldCheck },
    { label: "Catedráticos", view: "as-catedraticos", Icon: GraduationCap },
    { label: "Alumnos", view: "as-alumnos", Icon: UserCheck },
    { label: "Grados y Secciones", view: "as-grados", Icon: Grid3X3 },
    { label: "Cursos", view: "as-cursos", Icon: BookMarked },
    { label: "Horarios", view: "as-horarios", Icon: Clock },
    { label: "Becas", view: "as-becas", Icon: Award },
    { label: "Notificaciones", view: "as-notificaciones", Icon: Bell },
    { label: "Calendario", view: "as-calendario", Icon: CalendarDays },
  ],
  "catedratico": [
    { label: "Dashboard", view: "cat-dashboard", Icon: LayoutDashboard },
    { label: "Mis Cursos", view: "cat-cursos", Icon: BookOpen },
    { label: "Libreta de Notas", view: "cat-notas", Icon: BookText },
    { label: "Asistencia", view: "cat-asistencia", Icon: ClipboardList },
    { label: "Mi Horario", view: "cat-horario", Icon: CalendarCheck },
  ],
  "alumno": [
    { label: "Dashboard", view: "alu-dashboard", Icon: LayoutDashboard },
    { label: "Mis Notas", view: "alu-notas", Icon: BookOpenCheck },
    { label: "Mi Horario", view: "alu-horario", Icon: Clock },
    { label: "Calendario", view: "alu-calendario", Icon: CalendarDays },
  ],
  "padre": [
    { label: "Dashboard", view: "pad-dashboard", Icon: LayoutDashboard },
    { label: "Matrícula", view: "pad-matricula", Icon: BookMarked },
    { label: "Notas y Reportes", view: "pad-notas", Icon: Star },
    { label: "Pagos", view: "pad-pagos", Icon: CreditCard },
    { label: "Perfil", view: "pad-perfil", Icon: User },
  ],
};

const ROLE_LABELS: Record<Role, string> = {
  "admin-general": "Administrador General",
  "admin-sede": "Director de Sede",
  "catedratico": "Catedrático",
  "alumno": "Alumno",
  "padre": "Padre / Encargado",
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ user, currentView, onNavigate, collapsed, onToggle }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const navItems = NAV[user.role];

  return (
    <aside className={`hidden md:flex flex-col h-screen bg-primary-700 text-white shrink-0 sidebar-transition sticky top-0 ${collapsed ? "w-16" : "w-60"}`}>
      {/* Logo area */}
      <div className="flex items-center justify-between px-4 h-16 border-b border-primary-600 textile-pattern shrink-0">
        {!collapsed && (
          <div className="min-w-0">
            <p className="font-display font-bold text-white text-sm leading-tight truncate">Colegio Vanguardia</p>
            <p className="text-primary-200 text-xs font-medium tracking-widest">Sistema Académico</p>
          </div>
        )}
        {collapsed && <div className="font-display font-bold text-white text-lg mx-auto">C</div>}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-md text-primary-200 hover:text-white hover:bg-primary-600 transition-colors shrink-0"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2">
        {navItems.map(({ label, view, Icon }) => {
          const active = currentView === view;
          return (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              title={collapsed ? label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 mb-0.5 cursor-pointer text-left
                ${active ? "bg-white/15 text-white" : "text-primary-100 hover:bg-white/10 hover:text-white"}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-4.5 h-4.5 shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          );
        })}
      </nav>

      {/* User area */}
      <div className={`shrink-0 border-t border-primary-600 p-3 ${collapsed ? "flex justify-center" : ""}`}>
        {collapsed ? (
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">{user.initials}</div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">{user.initials}</div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate">{user.name}</p>
              <p className="text-primary-200 text-xs truncate">{ROLE_LABELS[user.role]}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

function Topbar({ user, currentView, navItems, sede, onLogout, onMenuOpen }: {
  user: AppUser;
  currentView: View;
  navItems: NavItem[];
  sede?: string;
  onLogout: () => void;
  onMenuOpen: () => void;
}) {
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const currentLabel = navItems.find(n => n.view === currentView)?.label ?? "";

  return (
    <header className="sticky top-0 z-30 h-14 bg-white border-b border-stone-200 flex items-center gap-4 px-4 shrink-0">
      {/* Mobile menu button */}
      <button
        onClick={onMenuOpen}
        className="md:hidden p-1.5 rounded-md text-stone-500 hover:text-stone-700 hover:bg-stone-100 transition-colors"
        aria-label="Abrir menú"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Mobile logo */}
      <span className="md:hidden font-display font-bold text-primary-700 text-sm">Colegio Vanguardia</span>

      {/* Page title */}
      <span className="hidden md:block text-sm font-semibold text-stone-700">{currentLabel}</span>

      <div className="flex-1" />

      {/* Sede indicator */}
      {sede && (
        <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-primary-50 border border-primary-200 rounded-full">
          <div className="w-1.5 h-1.5 rounded-full bg-primary-600" />
          <span className="text-xs font-medium text-primary-700">{sede}</span>
        </div>
      )}

      {/* Search */}
      <button className="p-2 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors" aria-label="Buscar">
        <Search className="w-4.5 h-4.5" />
      </button>

      {/* Notifications */}
      <button className="relative p-2 rounded-md text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors" aria-label="Notificaciones">
        <Bell className="w-4.5 h-4.5" />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-action-500 rounded-full" aria-hidden="true" />
      </button>

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-stone-100 transition-colors"
          aria-label="Menú de usuario"
          aria-expanded={userMenuOpen}
        >
          <div className="w-7 h-7 rounded-full bg-primary-700 flex items-center justify-center text-white text-xs font-bold">{user.initials}</div>
          <span className="hidden md:block text-sm font-medium text-stone-700 max-w-32 truncate">{user.name.split(" ")[0]}</span>
          <ChevronDown className="w-3.5 h-3.5 text-stone-400" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1 w-52 bg-white border border-stone-200 rounded-xl shadow-xl py-1 z-50">
            <div className="px-4 py-2 border-b border-stone-100">
              <p className="text-sm font-semibold text-stone-900">{user.name}</p>
              <p className="text-xs text-stone-500">{user.email}</p>
            </div>
            <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-stone-700 hover:bg-stone-50 transition-colors" onClick={() => setUserMenuOpen(false)}>
              <Settings className="w-4 h-4 text-stone-400" />Configuración
            </button>
            <button className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-danger-700 hover:bg-danger-50 transition-colors" onClick={onLogout}>
              <LogOut className="w-4 h-4" />Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// ─── Mobile Sidebar Overlay ───────────────────────────────────────────────────

function MobileSidebar({ user, currentView, onNavigate, open, onClose }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  open: boolean;
  onClose: () => void;
}) {
  const navItems = NAV[user.role];
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-stone-900/40 md:hidden transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <aside className={`fixed left-0 top-0 h-full z-50 w-64 bg-primary-700 text-white md:hidden transition-transform duration-300 flex flex-col ${open ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 h-14 border-b border-primary-600 textile-pattern shrink-0">
          <div>
            <p className="font-display font-bold text-white text-sm">Colegio Vanguardia</p>
            <p className="text-primary-200 text-xs tracking-widest">Sistema Académico</p>
          </div>
          <button onClick={onClose} className="p-1.5 text-primary-200 hover:text-white" aria-label="Cerrar menú"><X className="w-5 h-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto scrollbar-hide py-3 px-2">
          {navItems.map(({ label, view, Icon }) => {
            const active = currentView === view;
            return (
              <button key={view} onClick={() => { onNavigate(view); onClose(); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-0.5 cursor-pointer text-left
                  ${active ? "bg-white/15 text-white" : "text-primary-100 hover:bg-white/10 hover:text-white"}`}>
                <Icon className="w-4.5 h-4.5 shrink-0" />
                <span className="truncate">{label}</span>
              </button>
            );
          })}
        </nav>
        <div className="border-t border-primary-600 p-3 flex items-center gap-2.5 shrink-0">
          <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold shrink-0">{user.initials}</div>
          <div className="min-w-0">
            <p className="text-white text-xs font-semibold truncate">{user.name}</p>
            <p className="text-primary-200 text-xs truncate">{ROLE_LABELS[user.role]}</p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Layout({ user, currentView, onNavigate, onLogout, sede, children }: {
  user: AppUser;
  currentView: View;
  onNavigate: (v: View) => void;
  onLogout: () => void;
  sede?: string;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navItems = NAV[user.role];

  return (
    <div className="flex h-screen overflow-hidden bg-sand-100">
      <Sidebar user={user} currentView={currentView} onNavigate={onNavigate} collapsed={collapsed} onToggle={() => setCollapsed(v => !v)} />
      <MobileSidebar user={user} currentView={currentView} onNavigate={onNavigate} open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar user={user} currentView={currentView} navItems={navItems} sede={sede} onLogout={onLogout} onMenuOpen={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto scrollbar-hide">
          <div className="p-4 md:p-6 max-w-screen-xl mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

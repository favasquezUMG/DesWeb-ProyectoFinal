import { lazy, Suspense, useEffect, useState } from "react";
import type { AppUser, View } from "./types";
import { vistasPermitidas } from "./lib/navegacion";
import type { Screen } from "./views/Login";
import Home, { type Portal } from "./views/Home";
import { PantallaSkeleton, Skeleton } from "./components/Ui";
import { buildAppUser, clearSession, getSession, saveSession } from "./lib/auth";
import { cambiarRol } from "./lib/api";
import { guardarCircularPendiente, hayCircularPendiente } from "./lib/circularPendiente";

// Cada portal se descarga solo cuando se usa: quien visita el inicio no baja las pantallas de todos los roles
const Login = lazy(() => import("./views/Login"));
const AdminGeneral = lazy(() => import("./views/AdminGeneral"));
const AdminSede = lazy(() => import("./views/admin-sede"));
const Catedratico = lazy(() => import("./views/Catedratico"));
const Alumno = lazy(() => import("./views/Alumno"));
const Padre = lazy(() => import("./views/Padre"));
// El marco del sistema (menú lateral y sus íconos) tampoco hace falta en el inicio
const Layout = lazy(() => import("./components/Layout").then((m) => ({ default: m.Layout })));

const TITULO_ACCESO: Record<Screen, string> = {
  login: "Iniciar sesión",
  solicitud: "Solicitud de inscripción",
  consulta: "Consultar solicitud",
  forgot: "Recuperar contraseña",
  reset: "Restablecer contraseña",
};

// La app vive en "/"; cualquier otra ruta es una página que no existe
const rutaValida = () => ["/", "/index.html"].includes(window.location.pathname);

// Si el padre llegó desde el enlace de una circular, entra directo a Circulares (que la abre).
// El personal de sede entra a la primera pestaña que tiene permitida (la secretaría no ve el Inicio).
const vistaInicial = (user: AppUser): View => {
  if (user.role === "padre" && hayCircularPendiente()) return "pad-circulares";
  if (user.role === "admin-sede") return vistasPermitidas(user)[0] ?? DEFAULT_VIEWS[user.role];
  return DEFAULT_VIEWS[user.role];
};

const DEFAULT_VIEWS: Record<string, View> = {
  "admin-general": "ag-dashboard",
  "admin-sede": "as-dashboard",
  "catedratico": "cat-dashboard",
  "alumno": "alu-dashboard",
  "padre": "pad-dashboard",
};

export default function App() {
  const [user, setUser] = useState<AppUser | null>(null);
  const [sede, setSede] = useState<string | undefined>(undefined);
  const [currentView, setCurrentView] = useState<View>("ag-dashboard");
  // null = se muestra el home público; si no, la pantalla de acceso elegida
  const [acceso, setAcceso] = useState<{ portal: Portal; screen: Screen } | null>(null);
  // Token del enlace "Restablecer contraseña" que llega por correo (?reset=...)
  const [resetToken, setResetToken] = useState<string | null>(null);

  useEffect(() => {
    // Enlace "Autorizar y pagar" del correo de una circular (?circular=<eventoId>)
    const circular = Number(new URLSearchParams(window.location.search).get("circular"));
    if (circular > 0) {
      guardarCircularPendiente(circular);
      window.history.replaceState(null, "", window.location.pathname);
    }

    const session = getSession();
    if (session) {
      setUser(session.user);
      setSede(session.user.sede);
      setCurrentView(vistaInicial(session.user));
    } else if (circular > 0) {
      setAcceso({ portal: "estudiante", screen: "login" });
    }

    const token = new URLSearchParams(window.location.search).get("reset");
    if (token) {
      setResetToken(token);
      setAcceso({ portal: "estudiante", screen: "reset" });
      // Se quita el token de la barra de direcciones para que no quede en el historial
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function handleLogin(loggedUser: AppUser, loggedSede?: string) {
    setUser(loggedUser);
    setSede(loggedSede || loggedUser.sede);
    setCurrentView(vistaInicial(loggedUser));
  }

  // Una persona con varios roles (ej. catedrático y padre) cambia de rol sin cerrar sesión
  async function handleCambiarRol(rolId: number) {
    try {
      const result = await cambiarRol(rolId);
      const nuevo = buildAppUser(result.usuario);
      saveSession(result.token, nuevo);
      setUser(nuevo);
      setSede(nuevo.sede);
      setCurrentView(vistaInicial(nuevo));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "No se pudo cambiar de rol.");
    }
  }

  function handleLogout() {
    clearSession();
    setUser(null);
    setSede(undefined);
    setAcceso(null);
  }

  // Título de la pestaña en el inicio y en las pantallas de acceso (las del sistema lo pone Layout)
  useEffect(() => {
    if (user) return;
    if (!rutaValida()) document.title = "Página no encontrada · Colegio Vanguardia";
    else if (acceso) document.title = `${TITULO_ACCESO[acceso.screen]} · Colegio Vanguardia`;
    else document.title = "Colegio Vanguardia · Preprimaria a Diversificado en Guatemala";
  }, [user, acceso]);

  if (!rutaValida()) return <NoEncontrada />;

  if (!user) {
    if (!acceso) {
      return (
        <Home
          onLogin={(portal) => setAcceso({ portal, screen: "login" })}
          onSolicitud={() => setAcceso({ portal: "estudiante", screen: "solicitud" })}
          onConsulta={() => setAcceso({ portal: "estudiante", screen: "consulta" })}
        />
      );
    }
    return (
      <Suspense fallback={<AccesoSkeleton />}>
        <Login
          key={`${acceso.portal}-${acceso.screen}`}
          initialPortal={acceso.portal}
          initialScreen={acceso.screen}
          resetToken={resetToken ?? undefined}
          onLogin={handleLogin}
          onBack={() => setAcceso(null)}
        />
      </Suspense>
    );
  }

  function renderView() {
    if (!user) return null;
    switch (user.role) {
      case "admin-general": return <AdminGeneral view={currentView} />;
      case "admin-sede": {
        // Una pantalla sin permiso (o sin ninguna pestaña asignada) no se muestra aunque se llegue a ella
        const permitidas = vistasPermitidas(user);
        if (permitidas.length === 0) return <SinPermisos />;
        return <AdminSede view={permitidas.includes(currentView) ? currentView : permitidas[0]} />;
      }
      case "catedratico": return <Catedratico view={currentView} onNavigate={setCurrentView} />;
      case "alumno": return <Alumno view={currentView} onNavigate={setCurrentView} />;
      case "padre": return <Padre view={currentView} user={user} onNavigate={setCurrentView} />;
      default: return null;
    }
  }

  return (
    <Suspense fallback={<SistemaSkeleton />}>
      <Layout
        user={user}
        currentView={currentView}
        onNavigate={setCurrentView}
        onLogout={handleLogout}
        onCambiarRol={handleCambiarRol}
        sede={sede}
      >
        <Suspense fallback={<PantallaSkeleton />}>{renderView()}</Suspense>
      </Layout>
    </Suspense>
  );
}

function SistemaSkeleton() {
  return (
    <div className="min-h-screen bg-sand-100 p-6 lg:p-10">
      <PantallaSkeleton />
    </div>
  );
}

function AccesoSkeleton() {
  return (
    <div role="status" className="min-h-screen bg-sand-100 flex items-center justify-center p-6">
      <span className="sr-only">Cargando…</span>
      <div className="w-full max-w-md space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 w-40 rounded-full" />
      </div>
    </div>
  );
}

function NoEncontrada() {
  return (
    <main className="min-h-screen bg-sand-100 text-stone-900 flex items-center justify-center px-4 py-16">
      <div className="max-w-lg text-center">
        <p className="font-display font-extrabold text-[7rem] leading-none text-anil-800 tabular-nums" aria-hidden="true">404</p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mt-4">Esta página no existe</h1>
        <p className="text-[17px] text-stone-600 mt-3 leading-relaxed">
          Puede que el enlace esté incompleto o que la página se haya movido. Desde el inicio encontrará el portal, las inscripciones y la información del colegio.
        </p>
        <a href="/" className="inline-flex items-center mt-8 px-6 py-3 rounded-full bg-anil-800 text-white font-bold hover:bg-anil-900 transition-colors">
          Ir al inicio
        </a>
      </div>
    </main>
  );
}

function SinPermisos() {
  return (
    <div className="py-20 text-center max-w-md mx-auto">
      <h2 className="font-display font-bold text-xl text-stone-900">Su cuenta todavía no tiene permisos</h2>
      <p className="text-sm text-stone-500 mt-2">Pida al Administrador General que asigne permisos a su rol en "Roles y Permisos".</p>
    </div>
  );
}

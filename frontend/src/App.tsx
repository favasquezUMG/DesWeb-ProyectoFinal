import { useEffect, useState } from "react";
import type { AppUser, View } from "./types";
import { Layout } from "./components/Layout";
import Login, { type Screen } from "./views/Login";
import Home, { type Portal } from "./views/Home";
import AdminGeneral from "./views/AdminGeneral";
import AdminSede from "./views/admin-sede";
import Catedratico from "./views/Catedratico";
import Alumno from "./views/Alumno";
import Padre from "./views/Padre";
import { buildAppUser, clearSession, getSession, saveSession } from "./lib/auth";
import { cambiarRol } from "./lib/api";

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
    const session = getSession();
    if (session) {
      setUser(session.user);
      setSede(session.user.sede);
      setCurrentView(DEFAULT_VIEWS[session.user.role] as View);
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
    setCurrentView(DEFAULT_VIEWS[loggedUser.role] as View);
  }

  // Una persona con varios roles (ej. catedrático y padre) cambia de rol sin cerrar sesión
  async function handleCambiarRol(rolId: number) {
    try {
      const result = await cambiarRol(rolId);
      const nuevo = buildAppUser(result.usuario);
      saveSession(result.token, nuevo);
      setUser(nuevo);
      setSede(nuevo.sede);
      setCurrentView(DEFAULT_VIEWS[nuevo.role] as View);
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
      <Login
        key={`${acceso.portal}-${acceso.screen}`}
        initialPortal={acceso.portal}
        initialScreen={acceso.screen}
        resetToken={resetToken ?? undefined}
        onLogin={handleLogin}
        onBack={() => setAcceso(null)}
      />
    );
  }

  function renderView() {
    if (!user) return null;
    switch (user.role) {
      case "admin-general": return <AdminGeneral view={currentView} />;
      case "admin-sede": return <AdminSede view={currentView} />;
      case "catedratico": return <Catedratico view={currentView} onNavigate={setCurrentView} />;
      case "alumno": return <Alumno view={currentView} />;
      case "padre": return <Padre view={currentView} />;
      default: return null;
    }
  }

  return (
    <Layout
      user={user}
      currentView={currentView}
      onNavigate={setCurrentView}
      onLogout={handleLogout}
      onCambiarRol={handleCambiarRol}
      sede={sede}
    >
      {renderView()}
    </Layout>
  );
}

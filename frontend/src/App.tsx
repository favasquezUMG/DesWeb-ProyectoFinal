import { useState } from "react";
import type { AppUser, View } from "./types";
import { Layout } from "./components/Layout";
import Login from "./views/Login";
import AdminGeneral from "./views/AdminGeneral";
import AdminSede from "./views/admin-sede";
import Catedratico from "./views/Catedratico";
import Alumno from "./views/Alumno";
import Padre from "./views/Padre";

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

  function handleLogin(loggedUser: AppUser, loggedSede?: string) {
    setUser(loggedUser);
    setSede(loggedSede || loggedUser.sede);
    setCurrentView(DEFAULT_VIEWS[loggedUser.role] as View);
  }

  function handleLogout() {
    setUser(null);
    setSede(undefined);
  }

  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  function renderView() {
    if (!user) return null;
    switch (user.role) {
      case "admin-general": return <AdminGeneral view={currentView} />;
      case "admin-sede": return <AdminSede view={currentView} />;
      case "catedratico": return <Catedratico view={currentView} />;
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
      sede={sede}
    >
      {renderView()}
    </Layout>
  );
}

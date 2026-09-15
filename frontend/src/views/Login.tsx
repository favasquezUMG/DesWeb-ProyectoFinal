import { useState } from "react";
import { Eye, EyeOff, AlertCircle, BookOpen } from "lucide-react";
import type { AppUser } from "../types";
import { Btn, AlertBanner } from "../components/Ui";
import { login } from "../lib/api";
import { buildAppUser, saveSession } from "../lib/auth";

type Screen = "login" | "forgot" | "reset" | "sede";

interface LoginProps {
  onLogin: (user: AppUser, sede?: string) => void;
}

const SEDES_DEMO = ["Sede Central", "Sede Xela", "Sede Coatepeque"];

export default function Login({ onLogin }: LoginProps) {
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedSede, setSelectedSede] = useState("Sede Central");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      const appUser = buildAppUser(result.usuario);
      saveSession(result.token, appUser);

      // Multi-sede users get the sede selector
      if (appUser.role === "admin-general") {
        setSelectedUser(appUser);
        setScreen("sede");
      } else {
        onLogin(appUser, appUser.sede);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(
        message === "Invalid credentials" || !message
          ? "Correo electrónico o contraseña incorrectos. Verifique sus datos e intente de nuevo."
          : message
      );
    } finally {
      setLoading(false);
    }
  }

  function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { setLoading(false); setForgotSent(true); }, 900);
  }

  function handleSedeConfirm() {
    if (selectedUser) onLogin(selectedUser, selectedSede);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — brand */}
      <div className="hidden md:flex md:w-2/5 lg:w-1/2 bg-primary-700 flex-col justify-between p-10 relative overflow-hidden textile-pattern">
        {/* Decorative geometry */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-2 border-white/8" />
        <div className="absolute bottom-16 left-16 w-40 h-40 rounded-full border border-white/5" />
        <div className="absolute top-1/3 right-0 w-px h-48 bg-white/10" />

        <div>
          <p className="font-display text-white/60 text-sm tracking-widest uppercase">Portal Académico</p>
          <h1 className="font-display text-white text-4xl font-bold mt-2 leading-tight">COLEGIO_NOMBRE</h1>
          <p className="text-primary-200 mt-3 text-base leading-relaxed max-w-xs">
            Sistema integral de gestión académica: matrícula, notas, horarios, asistencia y pagos.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3 text-primary-100">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center"><BookOpen className="w-4 h-4" /></div>
            <span className="text-sm">Basado en el CNB del MINEDUC</span>
          </div>
          <div className="flex items-center gap-3 text-primary-100">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/><rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".3"/></svg>
            </div>
            <span className="text-sm">Gestión multi-sede</span>
          </div>
          <div className="flex items-center gap-3 text-primary-100">
            <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </div>
            <span className="text-sm">Notas, asistencia y pagos en línea</span>
          </div>
        </div>

        <p className="text-primary-300 text-xs">© 2025 COLEGIO_NOMBRE · Todos los derechos reservados</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-sand-100">
        <div className="w-full max-w-sm">
          <div className="md:hidden mb-8 text-center">
            <p className="font-display font-bold text-primary-700 text-2xl">COLEGIO_NOMBRE</p>
            <p className="text-stone-500 text-sm">Sistema Académico</p>
          </div>

          {/* ── Login ── */}
          {screen === "login" && (
            <form onSubmit={handleLogin} noValidate>
              <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Iniciar sesión</h2>
              <p className="text-stone-500 text-sm mb-6">Ingrese su usuario y contraseña institucional.</p>

              {error && (
                <div className="mb-4">
                  <AlertBanner type="error" message={error} onClose={() => setError("")} />
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
                  <input
                    id="email" type="email" autoComplete="email" required
                    value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="usuario@colegio.edu.gt"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="password" className="block text-sm font-medium text-stone-700">Contraseña</label>
                    <button type="button" onClick={() => setScreen("forgot")} className="text-xs text-primary-700 hover:underline font-medium">¿Olvidó su contraseña?</button>
                  </div>
                  <div className="relative">
                    <input
                      id="password" type={showPass ? "text" : "password"} autoComplete="current-password" required
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full border border-stone-300 rounded-lg pl-3 pr-10 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700 transition-colors"
                    />
                    <button type="button" onClick={() => setShowPass(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors" aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <Btn type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-6 justify-center">
                {loading ? "Verificando…" : "Ingresar al sistema"}
              </Btn>
            </form>
          )}

          {/* ── Forgot password ── */}
          {screen === "forgot" && (
            <form onSubmit={handleForgot} noValidate>
              <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Recuperar contraseña</h2>
              <p className="text-stone-500 text-sm mb-6">Ingrese su correo institucional y le enviaremos un enlace para restablecer su contraseña.</p>

              {forgotSent ? (
                <div className="space-y-4">
                  <AlertBanner type="success" title="Correo enviado" message={`Revise la bandeja de entrada de ${forgotEmail}. El enlace expira en 24 horas.`} />
                  <Btn variant="outline" size="md" className="w-full justify-center" onClick={() => { setScreen("login"); setForgotSent(false); setForgotEmail(""); }}>
                    Volver al inicio de sesión
                  </Btn>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-stone-700 mb-1">Correo electrónico</label>
                    <input id="forgot-email" type="email" required value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                      placeholder="usuario@colegio.edu.gt"
                      className="w-full border border-stone-300 rounded-lg px-3 py-2.5 text-sm text-stone-900 placeholder-stone-400 bg-white focus:outline-none focus:ring-2 focus:ring-primary-700 transition-colors" />
                  </div>
                  <Btn type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
                    {loading ? "Enviando…" : "Enviar enlace de recuperación"}
                  </Btn>
                  <button type="button" onClick={() => setScreen("login")} className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-3 py-1">
                    ← Volver al inicio de sesión
                  </button>
                </>
              )}
            </form>
          )}

          {/* ── Sede selector ── */}
          {screen === "sede" && selectedUser && (
            <div>
              <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Seleccionar sede</h2>
              <p className="text-stone-500 text-sm mb-6">Su usuario tiene acceso a varias sedes. Seleccione la sede de trabajo para esta sesión.</p>

              <div className="space-y-2 mb-6">
                {SEDES_DEMO.map(s => (
                  <button key={s} type="button" onClick={() => setSelectedSede(s)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer text-left
                      ${selectedSede === s ? "border-primary-700 bg-primary-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedSede === s ? "border-primary-700" : "border-stone-300"}`}>
                      {selectedSede === s && <div className="w-2 h-2 rounded-full bg-primary-700" />}
                    </div>
                    <span className={`text-sm font-medium ${selectedSede === s ? "text-primary-900" : "text-stone-700"}`}>{s}</span>
                  </button>
                ))}
              </div>

              <Btn variant="primary" size="lg" className="w-full justify-center" onClick={handleSedeConfirm}>
                Continuar con {selectedSede}
              </Btn>
              <button type="button" onClick={() => setScreen("login")} className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-3 py-1">
                ← Cambiar usuario
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

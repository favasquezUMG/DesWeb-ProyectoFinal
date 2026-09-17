import { useState } from "react";
import { Eye, EyeOff, BookOpen, Users2, ShieldCheck, Download } from "lucide-react";
import type { AppUser } from "../types";
import { Btn, AlertBanner, Input, Card, Tabs, Badge } from "../components/Ui";
import SolicitudInscripcion from "../components/SolicitudInscripcion";
import { login } from "../lib/api";
import { buildAppUser, saveSession } from "../lib/auth";
import {
  type SolicitudGuardada,
  type EstadoSolicitud,
  buscarPorNumero,
  buscarPorDpiCorreo,
  resolverEstado,
} from "../lib/solicitudes";
import { generarConstanciaPdf } from "../lib/constanciaPdf";

type Screen = "login" | "forgot" | "reset" | "sede" | "solicitud" | "consulta";

const TABS_CONSULTA = ["Por número de solicitud", "Por DPI y correo"];

const BADGE_POR_ESTADO: Record<EstadoSolicitud, { variant: "info" | "warning" | "success" | "danger" | "neutral" }> = {
  "En revisión": { variant: "info" },
  "Documentos pendientes": { variant: "warning" },
  "Aprobada": { variant: "success" },
  "Rechazada": { variant: "danger" },
  "Vencida": { variant: "neutral" },
};

interface LoginProps {
  onLogin: (user: AppUser, sede?: string) => void;
}

const SEDES_DEMO = ["Sede Central", "Sede Xela", "Sede Coatepeque"];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(value: string): string {
  if (!value.trim()) return "El correo electrónico es obligatorio.";
  if (!EMAIL_RE.test(value.trim())) return "Ingrese un correo electrónico válido.";
  return "";
}

function validarPassword(value: string): string {
  if (!value) return "La contraseña es obligatoria.";
  if (value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return "";
}

export default function Login({ onLogin }: LoginProps) {
  const [screen, setScreen] = useState<Screen>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedSede, setSelectedSede] = useState("Sede Central");

  const [consultaTab, setConsultaTab] = useState<"numero" | "dpi">("numero");
  const [consultaNumero, setConsultaNumero] = useState("");
  const [consultaDpi, setConsultaDpi] = useState("");
  const [consultaCorreo, setConsultaCorreo] = useState("");
  const [consultaError, setConsultaError] = useState("");
  const [consultaResultado, setConsultaResultado] = useState<SolicitudGuardada | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const emailErr = validarEmail(email);
    const passwordErr = validarPassword(password);
    setEmailError(emailErr);
    setPasswordError(passwordErr);
    if (emailErr || passwordErr) return;

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

  function volverAlLogin() {
    setScreen("login");
  }

  function reiniciarConsulta() {
    setConsultaTab("numero");
    setConsultaNumero("");
    setConsultaDpi("");
    setConsultaCorreo("");
    setConsultaError("");
    setConsultaResultado(null);
  }

  function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    setConsultaError("");
    setConsultaResultado(null);

    let encontrada: SolicitudGuardada | null = null;
    if (consultaTab === "numero") {
      if (!consultaNumero.trim()) {
        setConsultaError("Ingrese el número de solicitud.");
        return;
      }
      encontrada = buscarPorNumero(consultaNumero);
    } else {
      if (!/^\d{13}$/.test(consultaDpi.trim())) {
        setConsultaError("El DPI debe tener 13 dígitos.");
        return;
      }
      const correoErr = validarEmail(consultaCorreo);
      if (correoErr) {
        setConsultaError(correoErr);
        return;
      }
      encontrada = buscarPorDpiCorreo(consultaDpi, consultaCorreo);
    }

    if (!encontrada) {
      setConsultaError("No se encontró ninguna solicitud con esos datos.");
      return;
    }
    setConsultaResultado(encontrada);
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Left panel — brand */}
      <div className="hidden md:flex md:w-2/5 lg:w-1/2 bg-primary-700 flex-col p-10 lg:p-14 relative overflow-hidden textile-pattern">
        {/* Decorative geometry */}
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border-2 border-white/8" />
        <div className="absolute bottom-16 left-16 w-40 h-40 rounded-full border border-white/5" />
        <div className="absolute top-1/3 right-0 w-px h-48 bg-white/10" />

        {/* Título y características se centran juntos como un solo bloque, con un
            espacio fijo (no proporcional) entre ellos — evita el hueco enorme que
            dejaba el justify-between original cuando el panel es muy alto. */}
        <div className="flex-1 flex flex-col justify-center">
          <div>
            <p className="font-display text-white/60 text-sm tracking-widest uppercase">Portal Académico</p>
            <h1 className="font-display text-white text-4xl lg:text-5xl font-bold mt-2 leading-tight">Colegio Vanguardia</h1>
            <p className="text-primary-200 mt-4 text-base leading-relaxed max-w-sm">
              Sistema integral de gestión académica: matrícula, notas, horarios, asistencia y pagos.
            </p>
          </div>

          <div className="space-y-4 mt-10">
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><BookOpen className="w-4 h-4" /></div>
              <span className="text-sm">El mejor colegio del país</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><rect x="2" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".7"/><rect x="9" y="2" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="2" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".5"/><rect x="9" y="9" width="5" height="5" rx="1" fill="currentColor" opacity=".3"/></svg>
              </div>
              <span className="text-sm">Gestión multi-sede</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5"/><path d="M8 5v3l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              </div>
              <span className="text-sm">Notas, asistencia y pagos en línea</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><Users2 className="w-4 h-4" /></div>
              <span className="text-sm">Solicitud de inscripción en línea</span>
            </div>
            <div className="flex items-center gap-3 text-primary-100">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><ShieldCheck className="w-4 h-4" /></div>
              <span className="text-sm">Acceso seguro por roles</span>
            </div>
          </div>
        </div>

        <p className="text-primary-300 text-xs">© 2025 Colegio Vanguardia · Todos los derechos reservados</p>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-6 sm:p-10 bg-sand-100">
        <div className={`w-full ${screen === "solicitud" ? "max-w-2xl" : screen === "consulta" ? "max-w-md" : "max-w-sm"} transition-[max-width] duration-200`}>
          <div className="md:hidden mb-8 text-center">
            <p className="font-display font-bold text-primary-700 text-2xl">Colegio Vanguardia</p>
            <p className="text-stone-500 text-sm">Sistema Académico</p>
          </div>

          <Card className="p-6 sm:p-8">
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
                  <Input
                    label="Correo electrónico"
                    id="email" type="email" autoComplete="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setEmailError(""); }}
                    onBlur={() => setEmailError(validarEmail(email))}
                    error={emailError}
                    placeholder="usuario@colegio.edu.gt"
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="text-sm font-medium text-stone-700">Contraseña</label>
                      <button type="button" onClick={() => setScreen("forgot")} className="text-xs text-primary-700 hover:underline font-medium">¿Olvidó su contraseña?</button>
                    </div>
                    <Input
                      id="password" type={showPass ? "text" : "password"} autoComplete="current-password"
                      value={password}
                      onChange={e => { setPassword(e.target.value); setPasswordError(""); }}
                      onBlur={() => setPasswordError(validarPassword(password))}
                      error={passwordError}
                      placeholder="••••••••"
                      suffix={
                        <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                          className="pointer-events-auto text-stone-400 hover:text-stone-600 transition-colors" aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}>
                          {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      }
                    />
                  </div>
                </div>

                <Btn type="submit" variant="primary" size="lg" loading={loading} className="w-full mt-6 justify-center">
                  {loading ? "Verificando…" : "Ingresar al sistema"}
                </Btn>

                <button type="button" onClick={() => setScreen("solicitud")}
                  className="w-full text-center text-sm text-primary-700 hover:underline font-medium mt-4 py-1">
                  ¿Primer ingreso? Solicite la inscripción de su hijo
                </button>
                <button type="button" onClick={() => setScreen("consulta")}
                  className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-1 py-1">
                  Consultar estado de mi solicitud
                </button>
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
                      <Input
                        label="Correo electrónico"
                        id="forgot-email" type="email" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                        placeholder="usuario@colegio.edu.gt"
                      />
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

            {/* ── Solicitud de inscripción ── */}
            {screen === "solicitud" && (
              <SolicitudInscripcion modo="publico" onFinalizar={volverAlLogin} onCancelar={volverAlLogin} />
            )}

            {/* ── Consultar estado de solicitud ── */}
            {screen === "consulta" && (
              <div>
                <h2 className="font-display text-2xl font-semibold text-stone-900 mb-1">Consultar estado de solicitud</h2>
                <p className="text-stone-500 text-sm mb-6">Ingrese el número de solicitud, o el DPI y correo del encargado.</p>

                <Tabs
                  tabs={TABS_CONSULTA}
                  active={consultaTab === "numero" ? TABS_CONSULTA[0] : TABS_CONSULTA[1]}
                  onChange={(t) => {
                    setConsultaTab(t === TABS_CONSULTA[0] ? "numero" : "dpi");
                    setConsultaResultado(null);
                    setConsultaError("");
                  }}
                />

                <form onSubmit={handleConsultar} noValidate className="mt-4 space-y-4">
                  {consultaTab === "numero" ? (
                    <Input
                      label="Número de solicitud" value={consultaNumero}
                      onChange={(e) => setConsultaNumero(e.target.value)}
                      placeholder="SOL-2026-00001"
                    />
                  ) : (
                    <>
                      <Input
                        label="DPI del encargado" value={consultaDpi} inputMode="numeric" placeholder="0000000000000"
                        onChange={(e) => setConsultaDpi(e.target.value.replace(/\D/g, "").slice(0, 13))}
                      />
                      <Input
                        label="Correo electrónico" type="email" value={consultaCorreo}
                        onChange={(e) => setConsultaCorreo(e.target.value)}
                        placeholder="encargado@correo.com"
                      />
                    </>
                  )}

                  {consultaError && <AlertBanner type="error" message={consultaError} onClose={() => setConsultaError("")} />}

                  <Btn type="submit" variant="primary" size="lg" className="w-full justify-center">Buscar solicitud</Btn>
                </form>

                {consultaResultado && (() => {
                  const { estado, motivo } = resolverEstado(consultaResultado);
                  const cfg = BADGE_POR_ESTADO[estado];
                  return (
                    <div className="mt-6 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-stone-500">Solicitud</p>
                          <p className="font-mono-data font-semibold text-stone-900">{consultaResultado.numero}</p>
                        </div>
                        <Badge variant={cfg.variant}>{estado}</Badge>
                      </div>

                      {estado === "Aprobada" && (
                        <AlertBanner type="success" title="Solicitud aprobada"
                          message={`Sus credenciales de acceso fueron enviadas a ${consultaResultado.encargado.correo}.`} />
                      )}
                      {(estado === "Rechazada" || estado === "Vencida") && (
                        <AlertBanner type="error" title={estado === "Vencida" ? "Solicitud vencida" : "Solicitud rechazada"}
                          message={motivo ?? ""} />
                      )}
                      {(estado === "En revisión" || estado === "Documentos pendientes") && (
                        <AlertBanner type="info" title="Su solicitud sigue en proceso"
                          message={`Le avisaremos por correo a ${consultaResultado.encargado.correo} en cuanto haya una resolución (hasta 5 días hábiles).`} />
                      )}

                      <Btn variant="outline" size="md" className="w-full justify-center" icon={<Download className="w-4 h-4" />}
                        onClick={() => generarConstanciaPdf(consultaResultado)}>
                        Volver a descargar constancia
                      </Btn>
                    </div>
                  );
                })()}

                <button type="button" onClick={() => { reiniciarConsulta(); setScreen("login"); }}
                  className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-4 py-1">
                  ← Volver al inicio de sesión
                </button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { Eye, EyeOff, BookOpen, Users2, ShieldCheck, Download, GraduationCap, ArrowLeft } from "../components/Iconos";
import { Sede, type AppUser, type Role } from "../types";
import type { Portal } from "./Home";
import { Btn, AlertBanner, Input, Card, Tabs, Badge } from "../components/Ui";
import SolicitudInscripcion from "../components/SolicitudInscripcion";
import { type SedeDto, getSedes, login, restablecerPassword, solicitarRecuperacion } from "../lib/api";
import { buildAppUser, clearSession, mapBackendRole, saveSession } from "../lib/auth";
import {
  type SolicitudGuardada,
  type EstadoSolicitud,
  buscarPorNumero,
  buscarPorDpiCorreo,
  resolverEstado,
} from "../lib/solicitudes";
import { generarConstanciaPdf } from "../lib/constanciaPdf";

export type Screen = "login" | "forgot" | "reset" | "sede" | "solicitud" | "consulta";

// Qué roles pueden entrar por cada portal. Los encargados usan el portal de
// estudiantes porque consultan la información de sus hijos.
const ROLES_POR_PORTAL: Record<Portal, Role[]> = {
  estudiante: ["alumno", "padre"],
  personal: ["catedratico", "admin-sede", "admin-general"],
};

const PORTALES: { id: Portal; label: string; Icon: typeof GraduationCap; titulo: string; texto: string; placeholder: string }[] = [
  {
    id: "estudiante", label: "Estudiantes y familias", Icon: GraduationCap,
    titulo: "Portal de estudiantes",
    texto: "Ingrese con el correo de alumno o de encargado.",
    placeholder: "alumno@colegio.edu.gt",
  },
  {
    id: "personal", label: "Catedráticos y administración", Icon: ShieldCheck,
    titulo: "Portal del personal",
    texto: "Ingrese con su usuario y contraseña institucional.",
    placeholder: "usuario@colegio.edu.gt",
  },
];

const TABS_CONSULTA = ["Por número de solicitud", "Por DPI y correo"];

const BADGE_POR_ESTADO: Record<EstadoSolicitud, { variant: "info" | "warning" | "success" | "danger" | "neutral" }> = {
  "REVISION": { variant: "info" },
  "PENDIENTE": { variant: "warning" },
  "APROBADA": { variant: "success" },
  "RECHAZADA": { variant: "danger" },
  "VENCIDA": { variant: "neutral" },
};

interface LoginProps {
  onLogin: (user: AppUser, sede?: string) => void;
  onBack: () => void;
  initialPortal?: Portal;
  initialScreen?: Screen;
  resetToken?: string;
}


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(value: string): string {
  if (!value.trim()) return "El correo electrónico es obligatorio.";
  if (!EMAIL_RE.test(value.trim())) return "Ingrese un correo electrónico válido.";
  return "";
}

function validarPassword(value: string): string {
  if (!value) return "La contraseña es obligatoria.";
  //if (value.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  return "";
}

export default function Login({ onLogin, onBack, initialPortal = "estudiante", initialScreen = "login", resetToken }: LoginProps) {
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [portal, setPortal] = useState<Portal>(initialPortal);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetDone, setResetDone] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [selectedSede, setSelectedSede] = useState("Sede Central");

  const [sedes, setSedes] = useState<SedeDto[]>([]);

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
      let result = await login(email.trim(), password);
      let appUser = buildAppUser(result.usuario);

      if (!ROLES_POR_PORTAL[portal].includes(appUser.role)) {
        // Si la persona tiene otro rol que sí corresponde a este portal (ej. un catedrático que
        // también es padre y entra por el portal de familias), se entra con ese rol
        const rolDelPortal = appUser.roles?.find(r => ROLES_POR_PORTAL[portal].includes(mapBackendRole(r.nombre)));
        if (rolDelPortal) {
          result = await login(email.trim(), password, rolDelPortal.rolId);
          appUser = buildAppUser(result.usuario);
        } else {
          clearSession();
          const otro = PORTALES.find(p => p.id !== portal)!;
          setError(`Esta cuenta no pertenece a este portal. Ingrese desde "${otro.label}".`);
          return;
        }
      }

      saveSession(result.token, appUser);

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

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    const err = validarEmail(forgotEmail);
    setForgotError(err);
    if (err) return;

    setLoading(true);
    try {
      await solicitarRecuperacion(forgotEmail.trim());
      setForgotSent(true);
    } catch (error) {
      setForgotError(error instanceof Error ? error.message : "No se pudo enviar el correo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword.length < 8) return setResetError("La contraseña debe tener al menos 8 caracteres.");
    if (newPassword !== confirmPassword) return setResetError("Las contraseñas no coinciden.");
    if (!resetToken) return setResetError("El enlace no es válido. Solicite uno nuevo.");

    setResetError("");
    setLoading(true);
    try {
      await restablecerPassword(resetToken, newPassword);
      setResetDone(true);
    } catch (error) {
      setResetError(error instanceof Error ? error.message : "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  function handleSedeConfirm() {
    if (selectedUser) onLogin(selectedUser, selectedSede);
  }

  function volverAlLogin() {
    setScreen("login");
  }

  function cambiarPortal(nuevo: Portal) {
    setPortal(nuevo);
    setError("");
    setEmailError("");
    setPasswordError("");
  }

  const portalActual = PORTALES.find(p => p.id === portal)!;

  function reiniciarConsulta() {
    setConsultaTab("numero");
    setConsultaNumero("");
    setConsultaDpi("");
    setConsultaCorreo("");
    setConsultaError("");
    setConsultaResultado(null);
  }

  async function handleConsultar(e: React.FormEvent) {
    e.preventDefault();
    setConsultaError("");
    setConsultaResultado(null);

    let encontrada: SolicitudGuardada | null = null;
    if (consultaTab === "numero") {
      if (!consultaNumero.trim()) {
        setConsultaError("Ingrese el número de solicitud.");
        return;
      }
      encontrada = await buscarPorNumero(consultaNumero);
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
      encontrada = await buscarPorDpiCorreo(consultaDpi, consultaCorreo);
    }

    if (!encontrada) {
      setConsultaError("No se encontró ninguna solicitud con esos datos.");
      return;
    }
    setConsultaResultado(encontrada);
  }

  useEffect(() => {
    async function cargarSedes() {
      try{
        const data = await getSedes();
        setSedes(data);
      } catch (error) {
        console.error("Error al cargar datos desde el backend:", error)
      }
    }
    cargarSedes();

  }, [])

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Panel izquierdo: marca */}
      <div className="hidden md:flex md:w-2/5 lg:w-[46%] bg-anil-800 textile-pattern text-white flex-col p-10 lg:p-14 relative overflow-hidden">
        <button type="button" onClick={onBack} className="flex items-center gap-3 self-start cursor-pointer group">
          <span className="w-11 h-11 rounded-[14px] bg-action-500 text-white flex items-center justify-center font-display font-extrabold text-xl rotate-[-4deg]">V</span>
          <span className="font-display font-bold text-lg group-hover:text-subject-social transition-colors">Colegio Vanguardia</span>
        </button>

        <div className="relative flex-1 flex flex-col justify-center py-10">
          <h1 className="font-display font-extrabold text-5xl lg:text-6xl leading-[0.98] tracking-tight max-w-md">
            Todo el colegio en un solo lugar
          </h1>
          <p className="text-white/70 mt-5 text-[17px] leading-relaxed max-w-sm">
            Matrícula, notas, horarios, asistencia y pagos para alumnos, familias y docentes.
          </p>

          <div className="flex gap-2.5 mt-10" aria-hidden="true">
            {["bg-subject-math", "bg-subject-language", "bg-subject-science", "bg-subject-social", "bg-subject-english", "bg-subject-arts"].map((c, i) => (
              <span key={c} className={`w-11 h-11 rounded-2xl ${c} ${i % 2 ? "rotate-[4deg] translate-y-1.5" : "rotate-[-3deg]"}`} />
            ))}
          </div>

          <ul className="mt-10 space-y-3 text-[15px] text-white/85">
            {[[BookOpen, "Notas y boletas por unidad"], [Users2, "Solicitud de inscripción en línea"], [ShieldCheck, "Acceso seguro según su rol"]].map(([Icon, t]) => {
              const I = Icon as typeof BookOpen;
              return <li key={t as string} className="flex items-center gap-3"><I className="w-5 h-5 text-subject-social shrink-0" />{t as string}</li>;
            })}
          </ul>
        </div>

        <div className="relative flex items-center justify-between gap-4 text-xs text-white/55">
          <p>© {new Date().getFullYear()} Colegio Vanguardia</p>
          <button type="button" onClick={onBack} className="hover:text-white font-semibold flex items-center gap-1 cursor-pointer shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio
          </button>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto p-5 sm:p-10 bg-sand-100">
        <div className={`w-full ${screen === "solicitud" ? "max-w-2xl" : screen === "consulta" ? "max-w-md" : "max-w-sm"} transition-[max-width] duration-200`}>
          <div className="md:hidden mb-8 text-center">
            <button type="button" onClick={onBack} className="cursor-pointer inline-flex flex-col items-center gap-3">
              <span className="w-12 h-12 rounded-[16px] bg-action-500 text-white flex items-center justify-center font-display font-extrabold text-2xl rotate-[-4deg]">V</span>
              <span className="font-display font-bold text-stone-900 text-2xl">Colegio Vanguardia</span>
            </button>
            <p className="text-stone-500 text-sm">Sistema académico</p>
            <button type="button" onClick={onBack} className="mt-2 text-xs text-stone-500 hover:text-stone-700 inline-flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /> Volver al inicio
            </button>
          </div>

          <Card className="p-6 sm:p-9 rounded-[28px] border-transparent">
            {screen === "login" && (
              <form onSubmit={handleLogin} noValidate>
                <div className="grid grid-cols-2 gap-1 p-1 mb-7 rounded-full bg-sand-100" role="tablist" aria-label="Tipo de acceso">
                  {PORTALES.map(({ id, label, Icon }) => (
                    <button key={id} type="button" role="tab" aria-selected={portal === id} onClick={() => cambiarPortal(id)}
                      className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-full text-xs font-bold transition-colors cursor-pointer
                        ${portal === id ? "bg-anil-800 text-white" : "text-stone-500 hover:text-stone-800"}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="leading-tight">{label}</span>
                    </button>
                  ))}
                </div>

                <h2 className="font-display text-[2rem] leading-tight font-bold text-stone-900 mb-1.5">{portalActual.titulo}</h2>
                <p className="text-stone-500 text-sm mb-6">{portalActual.texto}</p>

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
                    placeholder={portalActual.placeholder}
                  />

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label htmlFor="password" className="text-sm font-medium text-stone-700">Contraseña</label>
                      <button type="button" onClick={() => setScreen("forgot")} className="text-[13px] text-primary-700 hover:text-primary-900 font-bold">¿Olvidó su contraseña?</button>
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

                {portal === "estudiante" && (
                  <>
                    <button type="button" onClick={() => setScreen("solicitud")}
                      className="w-full text-center text-sm text-primary-700 hover:underline font-medium mt-4 py-1">
                      ¿Primer ingreso? Solicite la inscripción de su hijo
                    </button>
                    <button type="button" onClick={() => setScreen("consulta")}
                      className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-1 py-1">
                      Consultar estado de mi solicitud
                    </button>
                  </>
                )}
              </form>
            )}

            {screen === "forgot" && (
              <form onSubmit={handleForgot} noValidate>
                <h2 className="font-display text-2xl font-bold text-stone-900 mb-1">Recuperar contraseña</h2>
                <p className="text-stone-500 text-sm mb-6">Ingrese su correo institucional y le enviaremos un enlace para restablecer su contraseña.</p>

                {forgotSent ? (
                  <div className="space-y-4">
                    <AlertBanner type="success" title="Solicitud enviada" message={`Si ${forgotEmail} está registrado, recibirá un enlace para restablecer su contraseña. El enlace vence en 60 minutos.`} />
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
                        placeholder="usuario@colegio.edu.gt" error={forgotError}
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

            {screen === "reset" && (
              <form onSubmit={handleReset} noValidate>
                <h2 className="font-display text-2xl font-bold text-stone-900 mb-1">Nueva contraseña</h2>
                <p className="text-stone-500 text-sm mb-6">Escriba la contraseña que usará a partir de ahora (mínimo 8 caracteres).</p>

                {resetDone ? (
                  <div className="space-y-4">
                    <AlertBanner type="success" title="Contraseña actualizada" message="Ya puede iniciar sesión con su nueva contraseña." />
                    <Btn variant="primary" size="md" className="w-full justify-center" onClick={() => setScreen("login")}>
                      Ir a iniciar sesión
                    </Btn>
                  </div>
                ) : (
                  <>
                    {resetError && <div className="mb-4"><AlertBanner type="error" message={resetError} /></div>}
                    <div className="mb-4">
                      <Input
                        label="Nueva contraseña"
                        id="reset-password" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <div className="mb-4">
                      <Input
                        label="Confirmar contraseña"
                        id="reset-confirm" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                      />
                    </div>
                    <Btn type="submit" variant="primary" size="lg" loading={loading} className="w-full justify-center">
                      {loading ? "Guardando…" : "Guardar contraseña"}
                    </Btn>
                    <button type="button" onClick={() => setScreen("forgot")} className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-3 py-1">
                      Solicitar un enlace nuevo
                    </button>
                  </>
                )}
              </form>
            )}

            {screen === "sede" && selectedUser && (
              <div>
                <h2 className="font-display text-2xl font-bold text-stone-900 mb-1">Seleccionar sede</h2>
                <p className="text-stone-500 text-sm mb-6">Su usuario tiene acceso a varias sedes. Seleccione la sede de trabajo para esta sesión.</p>

                <div className="space-y-2 mb-6">
                  {sedes.map(s => (
                    <button key={s.sedeId} type="button" onClick={() => setSelectedSede(s.nombre)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-colors cursor-pointer text-left
                        ${selectedSede === s.nombre ? "border-primary-700 bg-primary-50" : "border-stone-200 bg-white hover:border-stone-300"}`}>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selectedSede === s.nombre ? "border-primary-700" : "border-stone-300"}`}>
                        {selectedSede === s.nombre && <div className="w-2 h-2 rounded-full bg-primary-700" />}
                      </div>
                      <span className={`text-sm font-medium ${selectedSede === s.nombre ? "text-primary-900" : "text-stone-700"}`}>{s.nombre}</span>
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

            {screen === "solicitud" && (
              <SolicitudInscripcion modo="publico" onFinalizar={volverAlLogin} onCancelar={volverAlLogin} />
            )}

            {screen === "consulta" && (
              <div>
                <h2 className="font-display text-2xl font-bold text-stone-900 mb-1">Consultar estado de solicitud</h2>
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
                          <p className="font-display font-bold tabular-nums text-stone-900">{consultaResultado.numero}</p>
                        </div>
                        <Badge variant={cfg.variant}>{estado}</Badge>
                      </div>

                      {estado === "APROBADA" && (
                        <AlertBanner type="success" title="Solicitud aprobada"
                          message={`Sus credenciales de acceso fueron enviadas a ${consultaResultado.encargado.correo}.`} />
                      )}
                      {(estado === "RECHAZADA" || estado === "VENCIDA") && (
                        <AlertBanner type="error" title={estado === "VENCIDA" ? "Solicitud vencida" : "Solicitud rechazada"}
                          message={motivo ?? ""} />
                      )}
                      {(estado === "REVISION" || estado === "PENDIENTE") && (
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

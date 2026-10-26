import { Children, isValidElement, useLayoutEffect, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "./Iconos";

// ─── Color por curso ─────────────────────────────────────────────────────────
// Cada materia tiene un color estable (se calcula a partir de su nombre), así
// "Matemática" se ve igual en el horario, las notas y la libreta.

export type ColorCurso = { solid: string; soft: string; text: string; border: string; bar: string; fg: string; hex: string };

// Colores del tejido típico: añil, granate, verde quetzal, maíz, morado y fucsia
const COLORES_CURSO: ColorCurso[] = [
  { solid: "bg-subject-math", soft: "bg-[#e9ebf5]", text: "text-[#2b3a8c]", border: "border-[#2b3a8c]", bar: "bg-subject-math", fg: "text-white", hex: "#2b3a8c" },
  { solid: "bg-subject-language", soft: "bg-[#f7e6e7]", text: "text-[#9a1b24]", border: "border-[#b3202a]", bar: "bg-subject-language", fg: "text-white", hex: "#b3202a" },
  { solid: "bg-subject-science", soft: "bg-[#e3f1ec]", text: "text-[#0b6650]", border: "border-[#0f7b5f]", bar: "bg-subject-science", fg: "text-white", hex: "#0f7b5f" },
  { solid: "bg-subject-social", soft: "bg-[#fdf3d2]", text: "text-[#7a5600]", border: "border-[#f2b705]", bar: "bg-subject-social", fg: "text-stone-900", hex: "#f2b705" },
  { solid: "bg-subject-english", soft: "bg-[#efe5f2]", text: "text-[#5a2468]", border: "border-[#6b2d7b]", bar: "bg-subject-english", fg: "text-white", hex: "#6b2d7b" },
  { solid: "bg-subject-arts", soft: "bg-[#fbe6ef]", text: "text-[#a8285e]", border: "border-[#d63a7a]", bar: "bg-subject-arts", fg: "text-white", hex: "#d63a7a" },
];

// Palabras clave para que las materias comunes caigan en un color con sentido
const CLAVES: [RegExp, number][] = [
  [/matem|álgebra|algebra|aritm|geometr|estad|cálculo|calculo|contab|finanz/i, 0],
  [/lengua|idioma espa|comunicaci|literat|lectura|redacci|ortograf/i, 1],
  [/cienc|biolog|qu[ií]mica|f[ií]sica|natur|ambient|salud/i, 2],
  [/social|historia|geograf|c[ií]vica|ciudadan|econom|filosof|psicolog/i, 3],
  [/ingl[eé]s|english|franc|alem|mandar|kaqchikel|k'iche|idioma/i, 4],
  [/arte|art[ií]st|m[uú]sica|dibujo|pl[aá]stic|danza|teatro|educaci[oó]n f[ií]sica|deporte|tecnolog|computa|inform|program/i, 5],
];

export function colorDeCurso(nombre: string | number | null | undefined): ColorCurso {
  const texto = String(nombre ?? "");
  for (const [re, i] of CLAVES) if (re.test(texto)) return COLORES_CURSO[i];
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) >>> 0;
  return COLORES_CURSO[h % COLORES_CURSO.length];
}

/** Cuadrito con la inicial del curso en su color */
export function CursoMarca({ nombre, size = "md" }: { nombre: string; size?: "sm" | "md" | "lg" }) {
  const c = colorDeCurso(nombre);
  const dims = { sm: "w-7 h-7 text-xs rounded-lg", md: "w-9 h-9 text-sm rounded-xl", lg: "w-12 h-12 text-lg rounded-2xl" }[size];
  return (
    <span className={`${dims} ${c.solid} ${c.fg} font-display font-bold inline-flex items-center justify-center shrink-0`} aria-hidden="true">
      {nombre.trim().charAt(0).toUpperCase() || "·"}
    </span>
  );
}

// ─── Botones ─────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const BTN_BASE = "inline-flex items-center gap-2 font-semibold rounded-full cursor-pointer transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-45 disabled:cursor-not-allowed select-none";
const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-primary-700 text-white hover:bg-primary-800 active:bg-primary-900 focus-visible:outline-primary-700",
  secondary: "bg-action-500 text-white hover:bg-action-600 active:bg-action-700 focus-visible:outline-action-500",
  ghost: "bg-transparent text-stone-600 hover:bg-stone-900/5 hover:text-stone-900 active:bg-stone-900/10",
  destructive: "bg-danger-600 text-white hover:bg-danger-700 active:bg-danger-800",
  outline: "border-[1.5px] border-stone-300 bg-white text-stone-800 hover:border-stone-900 active:bg-stone-50",
};
const BTN_SIZES: Record<string, string> = {
  sm: "px-3.5 py-1.5 text-[13px]",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-[15px]",
};

export function Btn({ variant = "primary", size = "md", loading, icon, children, className = "", ...props }: BtnProps) {
  return (
    <button className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Campos ──────────────────────────────────────────────────────────────────

const CAMPO = "w-full bg-white text-stone-900 text-[15px] rounded-xl border-[1.5px] transition-colors focus:outline-none focus:border-primary-600 focus:ring-4 focus:ring-primary-600/10";
const LABEL = "text-[13px] font-semibold text-stone-700";

function CampoError({ error }: { error?: string }) {
  if (!error) return null;
  return <p className="text-xs text-danger-700 flex items-center gap-1 font-medium"><AlertCircle className="w-3.5 h-3.5" />{error}</p>;
}

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export function Input({ label, error, hint, prefix, suffix, className = "", id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={inputId} className={LABEL}>{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3.5 text-stone-400">{prefix}</span>}
        <input
          id={inputId}
          className={`${CAMPO} placeholder-stone-400
            ${error ? "border-danger-600 focus:border-danger-600 focus:ring-danger-600/10" : "border-stone-200 hover:border-stone-300"}
            ${prefix ? "pl-10" : "pl-3.5"} ${suffix ? "pr-10" : "pr-3.5"} py-2.5 ${className}`}
          {...props}
        />
        {suffix && <span className="absolute right-3.5 text-stone-400">{suffix}</span>}
      </div>
      <CampoError error={error} />
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = "", id, children, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={selectId} className={LABEL}>{label}</label>}
      <select
        id={selectId}
        className={`${CAMPO} py-2.5 pl-3.5 pr-9 appearance-none bg-no-repeat bg-[length:16px] bg-[position:right_12px_center]
          bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%236b7287' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")]
          ${error ? "border-danger-600" : "border-stone-200 hover:border-stone-300"} ${className}`}
        {...props}
      >
        {children}
      </select>
      <CampoError error={error} />
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label htmlFor={textareaId} className={LABEL}>{label}</label>}
      <textarea
        id={textareaId}
        rows={4}
        className={`${CAMPO} px-3.5 py-2.5 resize-none ${error ? "border-danger-600" : "border-stone-200 hover:border-stone-300"} ${className}`}
        {...props}
      />
      <CampoError error={error} />
    </div>
  );
}

// ─── Insignias ───────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "primary";

const BADGE_STYLES: Record<BadgeVariant, { cls: string; dot: string }> = {
  success: { cls: "bg-success-50 text-success-800", dot: "bg-success-600" },
  danger: { cls: "bg-danger-50 text-danger-800", dot: "bg-danger-600" },
  warning: { cls: "bg-warning-50 text-warning-800", dot: "bg-warning-600" },
  info: { cls: "bg-info-50 text-info-800", dot: "bg-info-600" },
  neutral: { cls: "bg-stone-100 text-stone-600", dot: "bg-stone-400" },
  primary: { cls: "bg-primary-50 text-primary-800", dot: "bg-primary-600" },
};

const PILL = "inline-flex items-center gap-1.5 pl-2 pr-2.5 py-[3px] text-xs font-semibold rounded-full whitespace-nowrap";

export function Badge({ variant = "neutral", children, className = "" }: { variant?: BadgeVariant; children: ReactNode; className?: string }) {
  const b = BADGE_STYLES[variant];
  // Si la insignia ya trae un ícono, no se agrega el punto de color
  const primero = Children.toArray(children)[0];
  const traeIcono = isValidElement(primero);
  return (
    <span className={`${PILL} ${traeIcono ? "pl-2" : ""} ${b.cls} ${className} [&>svg]:w-3.5 [&>svg]:h-3.5`}>
      {!traeIcono && <span className={`w-1.5 h-1.5 rounded-full ${b.dot}`} aria-hidden="true" />}
      {children}
    </span>
  );
}

export function EstadoBadge({ aprobado, label }: { aprobado: boolean; label?: string }) {
  return (
    <span className={`${PILL} ${aprobado ? "bg-success-50 text-success-800" : "bg-danger-50 text-danger-800"}`}
      aria-label={aprobado ? "Aprobado" : "Reprobado"}
    >
      {aprobado ? <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" /> : <AlertCircle className="w-3.5 h-3.5" aria-hidden="true" />}
      {label ?? (aprobado ? "Aprobado" : "Reprobado")}
    </span>
  );
}

export function PagoBadge({ estado }: { estado: "pagado" | "pendiente" | "vencido" }) {
  const cfg = {
    pagado: { cls: "bg-success-50 text-success-800", icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Pagado" },
    pendiente: { cls: "bg-warning-50 text-warning-800", icon: <AlertTriangle className="w-3.5 h-3.5" />, label: "Pendiente" },
    vencido: { cls: "bg-danger-50 text-danger-800", icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Vencido" },
  }[estado];
  return <span className={`${PILL} ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>;
}

// ─── Contenedores ────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-stone-200/80 rounded-[20px] ${className}`}>{children}</div>;
}

const METRIC_CFG = {
  default: { num: "text-stone-900", icon: "bg-primary-700 text-white" },
  success: { num: "text-success-700", icon: "bg-success-600 text-white" },
  warning: { num: "text-warning-700", icon: "bg-warning-600 text-white" },
  danger: { num: "text-danger-700", icon: "bg-danger-600 text-white" },
};

export function MetricCard({ label, value, sub, icon, variant = "default" }: {
  label: string; value: string | number; sub?: string; icon?: ReactNode; variant?: "default" | "success" | "warning" | "danger";
}) {
  const c = METRIC_CFG[variant];
  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        {icon && <span className={`icono-color w-9 h-9 rounded-full flex items-center justify-center shrink-0 [&>svg]:w-5 [&>svg]:h-5 ${c.icon}`}>{icon}</span>}
        <p className="text-sm font-semibold text-stone-600 leading-tight">{label}</p>
      </div>
      <div>
        {/* Un monto no se parte a la mitad: solo se corta en los espacios, y los valores largos
            (ej. "Q2,550.00 / Q2,500.00") van con letra más chica para caber en media pantalla */}
        <p className={`font-display font-bold tabular-nums tracking-tight ${String(value).length > 9 ? "text-[clamp(1.25rem,2vw,1.9rem)] leading-tight" : "text-[clamp(1.7rem,2.6vw,2.4rem)] leading-none"} ${c.num}`}>{value}</p>
        {sub && <p className="text-[13px] text-stone-500 mt-2 leading-snug">{sub}</p>}
      </div>
    </Card>
  );
}

type AlertType = "info" | "success" | "warning" | "error";

const ALERT_CFG: Record<AlertType, { cls: string; icon: string; Icon: typeof Info }> = {
  info: { cls: "bg-info-50 text-info-800", icon: "text-info-600", Icon: Info },
  success: { cls: "bg-success-50 text-success-800", icon: "text-success-600", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-50 text-warning-800", icon: "text-warning-600", Icon: AlertTriangle },
  error: { cls: "bg-danger-50 text-danger-800", icon: "text-danger-600", Icon: AlertCircle },
};

export function AlertBanner({ type, title, message, onClose }: { type: AlertType; title?: string; message: string; onClose?: () => void }) {
  const { cls, icon, Icon } = ALERT_CFG[type];
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl ${cls}`} role="alert">
      <Icon className={`w-5 h-5 mt-px shrink-0 ${icon}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-bold text-sm">{title}</p>}
        <p className="text-sm leading-relaxed">{message}</p>
      </div>
      {onClose && <button onClick={onClose} className="shrink-0 p-1 -m-1 rounded-full hover:bg-black/5 transition-colors cursor-pointer" aria-label="Cerrar"><X className="w-4 h-4" /></button>}
    </div>
  );
}

function CerrarBtn({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} className="w-9 h-9 -mr-2 rounded-full flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer" aria-label="Cerrar">
      <X className="w-5 h-5" />
    </button>
  );
}

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4" aria-modal="true" role="dialog" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-primary-900/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-[28px] sm:rounded-[28px] shadow-xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-3">
          <h2 id="modal-title" className="font-display font-bold text-stone-900 text-[1.35rem] leading-tight">{title}</h2>
          <CerrarBtn onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5 pt-1">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-end gap-2.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-primary-900/40 transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      {/* Cerrado queda fuera de la pantalla: sin sombra (asomaba por el borde) e inerte (no recibe foco) */}
      <div inert={!open} className={`fixed right-0 top-0 h-full z-50 w-full max-w-md bg-white sm:rounded-l-[28px] transition-transform duration-300 flex flex-col ${open ? "translate-x-0 shadow-2xl" : "translate-x-full"}`} aria-modal="true" role="dialog">
        <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4 shrink-0">
          <h2 className="font-display font-bold text-stone-900 text-[1.35rem] leading-tight">{title}</h2>
          <CerrarBtn onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 pb-5">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-100 flex items-center justify-end gap-2.5 shrink-0">{footer}</div>}
      </div>
    </>
  );
}

/** Pestañas de carpeta: la activa se une con el contenido de abajo */
export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex items-end gap-1 border-b-[1.5px] border-stone-200 overflow-x-auto scrollbar-hide" role="tablist">
      {tabs.map(tab => {
        const on = active === tab;
        return (
          <button
            key={tab}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(tab)}
            className={`relative -mb-[1.5px] px-4 pt-2.5 pb-2 text-sm whitespace-nowrap rounded-t-xl border-[1.5px] transition-colors cursor-pointer
              ${on
                ? "bg-white border-stone-200 border-b-white text-primary-800 font-bold"
                : "border-transparent text-stone-500 font-semibold hover:text-stone-900"}`}
          >
            {on && <span className="absolute left-3 right-3 top-0 h-[3px] rounded-b-full bg-primary-600" aria-hidden="true" />}
            {tab}
          </button>
        );
      })}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="ruled flex flex-col items-center justify-center py-14 px-6 text-center bg-white rounded-[20px] border border-stone-200/80">
      {icon && (
        <div className="icono-color w-16 h-16 rounded-full bg-white border-[1.5px] border-primary-200 text-primary-700 flex items-center justify-center mb-4 [&>svg]:w-8 [&>svg]:h-8">
          {icon}
        </div>
      )}
      <p className="font-display font-bold text-stone-900 text-xl mb-1.5 bg-white px-2">{title}</p>
      {description && <p className="text-sm text-stone-600 max-w-sm bg-white px-2 leading-relaxed">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step} className="flex items-start flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-display font-bold transition-colors
                ${done ? "bg-primary-700 text-white" : active ? "bg-action-500 text-white" : "bg-white border-[1.5px] border-stone-300 text-stone-400"}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              {/* En pantallas angostas solo se lee el nombre del paso actual: los cuatro no caben */}
              <span className={`text-xs mt-1.5 font-semibold whitespace-nowrap ${active ? "text-stone-900" : `sr-only sm:not-sr-only ${done ? "text-primary-700" : "text-stone-400"}`}`}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-[3px] mx-2 mt-[16.5px] rounded-full transition-colors ${done ? "bg-primary-700" : "bg-stone-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2
          ${checked ? "bg-primary-700" : "bg-stone-300"}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
      {label && <span className="text-sm font-medium text-stone-700">{label}</span>}
    </label>
  );
}

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-6 pb-1">
      <div className="min-w-0">
        <h1 className="font-display text-[1.9rem] md:text-[2.25rem] leading-[1.1] font-bold text-stone-900">{title}</h1>
        {subtitle && <p className="text-[15px] text-stone-500 mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function TH({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 pt-4 pb-2.5 text-left text-[13px] font-semibold text-stone-500 border-b-[1.5px] border-stone-200 bg-white ${className}`}>{children}</th>;
}

export function TD({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3.5 text-sm text-stone-800 ${className}`}>{children}</td>;
}

// Con el contenedor por debajo de este ancho, una tabla que no cabe se muestra en tarjetas;
// por encima se deja la tabla con scroll horizontal (en escritorio se lee mejor así)
const ANCHO_MAX_TARJETAS = 1000;

/**
 * Tabla que, cuando no cabe a lo ancho (teléfonos, tabletas), muestra cada fila como una
 * tarjeta (ver .tabla-movil.tarjetas en index.css). Cada celda toma como etiqueta el texto
 * de su encabezado, así no hay que repetirlo en cada TD.
 */
export function TablaResponsiva({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const etiquetar = () => {
      const encabezados = [...el.querySelectorAll("thead th")].map((th) => th.textContent?.trim() ?? "");
      el.querySelectorAll("tbody tr").forEach((tr) => {
        let columna = 0;
        for (const celda of tr.children as HTMLCollectionOf<HTMLTableCellElement>) {
          if (celda.colSpan > 1) celda.removeAttribute("data-label");
          else celda.setAttribute("data-label", encabezados[columna] ?? "");
          columna += celda.colSpan || 1;
        }
      });
    };
    // Se mide en modo tabla y se decide; corre antes de pintar, así no hay parpadeo
    const decidir = () => {
      el.classList.remove("tarjetas");
      const noCabe = el.scrollWidth > el.clientWidth + 1;
      el.classList.toggle("tarjetas", el.clientWidth < 640 || (noCabe && el.clientWidth < ANCHO_MAX_TARJETAS));
    };
    etiquetar();
    decidir();
    const observador = new MutationObserver(() => { etiquetar(); decidir(); });
    observador.observe(el, { childList: true, subtree: true });
    // Solo importa el ancho: pasar a tarjetas cambia la altura y no debe volver a decidir
    let ultimoAncho = el.clientWidth;
    const redimension = new ResizeObserver(() => {
      if (el.clientWidth === ultimoAncho) return;
      ultimoAncho = el.clientWidth;
      decidir();
    });
    redimension.observe(el);
    return () => { observador.disconnect(); redimension.disconnect(); };
  }, []);

  return <div ref={ref} className="overflow-x-auto tabla-movil">{children}</div>;
}

// ─── Piezas pequeñas reutilizables ───────────────────────────────────────────

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** Fecha como hoja de calendario: día grande y mes corto */
export function FechaBloque({ iso, tono = "neutral" }: { iso: string; tono?: "neutral" | "primary" | "action" }) {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  const cls = { neutral: "bg-sand-100 text-stone-900", primary: "bg-primary-700 text-white", action: "bg-action-500 text-white" }[tono];
  return (
    <span className={`w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 leading-none ${cls}`}>
      <span className="font-display font-bold text-lg tabular-nums">{d}</span>
      <span className="text-[11px] font-semibold opacity-75 mt-0.5">{MESES_CORTOS[(m || 1) - 1]}</span>
    </span>
  );
}

/** Anillo de progreso (0–100) */
export function Anillo({ valor, size = 96, grosor = 10, color = "#2b3a8c", children }: {
  valor: number; size?: number; grosor?: number; color?: string; children?: ReactNode;
}) {
  const r = (size - grosor) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, valor));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e6dfd2" strokeWidth={grosor} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** Encabezado de una tarjeta con acción opcional a la derecha */
export function CardTitulo({ titulo, accion, className = "" }: { titulo: ReactNode; accion?: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-between gap-3 mb-4 ${className}`}>
      <h3 className="font-display font-bold text-stone-900 text-lg leading-tight">{titulo}</h3>
      {accion}
    </div>
  );
}

/** Enlace de texto para "ver todo" */
export function LinkAccion({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="text-[13px] font-bold text-primary-700 hover:text-primary-900 underline decoration-primary-200 decoration-2 underline-offset-4 hover:decoration-primary-500 transition-colors cursor-pointer">
      {children}
    </button>
  );
}

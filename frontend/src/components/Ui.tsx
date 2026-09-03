import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from "lucide-react";

// ─── Button ──────────────────────────────────────────────────────────────────

type BtnVariant = "primary" | "secondary" | "ghost" | "destructive" | "outline";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  icon?: ReactNode;
}

const BTN_BASE = "inline-flex items-center gap-2 font-medium rounded-md cursor-pointer transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none";
const BTN_VARIANTS: Record<BtnVariant, string> = {
  primary: "bg-primary-700 text-white hover:bg-primary-600 active:bg-primary-800 focus-visible:outline-primary-700",
  secondary: "bg-action-600 text-white hover:bg-action-500 active:bg-action-700 focus-visible:outline-action-600",
  ghost: "bg-transparent text-stone-700 hover:bg-stone-100 active:bg-stone-200",
  destructive: "bg-danger-700 text-white hover:bg-danger-600 active:bg-danger-800",
  outline: "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 active:bg-stone-100",
};
const BTN_SIZES: Record<string, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-2.5 text-base",
};

export function Btn({ variant = "primary", size = "md", loading, icon, children, className = "", ...props }: BtnProps) {
  return (
    <button className={`${BTN_BASE} ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`} disabled={loading || props.disabled} {...props}>
      {loading ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────

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
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={inputId} className="text-sm font-medium text-stone-700">{label}</label>}
      <div className="relative flex items-center">
        {prefix && <span className="absolute left-3 text-stone-400">{prefix}</span>}
        <input
          id={inputId}
          className={`w-full border rounded-md bg-white text-stone-900 placeholder-stone-400 text-sm
            transition-colors focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700
            ${error ? "border-danger-600 focus:ring-danger-600" : "border-stone-300"}
            ${prefix ? "pl-9" : "pl-3"} ${suffix ? "pr-9" : "pr-3"} py-2 ${className}`}
          {...props}
        />
        {suffix && <span className="absolute right-3 text-stone-400">{suffix}</span>}
      </div>
      {error && <p className="text-xs text-danger-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
      {hint && !error && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export function Select({ label, error, className = "", id, children, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={selectId} className="text-sm font-medium text-stone-700">{label}</label>}
      <select
        id={selectId}
        className={`w-full border rounded-md bg-white text-stone-900 text-sm py-2 px-3
          transition-colors focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700
          ${error ? "border-danger-600" : "border-stone-300"} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-danger-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────────────────────

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export function Textarea({ label, error, className = "", id, ...props }: TextareaProps) {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={textareaId} className="text-sm font-medium text-stone-700">{label}</label>}
      <textarea
        id={textareaId}
        rows={4}
        className={`w-full border rounded-md bg-white text-stone-900 text-sm px-3 py-2
          transition-colors focus:outline-none focus:ring-2 focus:ring-primary-700 focus:border-primary-700 resize-none
          ${error ? "border-danger-600" : "border-stone-300"} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-danger-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
    </div>
  );
}

// ─── Badge ────────────────────────────────────────────────────────────────────

type BadgeVariant = "success" | "danger" | "warning" | "info" | "neutral" | "primary";

const BADGE_STYLES: Record<BadgeVariant, string> = {
  success: "bg-success-100 text-success-800",
  danger: "bg-danger-100 text-danger-800",
  warning: "bg-warning-100 text-warning-800",
  info: "bg-info-100 text-info-800",
  neutral: "bg-stone-100 text-stone-700",
  primary: "bg-primary-100 text-primary-800",
};

export function Badge({ variant = "neutral", children, className = "" }: { variant?: BadgeVariant; children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${BADGE_STYLES[variant]} ${className}`}>
      {children}
    </span>
  );
}

// ─── Nota Badge (Aprobado / Reprobado) ────────────────────────────────────────

export function NotaBadge({ nota }: { nota: number | null }) {
  if (nota === null) return <span className="text-stone-400 text-xs font-mono-data">—</span>;
  const aprobado = nota >= 61;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full font-mono-data
      ${aprobado ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}
      aria-label={aprobado ? "Aprobado" : "Reprobado"}
    >
      {aprobado ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <AlertCircle className="w-3 h-3" aria-hidden="true" />}
      {nota}
    </span>
  );
}

export function EstadoBadge({ aprobado, label }: { aprobado: boolean; label?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full
      ${aprobado ? "bg-success-100 text-success-800" : "bg-danger-100 text-danger-800"}`}
      aria-label={aprobado ? "Aprobado" : "Reprobado"}
    >
      {aprobado ? <CheckCircle2 className="w-3 h-3" aria-hidden="true" /> : <AlertCircle className="w-3 h-3" aria-hidden="true" />}
      {label ?? (aprobado ? "Aprobado" : "Reprobado")}
    </span>
  );
}

// ─── Pago Badge ───────────────────────────────────────────────────────────────

export function PagoBadge({ estado }: { estado: "pagado" | "pendiente" | "vencido" }) {
  const cfg = {
    pagado: { cls: "bg-success-100 text-success-800", icon: <CheckCircle2 className="w-3 h-3" />, label: "Pagado" },
    pendiente: { cls: "bg-warning-100 text-warning-800", icon: <AlertTriangle className="w-3 h-3" />, label: "Pendiente" },
    vencido: { cls: "bg-danger-100 text-danger-800", icon: <AlertCircle className="w-3 h-3" />, label: "Vencido" },
  }[estado];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white border border-stone-200 rounded-xl shadow-xs ${className}`}>{children}</div>;
}

// ─── Metric Card ──────────────────────────────────────────────────────────────

export function MetricCard({ label, value, sub, icon, variant = "default" }: {
  label: string; value: string | number; sub?: string; icon?: ReactNode; variant?: "default" | "success" | "warning" | "danger";
}) {
  const colors = {
    default: "text-primary-700",
    success: "text-success-700",
    warning: "text-warning-700",
    danger: "text-danger-700",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-stone-500 uppercase tracking-wider">{label}</p>
          <p className={`text-3xl font-display font-semibold mt-1 ${colors[variant]}`}>{value}</p>
          {sub && <p className="text-xs text-stone-500 mt-1">{sub}</p>}
        </div>
        {icon && <span className={`p-2 rounded-lg bg-stone-50 ${colors[variant]}`}>{icon}</span>}
      </div>
    </Card>
  );
}

// ─── Alert Banner ─────────────────────────────────────────────────────────────

type AlertType = "info" | "success" | "warning" | "error";

const ALERT_CFG: Record<AlertType, { cls: string; Icon: typeof Info }> = {
  info: { cls: "bg-info-50 border-info-200 text-info-800", Icon: Info },
  success: { cls: "bg-success-50 border-success-200 text-success-800", Icon: CheckCircle2 },
  warning: { cls: "bg-warning-50 border-warning-200 text-warning-800", Icon: AlertTriangle },
  error: { cls: "bg-danger-50 border-danger-200 text-danger-800", Icon: AlertCircle },
};

export function AlertBanner({ type, title, message, onClose }: { type: AlertType; title?: string; message: string; onClose?: () => void }) {
  const { cls, Icon } = ALERT_CFG[type];
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${cls}`} role="alert">
      <Icon className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-sm">{title}</p>}
        <p className="text-sm">{message}</p>
      </div>
      {onClose && <button onClick={onClose} className="shrink-0 hover:opacity-70 transition-opacity" aria-label="Cerrar"><X className="w-4 h-4" /></button>}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

export function Modal({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog" aria-labelledby="modal-title">
      <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200">
          <h2 id="modal-title" className="font-display font-semibold text-stone-900 text-lg">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-end gap-3">{footer}</div>}
      </div>
    </div>
  );
}

// ─── Drawer ───────────────────────────────────────────────────────────────────

export function Drawer({ open, onClose, title, children, footer }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <>
      <div className={`fixed inset-0 z-40 bg-stone-900/40 backdrop-blur-xs transition-opacity duration-200 ${open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`} onClick={onClose} />
      <div className={`fixed right-0 top-0 h-full z-50 w-full max-w-md bg-white shadow-2xl transition-transform duration-300 flex flex-col ${open ? "translate-x-0" : "translate-x-full"}`} aria-modal="true" role="dialog">
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 shrink-0">
          <h2 className="font-display font-semibold text-stone-900 text-lg">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-600 transition-colors" aria-label="Cerrar"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-200 flex items-center justify-end gap-3 shrink-0">{footer}</div>}
      </div>
    </>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

export function Tabs({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (t: string) => void }) {
  return (
    <div className="flex gap-1 border-b border-stone-200">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors duration-150 cursor-pointer
            ${active === tab ? "border-primary-700 text-primary-700" : "border-transparent text-stone-500 hover:text-stone-700 hover:border-stone-300"}`}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────

export function EmptyState({ icon, title, description, action }: {
  icon?: ReactNode; title: string; description?: string; action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center textile-pattern-light rounded-xl border border-stone-200">
      {icon && <div className="text-stone-300 mb-4">{icon}</div>}
      <p className="font-display font-semibold text-stone-700 text-lg mb-1">{title}</p>
      {description && <p className="text-sm text-stone-500 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ─── Stepper ──────────────────────────────────────────────────────────────────

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-center gap-0">
      {steps.map((step, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={step} className="flex items-center flex-1 min-w-0">
            <div className="flex flex-col items-center shrink-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors
                ${done ? "bg-primary-700 text-white" : active ? "bg-primary-700 text-white ring-4 ring-primary-100" : "bg-stone-200 text-stone-500"}`}>
                {done ? <CheckCircle2 className="w-4 h-4" /> : i + 1}
              </div>
              <span className={`text-xs mt-1 font-medium whitespace-nowrap ${active ? "text-primary-700" : done ? "text-stone-600" : "text-stone-400"}`}>{step}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-colors ${done ? "bg-primary-700" : "bg-stone-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-primary-700 focus-visible:ring-offset-2
          ${checked ? "bg-primary-700" : "bg-stone-300"}`}
      >
        <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </button>
      {label && <span className="text-sm text-stone-700">{label}</span>}
    </label>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-stone-900">{title}</h1>
        {subtitle && <p className="text-sm text-stone-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

// ─── Table utilities ──────────────────────────────────────────────────────────

export function TH({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <th className={`px-4 py-2.5 text-left text-xs font-semibold text-stone-500 uppercase tracking-wider ${className}`}>{children}</th>;
}

export function TD({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 text-sm text-stone-800 ${className}`}>{children}</td>;
}

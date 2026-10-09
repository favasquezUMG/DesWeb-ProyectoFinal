import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { loadStripe, type StripeCardNumberElementOptions, type StripeElementsOptions } from "@stripe/stripe-js";
import { CardCvcElement, CardExpiryElement, CardNumberElement, Elements, useElements, useStripe } from "@stripe/react-stripe-js";
import { AlertCircle, CheckCircle2, Clock, CreditCard, Lock, ShieldCheck } from "lucide-react";
import { Btn, Input, Modal } from "./Ui";
import { crearIntentPago, verificarPago, type IntentPagoDto } from "../lib/api";

const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

// loadStripe se llama una sola vez a nivel de módulo: si se llamara dentro
// del componente, el script de Stripe se volvería a cargar en cada render.
const stripePromise = STRIPE_KEY ? loadStripe(STRIPE_KEY, { locale: "es-419" }) : null;

const MODO_PRUEBA = STRIPE_KEY?.startsWith("pk_test_") ?? false;

export const formatoQ = (monto: number) =>
  `Q${monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Los campos de tarjeta van sueltos (número, vencimiento, CVC) en vez del
 * PaymentElement: así Stripe solo pinta el texto que se escribe y todo lo
 * demás (etiquetas, bordes, la tarjeta de vista previa) es nuestro. Siguen
 * siendo iframes de Stripe: los datos de la tarjeta nunca pasan por nuestro
 * código. Los colores salen de index.css; si cambia la paleta, actualizar aquí.
 */
const ESTILO_CAMPO: StripeCardNumberElementOptions["style"] = {
  base: {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: "15px",
    color: "#1c1917", // stone-900
    letterSpacing: "0.02em",
    "::placeholder": { color: "#a8a29e" }, // stone-400
  },
  invalid: { color: "#b91c1c" }, // danger-700
};

const MARCAS: Record<string, string> = {
  visa: "VISA",
  mastercard: "Mastercard",
  amex: "AMEX",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

const FONTS: StripeElementsOptions["fonts"] = [
  { cssSrc: "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600&display=swap" },
];

type Resultado = { tipo: "exitoso"; monto: number } | { tipo: "procesando" };

interface PagoColegiaturaModalProps {
  /** Periodo a pagar. null = modal cerrado. */
  periodo: { alumnoId: number; anioLectivo: number; mes: number } | null;
  onClose: () => void;
  /**
   * Se llama al cerrar el modal después de enviar el pago, para refrescar
   * el estado de cuenta. "procesando" = el banco todavía no lo confirma.
   */
  onTerminado: (tipo: Resultado["tipo"]) => void;
}

/**
 * Modal de pago de colegiatura. Todo el flujo ocurre dentro de nuestra
 * página: no hay redirect a la pantalla de Stripe Checkout.
 *
 * 1. Al abrir, pide al backend el PaymentIntent (monto ya con beca).
 * 2. Muestra el resumen + el formulario de tarjeta (Stripe Elements).
 * 3. Confirma con Stripe y verifica el resultado contra el backend.
 */
export function PagoColegiaturaModal({ periodo, onClose, onTerminado }: PagoColegiaturaModalProps) {
  const [intent, setIntent] = useState<IntentPagoDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    setIntent(null);
    setError(null);
    setResultado(null);
    if (!periodo) return;

    if (!stripePromise) {
      setError("Los pagos en línea no están configurados (falta VITE_STRIPE_PUBLISHABLE_KEY).");
      return;
    }

    let cancelado = false;
    crearIntentPago(periodo)
      .then((data) => {
        if (cancelado) return;
        // Beca del 100%: el backend lo registra como exonerado y no hay nada que cobrar
        if (data.exonerado || !data.clientSecret) setError("Este mes está cubierto al 100% por beca. No hay nada que pagar.");
        else setIntent(data);
      })
      .catch((e: Error) => { if (!cancelado) setError(e.message); });
    return () => { cancelado = true; };
  }, [periodo]);

  function cerrar() {
    // Mientras Stripe procesa no se deja cerrar: el cobro podría completarse
    // sin que el padre vea el resultado.
    if (enviando) return;
    if (resultado) onTerminado(resultado.tipo);
    onClose();
  }

  const titulo = resultado ? "Resultado del pago" : intent ? intent.concepto : "Pago de colegiatura";

  return (
    <Modal open={periodo !== null} onClose={cerrar} title={titulo}>
      {resultado ? (
        <ResultadoPago resultado={resultado} onCerrar={cerrar} />
      ) : error ? (
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <div className="w-12 h-12 rounded-full bg-danger-100 flex items-center justify-center">
            <AlertCircle className="w-6 h-6 text-danger-700" />
          </div>
          <p className="text-stone-700 text-sm max-w-sm">{error}</p>
          <Btn variant="outline" onClick={cerrar}>Cerrar</Btn>
        </div>
      ) : !intent ? (
        <div className="flex flex-col items-center py-10 gap-3 text-stone-500 text-sm">
          <span className="w-6 h-6 border-2 border-primary-700 border-t-transparent rounded-full animate-spin" />
          Preparando el pago…
        </div>
      ) : (
        <div className="space-y-5">
          <ResumenPago intent={intent} />
          {/* key: Elements no permite cambiar el clientSecret después de montarse */}
          <Elements
            key={intent.clientSecret}
            stripe={stripePromise}
            options={{ fonts: FONTS }}
          >
            <FormularioTarjeta
              intent={intent}
              onEnviando={setEnviando}
              onResultado={setResultado}
            />
          </Elements>
        </div>
      )}
    </Modal>
  );
}

function ResumenPago({ intent }: { intent: IntentPagoDto }) {
  const descuento = intent.montoBase - intent.montoFinal;
  return (
    <div className="rounded-lg bg-sand-50 border border-sand-200 p-4 space-y-2 text-sm">
      <div className="flex justify-between text-stone-600">
        <span>Alumno</span>
        <span className="font-medium text-stone-900 text-right">{intent.alumno}</span>
      </div>
      <div className="flex justify-between text-stone-600">
        <span>Mensualidad</span>
        <span className="font-mono-data">{formatoQ(intent.montoBase)}</span>
      </div>
      {intent.descuentoPorcentaje > 0 && (
        <div className="flex justify-between text-success-700">
          <span>Beca ({intent.descuentoPorcentaje}%)</span>
          <span className="font-mono-data">−{formatoQ(descuento)}</span>
        </div>
      )}
      <div className="flex justify-between items-baseline pt-2 border-t border-sand-200">
        <span className="font-semibold text-stone-900">Total a pagar</span>
        <span className="font-mono-data font-bold text-lg text-primary-700">{formatoQ(intent.montoFinal)}</span>
      </div>
    </div>
  );
}

function FormularioTarjeta({ intent, onEnviando, onResultado }: {
  intent: IntentPagoDto;
  onEnviando: (v: boolean) => void;
  onResultado: (r: Resultado) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [listos, setListos] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("unknown");
  const [enfocado, setEnfocado] = useState<Campo | null>(null);
  const [campos, setCampos] = useState<Record<CampoStripe, { completo: boolean; error?: string }>>({
    numero: { completo: false },
    vencimiento: { completo: false },
    cvc: { completo: false },
  });

  const listo = listos >= 3;
  const completo = campos.numero.completo && campos.vencimiento.completo && campos.cvc.completo && nombre.trim() !== "";

  function marcarEnviando(v: boolean) {
    setEnviando(v);
    onEnviando(v);
  }

  /** Props comunes de los tres campos de Stripe. */
  function eventos(campo: CampoStripe) {
    return {
      onReady: () => setListos((n) => n + 1),
      onFocus: () => setEnfocado(campo),
      onBlur: () => setEnfocado(null),
      onChange: (e: { complete: boolean; error?: { message: string } }) => {
        setError(null);
        setCampos((prev) => ({ ...prev, [campo]: { completo: e.complete, error: e.error?.message } }));
      },
    };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const tarjeta = elements?.getElement(CardNumberElement);
    if (!stripe || !tarjeta || !completo) return;

    setError(null);
    marcarEnviando(true);

    // Con tarjeta nunca sale de la página. Si el banco pide 3D Secure,
    // Stripe lo muestra como ventana encima de la app.
    const { error: errorStripe, paymentIntent } = await stripe.confirmCardPayment(intent.clientSecret, {
      payment_method: { card: tarjeta, billing_details: { name: nombre.trim() } },
    });

    if (errorStripe) {
      // Tarjeta rechazada, fondos insuficientes, CVC incorrecto, etc.
      // Los mensajes ya vienen en español por el locale de loadStripe.
      setError(errorStripe.message ?? "No se pudo procesar el pago. Intente de nuevo.");
      marcarEnviando(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      // Se avisa al backend para que el estado de cuenta se actualice ya,
      // sin depender de que el webhook llegue primero. Si falla, el pago
      // igual está hecho y el webhook lo registrará.
      await verificarPago(paymentIntent.id).catch(() => null);
      onResultado({ tipo: "exitoso", monto: intent.montoFinal });
    } else {
      onResultado({ tipo: "procesando" });
    }
    marcarEnviando(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TarjetaVistaPrevia marca={marca} nombre={nombre} enfocado={enfocado} />

      <Input
        label="Nombre en la tarjeta"
        placeholder="Como aparece impreso"
        autoComplete="cc-name"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        onFocus={() => setEnfocado("nombre")}
        onBlur={() => setEnfocado(null)}
        disabled={enviando}
      />

      <CampoTarjeta label="Número de tarjeta" enfocado={enfocado === "numero"} error={campos.numero.error}
        extra={marca !== "unknown" && MARCAS[marca] ? <span className="text-[11px] font-semibold tracking-wide text-primary-700">{MARCAS[marca]}</span> : <CreditCard className="w-4 h-4 text-stone-400" />}
      >
        <CardNumberElement
          options={{ style: ESTILO_CAMPO, placeholder: "0000 0000 0000 0000", showIcon: false, disabled: enviando }}
          {...eventos("numero")}
          onChange={(e) => { eventos("numero").onChange(e); setMarca(e.brand); }}
        />
      </CampoTarjeta>

      <div className="grid grid-cols-2 gap-3">
        <CampoTarjeta label="Vencimiento" enfocado={enfocado === "vencimiento"} error={campos.vencimiento.error}>
          <CardExpiryElement options={{ style: ESTILO_CAMPO, placeholder: "MM / AA", disabled: enviando }} {...eventos("vencimiento")} />
        </CampoTarjeta>
        <CampoTarjeta label="Código de seguridad" enfocado={enfocado === "cvc"} error={campos.cvc.error}
          extra={<Lock className="w-3.5 h-3.5 text-stone-400" />}
        >
          <CardCvcElement options={{ style: ESTILO_CAMPO, placeholder: "CVC", disabled: enviando }} {...eventos("cvc")} />
        </CampoTarjeta>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-danger-50 border border-danger-100 text-danger-800 text-sm" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {MODO_PRUEBA && (
        <p className="text-xs text-stone-500 bg-stone-50 border border-dashed border-stone-300 rounded-md px-3 py-2">
          Modo prueba: use la tarjeta <span className="font-mono-data">4242 4242 4242 4242</span>, cualquier fecha futura y cualquier CVC.
          Para simular un rechazo: <span className="font-mono-data">4000 0000 0000 0002</span>.
        </p>
      )}

      <Btn
        type="submit"
        variant="primary"
        className="w-full justify-center"
        loading={enviando}
        disabled={!stripe || !listo || !completo}
        icon={<Lock className="w-4 h-4" />}
      >
        {enviando ? "Procesando pago…" : `Pagar ${formatoQ(intent.montoFinal)}`}
      </Btn>

      <div className="flex items-center justify-center gap-1.5 text-xs text-stone-500">
        <ShieldCheck className="w-3.5 h-3.5 text-success-700" />
        Conexión cifrada. El colegio no almacena los datos de su tarjeta.
      </div>
    </form>
  );
}

type CampoStripe = "numero" | "vencimiento" | "cvc";
type Campo = CampoStripe | "nombre";

/**
 * Contenedor con el mismo aspecto que el <Input> de Ui.tsx. El borde y el
 * anillo de foco se dibujan aquí porque el campo real es un iframe de Stripe
 * y no recibe nuestras clases.
 */
function CampoTarjeta({ label, enfocado, error, extra, children }: {
  label: string;
  enfocado: boolean;
  error?: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-stone-700">{label}</span>
      <div
        className={`relative flex items-center rounded-md border bg-white px-3 py-2.5 transition-shadow
          ${error ? "border-danger-600" : enfocado ? "border-primary-700" : "border-stone-300"}
          ${enfocado ? (error ? "ring-2 ring-danger-600/30" : "ring-2 ring-primary-700/25") : ""}`}
      >
        <div className="flex-1 min-w-0">{children}</div>
        {extra && <span className="ml-2 shrink-0 flex items-center">{extra}</span>}
      </div>
      {error && <p className="text-xs text-danger-700 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</p>}
    </div>
  );
}

/**
 * Tarjeta decorativa que reacciona a lo que el padre va llenando. Stripe no
 * expone los dígitos (por seguridad), solo la marca y el foco, así que el
 * número se muestra siempre enmascarado.
 */
function TarjetaVistaPrevia({ marca, nombre, enfocado }: { marca: string; nombre: string; enfocado: Campo | null }) {
  const resaltar = (campo: Campo) =>
    enfocado === campo ? "text-white" : "text-white/60";

  return (
    <div
      className="relative overflow-hidden rounded-xl p-5 text-white shadow-lg aspect-[1.75] max-h-44 w-full
        bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900"
      aria-hidden="true"
    >
      <div className="absolute -right-10 -top-12 w-40 h-40 rounded-full bg-white/5" />
      <div className="absolute -right-4 -bottom-16 w-48 h-48 rounded-full bg-white/5" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between">
          <div className="w-9 h-7 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 opacity-90" />
          <span className="text-sm font-semibold tracking-wider">
            {MARCAS[marca] ?? <CreditCard className="w-5 h-5 text-white/70" />}
          </span>
        </div>

        <p className={`font-mono-data text-lg tracking-[0.18em] transition-colors ${resaltar("numero")}`}>
          •••• •••• •••• ••••
        </p>

        <div className="flex items-end justify-between gap-4 text-xs">
          <div className="min-w-0">
            <p className="text-white/50 uppercase tracking-wide text-[10px]">Titular</p>
            <p className={`truncate uppercase font-medium transition-colors ${resaltar("nombre")}`}>
              {nombre.trim() || "Nombre completo"}
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-white/50 uppercase tracking-wide text-[10px]">
              {enfocado === "cvc" ? "CVC" : "Vence"}
            </p>
            <p className={`font-mono-data transition-colors ${resaltar(enfocado === "cvc" ? "cvc" : "vencimiento")}`}>
              {enfocado === "cvc" ? "•••" : "MM/AA"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultadoPago({ resultado, onCerrar }: { resultado: Resultado; onCerrar: () => void }) {
  if (resultado.tipo === "procesando") {
    return (
      <div className="flex flex-col items-center text-center py-6 gap-3">
        <div className="w-14 h-14 rounded-full bg-warning-100 flex items-center justify-center">
          <Clock className="w-7 h-7 text-warning-700" />
        </div>
        <h3 className="font-display font-semibold text-stone-900 text-lg">Pago en proceso</h3>
        <p className="text-stone-600 text-sm max-w-sm">
          Su banco todavía está procesando el pago. El estado de cuenta se actualizará automáticamente cuando se confirme.
        </p>
        <Btn variant="outline" onClick={onCerrar}>Entendido</Btn>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center text-center py-6 gap-3">
      <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center">
        <CheckCircle2 className="w-7 h-7 text-success-700" />
      </div>
      <h3 className="font-display font-semibold text-stone-900 text-lg">¡Pago realizado!</h3>
      <p className="text-stone-600 text-sm max-w-sm">
        Se cobraron <span className="font-mono-data font-semibold text-stone-900">{formatoQ(resultado.monto)}</span> correctamente.
        El pago ya aparece en su estado de cuenta.
      </p>
      <Btn variant="primary" onClick={onCerrar}>Listo</Btn>
    </div>
  );
}

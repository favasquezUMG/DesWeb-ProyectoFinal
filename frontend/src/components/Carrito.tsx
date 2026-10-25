import { useState, useSyncExternalStore } from "react";
import { CalendarDays, CreditCard, GraduationCap, ShoppingCart, Trash2 } from "./Iconos";
import { Btn, Drawer, EmptyState } from "./Ui";
import { PagoStripeModal, formatoQ } from "./PagoColegiatura";
import { crearIntentCarrito, verificarCarrito, type IntentCarritoDto, type ItemCarritoInput } from "../lib/api";
import { getSession } from "../lib/auth";

/**
 * Carrito de pagos del encargado: eventos con cobro y colegiaturas en un solo cobro.
 * Vive en el navegador (localStorage, por usuario) para no perderse al cambiar de sección.
 * El monto que se guarda aquí es solo para mostrar: al pagar, el servidor valida cada
 * concepto y calcula el total real (cupos, fechas límite, becas).
 */
export type ItemCarrito = ItemCarritoInput & {
  clave: string;
  alumno: string;
  descripcion: string;
  monto: number;
};

export const claveEvento = (alumnoId: number, eventoId: number) => `e-${alumnoId}-${eventoId}`;
export const claveColegiatura = (alumnoId: number, anioLectivo: number, mes: number) => `c-${alumnoId}-${anioLectivo}-${mes}`;

const storageKey = () => `carrito-pagos:${getSession()?.user.id ?? "anon"}`;

let cache: { key: string; items: ItemCarrito[] } | null = null;
const listeners = new Set<() => void>();

function leer(): ItemCarrito[] {
  const key = storageKey();
  if (cache?.key === key) return cache.items;
  let items: ItemCarrito[] = [];
  try {
    const raw = localStorage.getItem(key);
    if (raw) items = JSON.parse(raw) as ItemCarrito[];
  } catch {
    items = [];
  }
  cache = { key, items };
  return items;
}

function guardar(items: ItemCarrito[]) {
  const key = storageKey();
  cache = { key, items };
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    // Sin almacenamiento (modo privado): el carrito dura mientras la página esté abierta
  }
  listeners.forEach((l) => l());
}

function suscribir(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useCarrito() {
  const items = useSyncExternalStore(suscribir, leer);
  return {
    items,
    total: items.reduce((suma, i) => suma + i.monto, 0),
    contiene: (clave: string) => items.some((i) => i.clave === clave),
    agregar: (item: ItemCarrito) => {
      if (!leer().some((i) => i.clave === item.clave)) guardar([...leer(), item]);
    },
    quitar: (clave: string) => guardar(leer().filter((i) => i.clave !== clave)),
    vaciar: () => guardar([]),
  };
}

/** Botón del encabezado con el número de conceptos; abre el panel del carrito. */
export function CarritoBoton({ onPagado }: { onPagado?: () => void }) {
  const { items } = useCarrito();
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Btn variant="outline" icon={<ShoppingCart className="w-4 h-4" />} onClick={() => setAbierto(true)}>
        Carrito
        {items.length > 0 && (
          <span className="ml-1 inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-primary-700 text-white text-xs font-semibold">
            {items.length}
          </span>
        )}
      </Btn>
      <CarritoDrawer abierto={abierto} onClose={() => setAbierto(false)} onPagado={onPagado} />
    </>
  );
}

function CarritoDrawer({ abierto, onClose, onPagado }: { abierto: boolean; onClose: () => void; onPagado?: () => void }) {
  const { items, total, quitar, vaciar } = useCarrito();
  // Clave del cobro en curso (null = modal cerrado). Cambia en cada intento para preparar uno nuevo.
  const [cobro, setCobro] = useState<string | null>(null);

  // Agrupado por alumno: así el padre ve qué está pagando por cada hijo
  const porAlumno = new Map<number, { alumno: string; items: ItemCarrito[] }>();
  for (const item of items) {
    const grupo = porAlumno.get(item.alumnoId) ?? { alumno: item.alumno, items: [] };
    grupo.items.push(item);
    porAlumno.set(item.alumnoId, grupo);
  }

  function pagar() {
    onClose();
    setCobro(`carrito-${Date.now()}`);
  }

  return (
    <>
      <Drawer
        open={abierto}
        onClose={onClose}
        title="Carrito de pagos"
        footer={items.length > 0 ? (
          <div className="w-full space-y-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-stone-600">Total estimado</span>
              <span className="font-display font-bold tabular-nums text-xl text-primary-700">{formatoQ(total)}</span>
            </div>
            <div className="flex gap-2">
              <Btn variant="ghost" size="sm" onClick={vaciar}>Vaciar</Btn>
              <Btn variant="primary" className="flex-1 justify-center" icon={<CreditCard className="w-4 h-4" />} onClick={pagar}>
                Pagar {formatoQ(total)}
              </Btn>
            </div>
          </div>
        ) : undefined}
      >
        {items.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart className="w-10 h-10" />}
            title="El carrito está vacío"
            description="Agregue eventos desde la sección Eventos o mensualidades desde Pagos para pagarlos juntos."
          />
        ) : (
          <div className="space-y-5">
            {[...porAlumno.entries()].map(([alumnoId, grupo]) => (
              <div key={alumnoId}>
                <p className="text-[13px] font-semibold text-stone-500 mb-2">{grupo.alumno}</p>
                <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200">
                  {grupo.items.map((item) => (
                    <li key={item.clave} className="flex items-center gap-3 px-3 py-2.5">
                      <span className={`p-1.5 rounded-lg ${item.tipo === "evento" ? "bg-info-50 text-info-700" : "bg-primary-50 text-primary-700"}`}>
                        {item.tipo === "evento" ? <CalendarDays className="w-4 h-4" /> : <GraduationCap className="w-4 h-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-900 truncate">{item.descripcion}</p>
                        <p className="text-xs text-stone-500">{item.tipo === "evento" ? "Evento" : "Mensualidad"}</p>
                      </div>
                      <span className="font-mono-data text-sm text-stone-900">{formatoQ(item.monto)}</span>
                      <button
                        onClick={() => quitar(item.clave)}
                        className="text-stone-400 hover:text-danger-700 transition-colors cursor-pointer"
                        aria-label={`Quitar ${item.descripcion}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <p className="text-xs text-stone-500">
              Las becas se aplican solo a las mensualidades. Los eventos se cobran a precio completo.
            </p>
          </div>
        )}
      </Drawer>

      <PagoStripeModal
        clave={cobro}
        tituloInicial="Pago del carrito"
        preparar={async () => {
          const intent = await crearIntentCarrito(items.map(({ tipo, alumnoId, ...resto }) =>
            tipo === "evento"
              ? { tipo, alumnoId, eventoId: (resto as { eventoId: number }).eventoId }
              : { tipo, alumnoId, anioLectivo: (resto as { anioLectivo: number }).anioLectivo, mes: (resto as { mes: number }).mes },
          ));
          return {
            clientSecret: intent.clientSecret,
            monto: intent.total,
            titulo: `Pago de ${intent.lineas.length} concepto${intent.lineas.length === 1 ? "" : "s"}`,
            resumen: <ResumenCarrito intent={intent} />,
          };
        }}
        verificar={verificarCarrito}
        onClose={() => setCobro(null)}
        onTerminado={(tipo) => {
          // Pagado o en proceso: ya no debe volver a cobrarse desde el carrito
          if (tipo === "exitoso" || tipo === "procesando") vaciar();
          onPagado?.();
        }}
      />
    </>
  );
}

function ResumenCarrito({ intent }: { intent: IntentCarritoDto }) {
  return (
    <div className="rounded-lg bg-sand-50 border border-sand-200 p-4 space-y-2 text-sm">
      {intent.lineas.map((linea, i) => (
        <div key={i} className="flex justify-between gap-3 text-stone-600">
          <span className="min-w-0">
            <span className="text-stone-900">{linea.descripcion}</span>
            <span className="block text-xs text-stone-500">{linea.alumno}</span>
          </span>
          <span className="font-mono-data shrink-0">{formatoQ(linea.monto)}</span>
        </div>
      ))}
      <div className="flex justify-between items-baseline pt-2 border-t border-sand-200">
        <span className="font-semibold text-stone-900">Total a pagar</span>
        <span className="font-display font-bold tabular-nums text-lg text-primary-700">{formatoQ(intent.total)}</span>
      </div>
    </div>
  );
}

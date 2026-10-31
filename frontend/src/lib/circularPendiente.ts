// Circular que el encargado abrió desde el enlace del correo; sobrevive al inicio de sesión.
// Va aparte de CircularesPadre para que App no cargue esa pantalla (y Stripe) antes de tiempo.
const CLAVE_CIRCULAR_PENDIENTE = "circularPendiente";

export function guardarCircularPendiente(eventoId: number) {
  try { sessionStorage.setItem(CLAVE_CIRCULAR_PENDIENTE, String(eventoId)); } catch { /* sin storage: solo no se abre sola */ }
}

export function leerCircularPendiente(): number | null {
  try { return Number(sessionStorage.getItem(CLAVE_CIRCULAR_PENDIENTE)) || null; } catch { return null; }
}

export const hayCircularPendiente = () => leerCircularPendiente() !== null;

export function limpiarCircularPendiente() {
  try { sessionStorage.removeItem(CLAVE_CIRCULAR_PENDIENTE); } catch { /* nada que limpiar */ }
}

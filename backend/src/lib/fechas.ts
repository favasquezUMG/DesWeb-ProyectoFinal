// Las columnas @db.Date se guardan a medianoche UTC; "hoy" se compara igual
export const hoyUTC = () => {
    const ahora = new Date();
    return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
};

const FORMATO_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// "YYYY-MM-DD" -> Date a medianoche UTC (como se guardan las columnas @db.Date).
// Devuelve null si el formato es otro o la fecha no existe (ej. 2026-02-31).
export const parseFecha = (fecha: unknown): Date | null => {
    if (typeof fecha !== 'string' || !FORMATO_FECHA.test(fecha.trim())) return null;

    const [anio, mes, dia] = fecha.trim().split('-').map(Number);
    const resultado = new Date(Date.UTC(anio, mes - 1, dia));
    if (resultado.getUTCMonth() !== mes - 1 || resultado.getUTCDate() !== dia) return null;

    return resultado;
};

export const formatFecha = (fecha: Date): string => fecha.toISOString().slice(0, 10);

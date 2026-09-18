const FORMATO_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const parseHora = (hora: unknown): Date | null => {
    if (typeof hora !== 'string') return null;

    const match = FORMATO_HORA.exec(hora.trim());
    if (!match) return null;

    const [, horas, minutos] = match;
    return new Date(Date.UTC(1970, 0, 1, Number(horas), Number(minutos), 0, 0));
};

export const formatHora = (fecha: Date): string => {
    const horas = String(fecha.getUTCHours()).padStart(2, '0');
    const minutos = String(fecha.getUTCMinutes()).padStart(2, '0');
    return `${horas}:${minutos}`;
};

export const DIAS_SEMANA: Record<number, string> = {
    1: 'Lunes',
    2: 'Martes',
    3: 'Miércoles',
    4: 'Jueves',
    5: 'Viernes',
    6: 'Sábado',
    7: 'Domingo',
};

export const esDiaValido = (dia: unknown): boolean => {
    const n = Number(dia);
    return Number.isInteger(n) && n >= 1 && n <= 7;
};
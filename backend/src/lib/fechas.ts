// Las columnas @db.Date se guardan a medianoche UTC; "hoy" se compara igual
export const hoyUTC = () => {
    const ahora = new Date();
    return new Date(Date.UTC(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()));
};

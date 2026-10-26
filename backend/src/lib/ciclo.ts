// Secciones que todavia cuentan: no eliminadas y del ciclo actual o uno futuro. Las de ciclos
// pasados quedan como historial (notas, asistencia) y no deben bloquear cambios en la malla.
export const seccionVigente = () => ({ deletedAt: null, anioLectivo: { gte: new Date().getFullYear() } });

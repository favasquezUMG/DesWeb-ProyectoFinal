/**
 * Datos del recorrido virtual del colegio.
 * Coordenadas en metros sobre un plano local: x hacia el este, y hacia el norte.
 * Cada punto puede traer `foto` (ruta a una foto 360° equirectangular 2:1, ej. "/recorrido/aula.jpg"
 * dentro de frontend/public, con el norte al centro de la imagen); si no la trae, se genera una de
 * ejemplo con generarPanorama().
 */

export interface Rect { x0: number; y0: number; x1: number; y1: number }
export interface Punto2D { x: number; y: number }

/** Cara de un edificio o pared de una sala, por el punto cardinal hacia el que da */
export type Lado = "N" | "E" | "S" | "O";

export interface Edificio extends Rect {
  id: string;
  nombre: string;
  alto: number;
  color: [number, number, number];
  letrero?: { texto: string; cara: Lado };
}

export type Decoracion = "recepcion" | "pasillo" | "aula" | "laboratorio" | "biblioteca" | "cafeteria";
export type Piso = "baldosa" | "madera" | "vinil";

export type Ambiente =
  | { tipo: "interior"; sala: Rect; alto: number; piso: Piso; decoracion: Decoracion }
  | { tipo: "exterior" };

export interface PuntoRecorrido extends Punto2D {
  id: string;
  nombre: string;
  descripcion: string;
  enlaces: string[];
  /** Dónde está la puerta hacia cada enlace, si no queda en línea recta hacia el otro punto */
  puertas?: Record<string, Punto2D>;
  ambiente: Ambiente;
  foto?: string;
}

export const EDIFICIOS: Edificio[] = [
  { id: "principal", nombre: "Edificio principal", x0: -18, y0: 10, x1: 18, y1: 30, alto: 7.5, color: [238, 228, 208], letrero: { texto: "COLEGIO VANGUARDIA", cara: "S" } },
  { id: "biblioteca", nombre: "Biblioteca", x0: -32, y0: 34, x1: -16, y1: 48, alto: 6, color: [222, 200, 168], letrero: { texto: "BIBLIOTECA", cara: "E" } },
  { id: "cafeteria", nombre: "Cafetería", x0: 16, y0: 34, x1: 32, y1: 48, alto: 5, color: [232, 210, 176], letrero: { texto: "CAFETERÍA", cara: "O" } },
];

export const CANCHA: Rect = { x0: -10, y0: 54, x1: 10, y1: 74 };

export const JARDINES = [
  { x: -8, y: 41, r: 3 },
  { x: 8, y: 41, r: 3 },
];

export const ARBOLES = [
  { x: -8, y: 41, r: 2.2, alto: 5 },
  { x: 8, y: 41, r: 2.4, alto: 5.4 },
  { x: -11, y: 4, r: 2, alto: 4.6 },
  { x: 11, y: 4, r: 2, alto: 4.6 },
  { x: -16, y: 64, r: 2.6, alto: 5.5 },
  { x: 16, y: 60, r: 2.6, alto: 5.5 },
  { x: -24, y: 54, r: 2.2, alto: 5 },
  { x: 24, y: 54, r: 2.2, alto: 5 },
];

export const PUNTOS: PuntoRecorrido[] = [
  {
    id: "entrada", nombre: "Entrada principal", x: 0, y: 3,
    descripcion: "Bienvenidos. Desde aquí se entra a recepción y a todo el campus.",
    enlaces: ["recepcion"], ambiente: { tipo: "exterior" },
  },
  {
    id: "recepcion", nombre: "Recepción", x: 0, y: 13,
    descripcion: "Atención a padres de familia, información e inscripciones.",
    enlaces: ["entrada", "pasillo"],
    ambiente: { tipo: "interior", sala: { x0: -5, y0: 10, x1: 5, y1: 18 }, alto: 3.4, piso: "baldosa", decoracion: "recepcion" },
  },
  {
    id: "pasillo", nombre: "Pasillo de aulas", x: 0, y: 20,
    descripcion: "Conecta las aulas, el laboratorio y la salida al patio central.",
    enlaces: ["recepcion", "aula", "laboratorio", "patio"],
    puertas: { aula: { x: -10, y: 22 }, laboratorio: { x: 10, y: 22 } },
    ambiente: { tipo: "interior", sala: { x0: -18, y0: 18, x1: 18, y1: 22 }, alto: 3, piso: "baldosa", decoracion: "pasillo" },
  },
  {
    id: "aula", nombre: "Aula de primaria", x: -11, y: 26,
    descripcion: "Aulas iluminadas, con grupos reducidos y material para cada alumno.",
    enlaces: ["pasillo"],
    puertas: { pasillo: { x: -10, y: 22 } },
    ambiente: { tipo: "interior", sala: { x0: -17, y0: 22, x1: -5, y1: 30 }, alto: 3, piso: "madera", decoracion: "aula" },
  },
  {
    id: "laboratorio", nombre: "Laboratorio de ciencias", x: 11, y: 26,
    descripcion: "Prácticas de química, física y biología con equipo para cada grupo.",
    enlaces: ["pasillo"],
    puertas: { pasillo: { x: 10, y: 22 } },
    ambiente: { tipo: "interior", sala: { x0: 5, y0: 22, x1: 17, y1: 30 }, alto: 3, piso: "vinil", decoracion: "laboratorio" },
  },
  {
    id: "patio", nombre: "Patio central", x: 0, y: 41,
    descripcion: "Punto de encuentro durante el recreo y los actos del colegio.",
    enlaces: ["pasillo", "biblioteca", "cafeteria", "cancha"],
    puertas: { pasillo: { x: 0, y: 30 }, biblioteca: { x: -16, y: 41 }, cafeteria: { x: 16, y: 41 } },
    ambiente: { tipo: "exterior" },
  },
  {
    id: "biblioteca", nombre: "Biblioteca", x: -23, y: 41,
    descripcion: "Área de lectura, colección de libros por nivel y espacio para investigar.",
    enlaces: ["patio"],
    ambiente: { tipo: "interior", sala: { x0: -32, y0: 34, x1: -16, y1: 48 }, alto: 4, piso: "madera", decoracion: "biblioteca" },
  },
  {
    id: "cafeteria", nombre: "Cafetería", x: 23, y: 41,
    descripcion: "Menú balanceado preparado a diario.",
    enlaces: ["patio"],
    ambiente: { tipo: "interior", sala: { x0: 16, y0: 34, x1: 32, y1: 48 }, alto: 3.6, piso: "baldosa", decoracion: "cafeteria" },
  },
  {
    id: "cancha", nombre: "Cancha deportiva", x: 3, y: 59.5,
    descripcion: "Cancha polideportiva para básquetbol, fútbol sala y educación física.",
    enlaces: ["patio"], ambiente: { tipo: "exterior" },
  },
];

export const PUNTO_INICIAL = "entrada";

export function buscarPunto(id: string): PuntoRecorrido {
  const p = PUNTOS.find(p => p.id === id);
  if (!p) throw new Error(`Punto de recorrido desconocido: ${id}`);
  return p;
}

/** Rumbo de un punto a otro en radianes: 0 = norte, positivo hacia el este (igual que el yaw del visor) */
export function rumbo(desde: Punto2D, hacia: Punto2D): number {
  return Math.atan2(hacia.x - desde.x, hacia.y - desde.y);
}

/** Hacia dónde queda la flecha de un enlace: a su puerta, o directo al otro punto */
export function rumboEnlace(punto: PuntoRecorrido, destino: string): number {
  return rumbo(punto, punto.puertas?.[destino] ?? buscarPunto(destino));
}

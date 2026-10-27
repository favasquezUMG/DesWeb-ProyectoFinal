/**
 * Genera fotos 360° de ejemplo (equirectangulares, 2:1, norte al centro) para el recorrido virtual,
 * trazando un rayo por píxel contra salas, edificios, muebles y árboles sencillos.
 * Sirve mientras no hay fotos reales: basta con poner `foto` en el punto de recorrido.
 */
import {
  ARBOLES, CANCHA, EDIFICIOS, JARDINES, buscarPunto, rumboEnlace,
  type Decoracion, type Edificio, type Lado, type Piso, type PuntoRecorrido, type Rect,
} from "./recorrido";

const ANCHO = 3072;
const ALTO = ANCHO / 2;
const OJO = 1.6;
const PX = 100; // píxeles por metro en las texturas de pared
const MS_POR_PASO = 60; // cada cuánto se cede el hilo para no congelar la página

type RGB = [number, number, number];

// Color de salida de las funciones de muestreo (evita crear arreglos por píxel)
let R = 0, G = 0, B = 0, A = 0;
function rgb(c: RGB, f = 1) { R = c[0] * f; G = c[1] * f; B = c[2] * f; }
function mezclar(c: RGB, t: number) { R += (c[0] - R) * t; G += (c[1] - G) * t; B += (c[2] - B) * t; }

function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul((y | 0) + 1013, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function ruido(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = x - xi, fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

const suave = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ───────────────────────── Texturas pintadas con canvas ─────────────────────────

interface Textura { w: number; h: number; d: Uint8ClampedArray }

function muestrear(t: Textura, u: number, v: number) {
  const x = Math.min(t.w - 1, Math.max(0, u | 0)), y = Math.min(t.h - 1, Math.max(0, v | 0));
  const i = (y * t.w + x) * 4;
  R = t.d[i]; G = t.d[i + 1]; B = t.d[i + 2]; A = t.d[i + 3];
}

const FUENTE_TITULO = '"Bricolage Grotesque", "Figtree", system-ui, sans-serif';
const FUENTE_TEXTO = '"Figtree", system-ui, sans-serif';

/** Lienzo en metros: u de izquierda a derecha, z de abajo hacia arriba */
class Lienzo {
  readonly ctx: CanvasRenderingContext2D;
  private readonly canvas: HTMLCanvasElement;
  constructor(readonly largo: number, readonly alto: number) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = Math.ceil(largo * PX);
    this.canvas.height = Math.ceil(alto * PX);
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })!;
  }
  rect(u: number, z: number, w: number, h: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(u * PX, (this.alto - z - h) * PX, w * PX, h * PX);
  }
  circulo(u: number, z: number, r: number, color: string) {
    this.ctx.fillStyle = color;
    this.ctx.beginPath();
    this.ctx.arc(u * PX, (this.alto - z) * PX, r * PX, 0, Math.PI * 2);
    this.ctx.fill();
  }
  texto(t: string, u: number, z: number, tam: number, color: string, opciones: { titulo?: boolean; peso?: number; alinear?: CanvasTextAlign } = {}) {
    const ctx = this.ctx;
    ctx.font = `${opciones.peso ?? 700} ${tam * PX}px ${opciones.titulo ? FUENTE_TITULO : FUENTE_TEXTO}`;
    ctx.fillStyle = color;
    ctx.textAlign = opciones.alinear ?? "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(t, u * PX, (this.alto - z) * PX);
  }
  ancho(t: string, tam: number, titulo = false): number {
    this.ctx.font = `700 ${tam * PX}px ${titulo ? FUENTE_TITULO : FUENTE_TEXTO}`;
    return this.ctx.measureText(t).width / PX;
  }
  ventana(u: number, z: number, w: number, h: number, divisiones = 2) {
    this.rect(u - 0.06, z - 0.06, w + 0.12, h + 0.12, "#f7f5f0");
    const g = this.ctx.createLinearGradient(0, (this.alto - z - h) * PX, 0, (this.alto - z) * PX);
    g.addColorStop(0, "#9cc4e4"); g.addColorStop(0.7, "#d4e8f3"); g.addColorStop(0.72, "#a9c79a"); g.addColorStop(1, "#7fa874");
    this.ctx.fillStyle = g;
    this.ctx.fillRect(u * PX, (this.alto - z - h) * PX, w * PX, h * PX);
    for (let i = 1; i < divisiones; i++) this.rect(u + (w * i) / divisiones - 0.025, z, 0.05, h, "#f7f5f0");
    this.rect(u, z + h * 0.62, w, 0.04, "#f7f5f0");
  }
  textura(): Textura {
    const { width: w, height: h } = this.canvas;
    return { w, h, d: this.ctx.getImageData(0, 0, w, h).data };
  }
}

// ───────────────────────── Salas (interiores) ─────────────────────────

interface Puerta { u: number; ancho: number; nombre: string; exterior: boolean; enlace: boolean }

interface Caja { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; color: RGB; arriba?: RGB; libros?: boolean }
interface Mueble { caja: Caja; partes: Caja[] }

function largoPared(sala: Rect, lado: Lado) {
  return lado === "N" || lado === "S" ? sala.x1 - sala.x0 : sala.y1 - sala.y0;
}

/** Coordenada a lo largo de la pared vista desde adentro (de izquierda a derecha) */
function uPared(sala: Rect, lado: Lado, x: number, y: number) {
  switch (lado) {
    case "N": return x - sala.x0;
    case "E": return sala.y1 - y;
    case "S": return sala.x1 - x;
    case "O": return y - sala.y0;
  }
}

/** Pared que se ve al mirar con cierto rumbo desde (x, y) */
function paredEnRumbo(sala: Rect, x: number, y: number, yaw: number): { lado: Lado; u: number } {
  const dx = Math.sin(yaw), dy = Math.cos(yaw);
  const tx = dx > 1e-9 ? (sala.x1 - x) / dx : dx < -1e-9 ? (sala.x0 - x) / dx : Infinity;
  const ty = dy > 1e-9 ? (sala.y1 - y) / dy : dy < -1e-9 ? (sala.y0 - y) / dy : Infinity;
  const lado: Lado = tx < ty ? (dx > 0 ? "E" : "O") : dy > 0 ? "N" : "S";
  const t = Math.min(tx, ty);
  return { lado, u: uPared(sala, lado, x + dx * t, y + dy * t) };
}

/** Puertas decorativas (sin enlace) para que el pasillo parezca un pasillo de verdad */
const PUERTAS_EXTRA: Partial<Record<Decoracion, Array<{ lado: Lado; x: number; y: number; nombre: string }>>> = {
  pasillo: [
    { lado: "N", x: -15, y: 22, nombre: "Aula 2" },
    { lado: "N", x: 15, y: 22, nombre: "Aula 5" },
    { lado: "S", x: -8, y: 18, nombre: "Dirección" },
    { lado: "S", x: 8, y: 18, nombre: "Enfermería" },
    { lado: "S", x: -14, y: 18, nombre: "Sala de maestros" },
    { lado: "S", x: 14, y: 18, nombre: "Orientación" },
  ],
};

const COLORES_MATERIA = ["#2b3a8c", "#b3202a", "#0f7b5f", "#f2b705", "#6b2d7b", "#d63a7a"];
const COLORES_LIBRO = ["#8e1820", "#2b3a8c", "#0f7b5f", "#c9a227", "#6b2d7b", "#3d6b8f", "#a4552c", "#1f2a6b", "#5e7d3a", "#d9cfb8"];

function pintarPuerta(L: Lienzo, p: Puerta, altoSala: number) {
  const alto = 2.3, u0 = p.u - p.ancho / 2;
  L.rect(u0 - 0.08, 0, p.ancho + 0.16, alto + 0.08, "#4a423c");
  if (p.exterior) {
    const ctx = L.ctx;
    const g = ctx.createLinearGradient(0, (L.alto - alto) * PX, 0, L.alto * PX);
    g.addColorStop(0, "#b9d8ec"); g.addColorStop(0.55, "#e6f0f2"); g.addColorStop(0.6, "#c9c0ae"); g.addColorStop(1, "#a89e8a");
    ctx.fillStyle = g;
    ctx.fillRect(u0 * PX, (L.alto - alto) * PX, p.ancho * PX, alto * PX);
    L.rect(p.u - 0.03, 0, 0.06, alto, "#4a423c");
    L.rect(u0, 1.0, p.ancho, 0.05, "#4a423c");
  } else {
    L.rect(u0, 0, p.ancho, alto, "#a8774b");
    L.rect(u0 + 0.12, 0.25, p.ancho - 0.24, 0.9, "#9a6c43");
    L.rect(u0 + 0.12, 1.3, p.ancho - 0.24, 0.55, "#cfe1ea");
    L.rect(u0 + p.ancho - 0.18, 1.0, 0.1, 0.04, "#d8d2c4");
  }
  if (altoSala >= 2.9) {
    const tam = 0.15;
    const w = L.ancho(p.nombre, tam) + 0.3;
    L.rect(p.u - w / 2, alto + 0.14, w, 0.3, p.enlace ? "#34449a" : "#5a5249");
    L.texto(p.nombre, p.u, alto + 0.24, tam, "#ffffff");
  }
}

function pintarPared(L: Lienzo, dec: Decoracion, lado: Lado, puertas: Puerta[]) {
  const largo = L.largo, alto = L.alto;
  const libre = (u0: number, u1: number) => puertas.every(p => u1 < p.u - p.ancho / 2 - 0.25 || u0 > p.u + p.ancho / 2 + 0.25);
  const ventanas = (n: number, z: number, h: number, margen = 0.6) => {
    const paso = (largo - margen * 2) / n;
    for (let i = 0; i < n; i++) {
      const u = margen + i * paso + paso * 0.12, w = paso * 0.76;
      if (libre(u, u + w)) L.ventana(u, z, w, h);
    }
  };

  switch (dec) {
    case "recepcion": {
      L.rect(0, 0, largo, alto, "#efe7d8");
      L.rect(0, 0, largo, 0.12, "#34449a");
      if (lado === "O") {
        const n = 6, s = 0.78, gap = 0.12, u0 = (largo - (n * s + (n - 1) * gap)) / 2;
        "MLCSIA".split("").forEach((letra, i) => {
          L.rect(u0 + i * (s + gap), 0.95, s, s, COLORES_MATERIA[i]);
          L.texto(letra, u0 + i * (s + gap) + s / 2, 1.13, 0.48, i === 3 ? "#1c1a2e" : "#ffffff", { titulo: true, peso: 800 });
        });
        L.texto("Colegio Vanguardia", largo / 2, 2.4, 0.4, "#1c1a2e", { titulo: true, peso: 800 });
        L.texto("Formamos a los líderes del mañana", largo / 2, 2.05, 0.16, "#5a5249", { peso: 600 });
      } else if (lado === "E") {
        L.rect(1.0, 1.95, 0.6, 0.6, "#c42b34");
        L.texto("V", 1.3, 2.06, 0.46, "#ffffff", { titulo: true, peso: 800 });
        L.texto("Recepción", largo / 2 + 0.3, 2.2, 0.36, "#34449a", { titulo: true });
        L.texto("Información · Inscripciones · Pagos", largo / 2 + 0.3, 1.9, 0.14, "#5a5249", { peso: 600 });
        L.circulo(largo - 1.1, 2.25, 0.24, "#ffffff");
        L.circulo(largo - 1.1, 2.25, 0.03, "#1c1a2e");
        L.rect(largo - 1.115, 2.25, 0.03, 0.17, "#1c1a2e");
        L.rect(largo - 1.1, 2.235, 0.13, 0.03, "#1c1a2e");
      } else if (lado === "N") {
        for (const u of [1.6, largo - 3.0]) {
          L.rect(u - 0.06, 1.24, 1.52, 1.02, "#3a3328");
          L.rect(u, 1.3, 1.4, 0.9, "#a9d0e8");
          L.rect(u, 1.3, 1.4, 0.32, "#6f9e62");
          L.circulo(u + 1.05, 1.95, 0.12, "#f2b705");
          L.rect(u + 0.25, 1.62, 0.5, 0.3, "#efe7d8");
          L.rect(u + 0.4, 1.62, 0.2, 0.16, "#8e1820");
        }
      } else {
        ventanas(2, 0.9, 1.8, 0.4);
      }
      break;
    }
    case "pasillo": {
      L.rect(0, 0, largo, alto, "#f1ece2");
      L.rect(0, 0, largo, 1.0, "#e2d8c6");
      L.rect(0, 0, largo, 0.1, "#5a5249");
      if (lado === "E" || lado === "O") { ventanas(1, 0.9, 1.7, 0.5); break; }
      if (lado === "S" && libre(20.2, 23.6)) {
        L.rect(20.2, 1.0, 3.4, 1.2, "#b98a5a");
        L.rect(20.3, 1.1, 3.2, 1.0, "#c99b6b");
        for (let i = 0; i < 7; i++) {
          L.rect(20.45 + i * 0.44, 1.25 + (i % 2) * 0.35, 0.34, 0.42, ["#fffcf6", "#f9df8e", "#cfd4ec", "#f7e1e3"][i % 4]);
          L.rect(20.5 + i * 0.44, 1.55 + (i % 2) * 0.35, 0.22, 0.03, "#786f63");
        }
        L.texto("Avisos", 21.9, 2.3, 0.16, "#34449a");
      }
      for (let u = 0.6; u + 0.45 < largo - 0.4; u += 0.47) {
        if (!libre(u, u + 0.45) || (lado === "S" && u > 19.8 && u < 23.8)) continue;
        L.rect(u, 0.12, 0.45, 1.75, "#4253a8");
        L.rect(u + 0.02, 0.14, 0.41, 1.71, "#4d5eb0");
        for (let k = 0; k < 4; k++) L.rect(u + 0.1, 1.55 + k * 0.05, 0.25, 0.02, "#28367f");
        L.rect(u + 0.36, 1.0, 0.03, 0.12, "#d2c8b7");
      }
      break;
    }
    case "aula": {
      L.rect(0, 0, largo, alto, "#f4eedf");
      L.rect(0, 0, largo, 0.12, "#8e1820");
      if (lado === "N") {
        L.rect(3.4, 0.82, 5.2, 1.36, "#a8774b");
        L.rect(3.5, 0.9, 5.0, 1.2, "#2f5d4a");
        L.texto("¡Bienvenidos!", 6.0, 1.6, 0.3, "#f3f1e8", { peso: 600 });
        L.texto("½ + ¼ = ¾", 6.0, 1.22, 0.18, "#e9e4d0", { peso: 500 });
        L.rect(3.5, 0.82, 5.0, 0.05, "#d8d2c4");
        "ABCDEFGHIJKLMNOPQ".split("").forEach((letra, i) => {
          const u = 1.1 + i * 0.58;
          L.rect(u, 2.3, 0.48, 0.44, COLORES_MATERIA[i % COLORES_MATERIA.length]);
          L.texto(letra, u + 0.24, 2.4, 0.28, i % 6 === 3 ? "#1c1a2e" : "#ffffff", { titulo: true, peso: 800 });
        });
      } else if (lado === "O") {
        ventanas(3, 1.0, 1.5);
      } else if (lado === "E") {
        L.rect(1.0, 1.0, 6.0, 1.3, "#b98a5a");
        L.rect(1.1, 1.1, 5.8, 1.1, "#c99b6b");
        for (let i = 0; i < 9; i++) {
          const u = 1.25 + i * 0.62, z = 1.2 + (i % 2) * 0.45;
          L.rect(u, z, 0.5, 0.38, ["#fffcf6", "#f7f1e5", "#fdf5dc"][i % 3]);
          L.circulo(u + 0.18, z + 0.24, 0.07, COLORES_MATERIA[(i + 3) % 6]);
          L.rect(u + 0.08, z + 0.06, 0.34, 0.06, COLORES_MATERIA[i % 6]);
        }
        L.texto("Nuestros trabajos", 4.0, 2.42, 0.16, "#34449a");
      } else {
        for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) {
          L.rect(7.2 + i * 0.95, 0.15 + k * 0.5, 0.85, 0.42, "#e6dfd2");
          L.rect(7.3 + i * 0.95, 0.2 + k * 0.5, 0.65, 0.3, COLORES_MATERIA[(i + k * 2) % 6]);
        }
      }
      break;
    }
    case "laboratorio": {
      L.rect(0, 0, largo, alto, "#eef1f1");
      L.rect(0, 0, largo, 0.12, "#5a5249");
      if (lado === "N") {
        L.rect(1.9, 0.95, 4.2, 1.25, "#9aa0a6");
        L.rect(2.0, 1.0, 4.0, 1.15, "#ffffff");
        L.texto("H₂O   ·   E = mc²", 4.0, 1.7, 0.2, "#2b3a8c", { peso: 600 });
        L.texto("Método científico", 4.0, 1.3, 0.14, "#b3202a", { peso: 600 });
        const u0 = 7.0, s = 0.19;
        L.rect(u0 - 0.1, 1.0, 18 * s + 0.2, 7 * s + 0.35, "#fffcf6");
        L.texto("Tabla periódica", u0 + 9 * s, 1.0 + 7 * s + 0.1, 0.11, "#1c1a2e");
        for (let fila = 0; fila < 7; fila++) for (let col = 0; col < 18; col++) {
          const hay = fila === 0 ? col === 0 || col === 17 : fila < 3 ? col < 2 || col > 11 : true;
          if (!hay) continue;
          const color = col < 2 ? "#e4a0a4" : col > 11 ? "#93c4b7" : "#aab3dd";
          L.rect(u0 + col * s + 0.01, 1.0 + (6 - fila) * s + 0.06, s - 0.02, s - 0.02, color);
        }
      } else if (lado === "E") {
        ventanas(3, 1.0, 1.5);
      } else if (lado === "O") {
        for (let u = 0.6; u < largo - 0.8; u += 1.0) {
          L.rect(u, 1.55, 0.95, 0.85, "#d2c8b7");
          L.rect(u + 0.05, 1.6, 0.85, 0.75, "#dce9ee");
          for (let k = 0; k < 3; k++) L.rect(u + 0.15 + k * 0.25, 1.65, 0.12, 0.22 + (k % 2) * 0.08, ["#93c4b7", "#f9df8e", "#e4a0a4"][k]);
          L.rect(u + 0.05, 1.95, 0.85, 0.02, "#a59b8b");
        }
      } else {
        L.rect(1.4, 1.15, 1.9, 1.05, "#f4c432");
        L.texto("NORMAS DE", 2.35, 1.95, 0.13, "#1c1a2e", { peso: 800 });
        L.texto("SEGURIDAD", 2.35, 1.78, 0.13, "#1c1a2e", { peso: 800 });
        for (let k = 0; k < 4; k++) L.rect(1.6, 1.3 + k * 0.1, 1.5 - (k % 2) * 0.4, 0.03, "#554b3a");
        L.rect(9.5, 0.6, 0.22, 0.5, "#c8202f");
        L.rect(9.55, 1.1, 0.12, 0.08, "#2b2733");
      }
      break;
    }
    case "biblioteca": {
      L.rect(0, 0, largo, alto, "#efe6d6");
      if (lado === "N" || lado === "S" || lado === "E") ventanas(lado === "E" ? 4 : 5, 2.85, 0.75, 0.5);
      for (let u = 0.3; u + 1.0 <= largo - 0.3; u += 1.04) {
        if (!libre(u, u + 1.0)) continue;
        L.rect(u, 0, 1.0, 2.45, "#6e4a2e");
        for (let k = 0; k < 6; k++) {
          const z = 0.12 + k * 0.38;
          L.rect(u + 0.04, z, 0.92, 0.34, "#3a2a1c");
          let x = u + 0.05;
          let semilla = 0;
          while (x < u + 0.94) {
            const h = hash(Math.round(x * 1000), k + Math.round(u * 10) + semilla++);
            const w = 0.025 + h * 0.045, alturaLibro = 0.22 + hash(semilla, Math.round(x * 997)) * 0.1;
            if (x + w > u + 0.95) break;
            L.rect(x, z, w - 0.004, alturaLibro, COLORES_LIBRO[Math.floor(h * 997) % COLORES_LIBRO.length]);
            x += w;
          }
        }
      }
      if (lado === "O") {
        L.texto("Biblioteca", largo / 2, 3.05, 0.42, "#34449a", { titulo: true, peso: 800 });
        L.texto("Leer es crecer", largo / 2, 2.65, 0.16, "#8e1820", { peso: 600 });
      }
      break;
    }
    case "cafeteria": {
      L.rect(0, 0, largo, alto, "#f3dfc0");
      L.rect(0, 0, largo, 1.3, "#f7f5f0");
      for (let u = 0; u < largo; u += 0.15) L.rect(u, 0, 0.008, 1.3, "#ddd6c8");
      for (let z = 0; z < 1.3; z += 0.15) L.rect(0, z, largo, 0.008, "#ddd6c8");
      L.rect(0, 1.3, largo, 0.08, "#0f7b5f");
      if (lado === "N" || lado === "S") ventanas(4, 1.5, 1.4);
      if (lado === "E") {
        L.rect(4.0, 1.7, 6.0, 1.45, "#2b2733");
        L.texto("Menú del día", 7.0, 2.8, 0.22, "#f4c432", { titulo: true });
        const menu = [["Pollo con arroz y ensalada", "Q20.00"], ["Pasta con vegetales", "Q18.00"], ["Fruta de temporada", "Q6.00"], ["Refresco natural", "Q5.00"]];
        menu.forEach(([plato, precio], i) => {
          L.texto(plato, 4.35, 2.45 - i * 0.2, 0.12, "#f7f1e5", { peso: 500, alinear: "left" });
          L.texto(precio, 9.65, 2.45 - i * 0.2, 0.12, "#f7f1e5", { peso: 700, alinear: "right" });
        });
      }
      if (lado === "O") {
        L.texto("¡Buen provecho!", 3.0, 2.3, 0.3, "#b3202a", { titulo: true, peso: 800 });
        L.texto("¡Buen provecho!", largo - 3.0, 2.3, 0.3, "#0f7b5f", { titulo: true, peso: 800 });
      }
      break;
    }
  }
  for (const p of puertas) pintarPuerta(L, p, alto);
}

function caja(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: RGB, arriba?: RGB, libros = false): Caja {
  return { x0, y0, z0, x1, y1, z1, color, arriba, libros };
}

function mueble(...partes: Caja[]): Mueble {
  return {
    partes,
    caja: {
      x0: Math.min(...partes.map(p => p.x0)), y0: Math.min(...partes.map(p => p.y0)), z0: 0,
      x1: Math.max(...partes.map(p => p.x1)), y1: Math.max(...partes.map(p => p.y1)), z1: Math.max(...partes.map(p => p.z1)),
      color: [0, 0, 0],
    },
  };
}

const MADERA: RGB = [196, 160, 112];
const MADERA_OSCURA: RGB = [122, 82, 51];
const METAL: RGB = [70, 72, 82];
const COLORES_SILLA: RGB[] = [[52, 68, 154], [179, 32, 42], [15, 123, 95], [242, 183, 5]];

function mesa(cx: number, cy: number, w: number, d: number, alto: number, color: RGB, pata: RGB) {
  return [
    caja(cx - w / 2, cy - d / 2, alto - 0.05, cx + w / 2, cy + d / 2, alto, color),
    caja(cx - w / 2 + 0.05, cy - 0.03, 0, cx - w / 2 + 0.1, cy + 0.03, alto - 0.05, pata),
    caja(cx + w / 2 - 0.1, cy - 0.03, 0, cx + w / 2 - 0.05, cy + 0.03, alto - 0.05, pata),
  ];
}

function amueblar(dec: Decoracion, s: Rect): Mueble[] {
  const m: Mueble[] = [];
  switch (dec) {
    case "recepcion":
      m.push(mueble(caja(s.x1 - 1.5, s.y0 + 1.8, 0, s.x1 - 0.9, s.y1 - 1.8, 1.05, MADERA_OSCURA, [236, 229, 216])));
      m.push(mueble(caja(s.x0 + 0.3, s.y0 + 1.2, 0, s.x0 + 1.0, s.y0 + 3.4, 0.45, [52, 68, 154]), caja(s.x0 + 0.3, s.y0 + 1.2, 0.45, s.x0 + 0.5, s.y0 + 3.4, 0.9, [52, 68, 154])));
      break;
    case "aula":
      for (const cx of [s.x0 + 1.8, s.x0 + 3.6, s.x1 - 4.4, s.x1 - 2.6]) {
        for (const cy of [s.y0 + 1.6, s.y0 + 3.2, s.y0 + 5.0]) {
          const color = COLORES_SILLA[Math.floor(hash(cx * 10, cy * 10) * 4)];
          m.push(mueble(
            ...mesa(cx, cy, 0.65, 0.5, 0.74, MADERA, METAL),
            caja(cx - 0.2, cy - 0.7, 0.4, cx + 0.2, cy - 0.3, 0.45, color),
            caja(cx - 0.2, cy - 0.74, 0.45, cx + 0.2, cy - 0.69, 0.85, color),
            caja(cx - 0.03, cy - 0.53, 0, cx + 0.03, cy - 0.47, 0.4, METAL),
          ));
        }
      }
      m.push(mueble(caja(s.x1 - 3.6, s.y1 - 1.3, 0, s.x1 - 2.2, s.y1 - 0.6, 0.76, MADERA_OSCURA, [176, 130, 88])));
      break;
    case "laboratorio":
      for (const cy of [s.y0 + 2.4, s.y0 + 5.6]) {
        m.push(mueble(caja(s.x0 + 2.5, cy - 0.4, 0, s.x1 - 2.5, cy + 0.4, 0.88, [228, 230, 232]), caja(s.x0 + 2.45, cy - 0.45, 0.88, s.x1 - 2.45, cy + 0.45, 0.94, [44, 46, 52])));
      }
      m.push(mueble(caja(s.x0, s.y0 + 0.5, 0, s.x0 + 0.6, s.y1 - 0.5, 0.9, [228, 230, 232], [44, 46, 52])));
      break;
    case "biblioteca":
      for (const [cx, cy] of [[s.x0 + 3.5, s.y0 + 3.5], [s.x0 + 3.5, s.y1 - 3.5], [s.x1 - 3.5, s.y0 + 3.5], [s.x1 - 3.5, s.y1 - 3.5]]) {
        m.push(mueble(...mesa(cx, cy, 2.2, 1.0, 0.76, [176, 130, 88], MADERA_OSCURA)));
      }
      for (const cy of [s.y0 + 2.0, s.y1 - 2.0]) {
        const cx = (s.x0 + s.x1) / 2;
        m.push(mueble(caja(cx - 3, cy - 0.3, 0, cx + 3, cy + 0.3, 1.45, MADERA_OSCURA, [150, 106, 70], true)));
      }
      break;
    case "cafeteria":
      m.push(mueble(caja(s.x1 - 1.4, s.y0 + 2, 0, s.x1 - 0.5, s.y1 - 2, 0.95, [186, 192, 198], [214, 218, 222])));
      for (const cy of [s.y0 + 3.2, s.y1 - 3.2]) {
        for (const [a, b] of [[s.x0 + 2.5, s.x0 + 6.5], [s.x0 + 8, s.x0 + 12]]) {
          const cx = (a + b) / 2;
          m.push(mueble(
            ...mesa(cx, cy, b - a, 0.9, 0.75, [240, 236, 228], METAL),
            caja(a, cy - 0.85, 0.42, b, cy - 0.55, 0.47, COLORES_SILLA[0]),
            caja(a, cy + 0.55, 0.42, b, cy + 0.85, 0.47, COLORES_SILLA[1]),
          ));
        }
      }
      break;
  }
  return m;
}

// Choque de un rayo con una caja (método de las placas); deja el eje de la cara golpeada en EJE
let EJE = 0;
function rayoCaja(c: Caja, ox: number, oy: number, oz: number, ix: number, iy: number, iz: number, tMax: number): number {
  let t0 = 0, t1 = tMax, eje = -1;
  let a = (c.x0 - ox) * ix, b = (c.x1 - ox) * ix;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > t0) { t0 = a; eje = 0; }
  if (b < t1) t1 = b;
  if (t0 > t1) return -1;
  a = (c.y0 - oy) * iy; b = (c.y1 - oy) * iy;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > t0) { t0 = a; eje = 1; }
  if (b < t1) t1 = b;
  if (t0 > t1) return -1;
  a = (c.z0 - oz) * iz; b = (c.z1 - oz) * iz;
  if (a > b) { const t = a; a = b; b = t; }
  if (a > t0) { t0 = a; eje = 2; }
  if (b < t1) t1 = b;
  if (t0 > t1 || eje < 0) return -1;
  EJE = eje;
  return t0;
}

function colorPiso(piso: Piso, x: number, y: number) {
  switch (piso) {
    case "baldosa": {
      const u = x / 0.5, v = y / 0.5;
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      if (fu < 0.03 || fv < 0.03) { rgb([196, 188, 172]); return; }
      const par = (Math.floor(u) + Math.floor(v)) & 1;
      rgb(par ? [236, 230, 218] : [222, 213, 196], 0.97 + hash(Math.floor(u), Math.floor(v)) * 0.05);
      return;
    }
    case "madera": {
      const fila = Math.floor(y / 0.16);
      const desfase = hash(fila, 7) * 1.4;
      const tabla = Math.floor((x + desfase) / 1.4);
      const fv = y / 0.16 - fila, fu = (x + desfase) / 1.4 - tabla;
      if (fv < 0.05 || fu < 0.008) { rgb([112, 76, 46]); return; }
      const vetas = 0.94 + 0.06 * Math.sin(x * 9 + hash(tabla, fila) * 6);
      rgb([176, 124, 78], (0.86 + hash(tabla, fila) * 0.2) * vetas);
      return;
    }
    case "vinil": {
      const u = x / 0.6, v = y / 0.6;
      const fu = u - Math.floor(u), fv = v - Math.floor(v);
      const punto = hash(Math.floor(x * 40), Math.floor(y * 40)) > 0.9 ? 0.9 : 1;
      rgb(fu < 0.015 || fv < 0.015 ? [170, 176, 180] : [206, 212, 214], punto);
      return;
    }
  }
}

function colorTecho(x: number, y: number) {
  const u = x / 0.6, v = y / 0.6;
  const fu = u - Math.floor(u), fv = v - Math.floor(v);
  const iu = Math.floor(u), iv = Math.floor(v);
  if (((iu % 4) + 4) % 4 === 1 && ((iv % 3) + 3) % 3 === 1) { rgb([255, 255, 250]); return; }
  rgb(fu < 0.03 || fv < 0.03 ? [214, 210, 202] : [240, 238, 232]);
}

function colorLibros(s: number, z: number, base: RGB) {
  const estante = Math.floor((z - 0.1) / 0.32);
  const zl = z - 0.1 - estante * 0.32;
  if (z < 0.1 || estante > 3 || zl > 0.27) { rgb(base); return; }
  const libro = Math.floor(s / 0.045);
  const h = hash(libro, estante);
  if (zl > 0.18 + h * 0.09) { rgb([58, 42, 28]); return; }
  const c = COLORES_LIBRO[Math.floor(h * 997) % COLORES_LIBRO.length];
  R = parseInt(c.slice(1, 3), 16); G = parseInt(c.slice(3, 5), 16); B = parseInt(c.slice(5, 7), 16);
}

async function trazarInterior(punto: PuntoRecorrido, img: ImageData) {
  if (punto.ambiente.tipo !== "interior") return;
  const { sala, alto, piso, decoracion } = punto.ambiente;
  const cx = punto.x, cy = punto.y;

  const puertasPorLado: Record<Lado, Puerta[]> = { N: [], E: [], S: [], O: [] };
  for (const destino of punto.enlaces) {
    const otro = buscarPunto(destino);
    const { lado, u } = paredEnRumbo(sala, cx, cy, rumboEnlace(punto, destino));
    const exterior = otro.ambiente.tipo === "exterior";
    puertasPorLado[lado].push({ u, ancho: exterior ? 2.0 : 1.1, nombre: otro.nombre, exterior, enlace: true });
  }
  for (const p of PUERTAS_EXTRA[decoracion] ?? []) {
    puertasPorLado[p.lado].push({ u: uPared(sala, p.lado, p.x, p.y), ancho: 1.0, nombre: p.nombre, exterior: false, enlace: false });
  }

  const paredes = {} as Record<Lado, Textura>;
  for (const lado of ["N", "E", "S", "O"] as Lado[]) {
    const L = new Lienzo(largoPared(sala, lado), alto);
    pintarPared(L, decoracion, lado, puertasPorLado[lado]);
    paredes[lado] = L.textura();
  }
  const muebles = amueblar(decoracion, sala);
  const alturaMuebles = Math.max(0, ...muebles.map(m => m.caja.z1));

  await recorrerPixeles(img, (dx, dy, dz) => {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    const tx = dx > 0 ? (sala.x1 - cx) * ix : (sala.x0 - cx) * ix;
    const ty = dy > 0 ? (sala.y1 - cy) * iy : (sala.y0 - cy) * iy;
    const tz = dz > 0 ? (alto - OJO) * iz : -OJO * iz;
    let t = Math.min(tx, ty, tz);

    // Muebles (todos quedan por debajo de los ojos)
    let golpe: Caja | null = null, ejeGolpe = 0;
    if (dz < 0 || alturaMuebles > OJO) {
      for (const m of muebles) {
        if (rayoCaja(m.caja, cx, cy, OJO, ix, iy, iz, t) < 0) continue;
        for (const p of m.partes) {
          const tp = rayoCaja(p, cx, cy, OJO, ix, iy, iz, t);
          if (tp >= 0 && tp < t) { t = tp; golpe = p; ejeGolpe = EJE; }
        }
      }
    }

    const hx = cx + dx * t, hy = cy + dy * t, hz = OJO + dz * t;
    let luz = 0.8 + 0.2 * Math.exp(-t / 10);

    if (golpe) {
      if (ejeGolpe === 2) rgb(golpe.arriba ?? golpe.color, 1.06);
      else if (golpe.libros) colorLibros(ejeGolpe === 0 ? hy : hx, hz, golpe.color);
      else rgb(golpe.color, 1);
      luz *= ejeGolpe === 2 ? 1 : ejeGolpe === 0 ? 0.8 : 0.9;
    } else if (t === tz) {
      if (dz < 0) {
        colorPiso(piso, hx, hy);
        const dPared = Math.min(hx - sala.x0, sala.x1 - hx, hy - sala.y0, sala.y1 - hy);
        luz *= 1 - 0.3 * Math.exp(-dPared * 3);
        for (const m of muebles) {
          const c = m.caja;
          if (hx > c.x0 - 0.05 && hx < c.x1 + 0.05 && hy > c.y0 - 0.05 && hy < c.y1 + 0.05) { luz *= 0.62; break; }
        }
      } else {
        colorTecho(hx, hy);
        const dPared = Math.min(hx - sala.x0, sala.x1 - hx, hy - sala.y0, sala.y1 - hy);
        luz *= 1 - 0.25 * Math.exp(-dPared * 3);
      }
    } else {
      const lado: Lado = t === tx ? (dx > 0 ? "E" : "O") : dy > 0 ? "N" : "S";
      const u = uPared(sala, lado, hx, hy);
      const tex = paredes[lado];
      muestrear(tex, u * PX, (alto - hz) * PX);
      const largo = largoPared(sala, lado);
      const borde = Math.min(hz, alto - hz, u, largo - u);
      luz *= (1 - 0.32 * Math.exp(-borde * 3)) * (lado === "N" || lado === "S" ? 1 : 0.93);
    }
    R *= luz; G *= luz; B *= luz;
  });
}

// ───────────────────────── Exteriores ─────────────────────────

interface Cartel { edificio: string; cara: Lado; s: number; z: number; tex: Textura; ancho: number; alto: number }
interface PuertaFachada { edificio: string; cara: Lado; s: number; ancho: number }

/** Coordenada a lo largo de la fachada vista desde afuera (de izquierda a derecha) */
function sFachada(e: Rect, cara: Lado, x: number, y: number) {
  switch (cara) {
    case "S": return x - e.x0;
    case "N": return e.x1 - x;
    case "E": return y - e.y0;
    case "O": return e.y1 - y;
  }
}

function largoFachada(e: Rect, cara: Lado) {
  return cara === "N" || cara === "S" ? e.x1 - e.x0 : e.y1 - e.y0;
}

/** Edificio y fachada que se ven al mirar con cierto rumbo desde afuera */
function fachadaEnRumbo(x: number, y: number, yaw: number): { edificio: Edificio; cara: Lado; s: number } | null {
  const dx = Math.sin(yaw), dy = Math.cos(yaw);
  let mejor: { edificio: Edificio; cara: Lado; s: number } | null = null, tMejor = Infinity;
  for (const e of EDIFICIOS) {
    const c = caja(e.x0, e.y0, 0, e.x1, e.y1, e.alto, e.color);
    const t = rayoCaja(c, x, y, OJO, 1 / dx, 1 / dy, 1 / 1e-9, Infinity);
    if (t < 0 || t >= tMejor || EJE === 2) continue;
    const cara: Lado = EJE === 0 ? (dx > 0 ? "O" : "E") : dy > 0 ? "S" : "N";
    tMejor = t;
    mejor = { edificio: e, cara, s: sFachada(e, cara, x + dx * t, y + dy * t) };
  }
  return mejor;
}

function cartel(texto: string, tam: number, fondo: string, color: string): { tex: Textura; ancho: number; alto: number } {
  const medidor = new Lienzo(1, 1);
  const ancho = medidor.ancho(texto, tam, true) + tam * 1.4, alto = tam * 1.7;
  const L = new Lienzo(ancho, alto);
  L.rect(0, 0, ancho, alto, fondo);
  L.texto(texto, ancho / 2, alto * 0.3, tam, color, { titulo: true, peso: 800 });
  return { tex: L.textura(), ancho, alto };
}

const CIELO_ALTO: RGB = [86, 142, 200];
const CIELO_HORIZONTE: RGB = [206, 226, 240];
const NIEBLA: RGB = [196, 210, 220];
const CESPED: RGB = [96, 150, 70];

function colorSuelo(x: number, y: number) {
  if (x >= CANCHA.x0 && x <= CANCHA.x1 && y >= CANCHA.y0 && y <= CANCHA.y1) {
    const cxm = (CANCHA.x0 + CANCHA.x1) / 2, cym = (CANCHA.y0 + CANCHA.y1) / 2;
    const dBorde = Math.min(x - CANCHA.x0, CANCHA.x1 - x, y - CANCHA.y0, CANCHA.y1 - y);
    const r = Math.hypot(x - cxm, y - cym);
    const area = Math.abs(x - cxm) < 2.5 && (y - CANCHA.y0 < 5.8 || CANCHA.y1 - y < 5.8);
    const linea = dBorde < 0.1 || Math.abs(y - cym) < 0.05 || Math.abs(r - 1.8) < 0.05
      || (Math.abs(Math.abs(x - cxm) - 2.5) < 0.05 && (y - CANCHA.y0 < 5.8 || CANCHA.y1 - y < 5.8))
      || (Math.abs(y - CANCHA.y0 - 5.8) < 0.05 && Math.abs(x - cxm) < 2.5) || (Math.abs(CANCHA.y1 - y - 5.8) < 0.05 && Math.abs(x - cxm) < 2.5);
    if (linea) { rgb([246, 244, 238]); return; }
    rgb(area ? [176, 52, 46] : [44, 118, 104], 0.97 + ruido(x * 3, y * 3) * 0.06);
    return;
  }
  const enCampus = x > -36 && x < 36 && y > 0 && y < 80;
  const enJardin = JARDINES.some(j => (x - j.x) ** 2 + (y - j.y) ** 2 < j.r * j.r);
  if (y <= 0 && y > -1.5) { rgb([196, 192, 184], 0.95 + hash(Math.floor(x / 1.2), 3) * 0.08); return; }
  if (y <= -1.5 && y > -10) {
    const linea = Math.abs(y + 5.75) < 0.07 && ((x / 3) - Math.floor(x / 3)) < 0.5;
    rgb(linea ? [236, 196, 60] : [74, 76, 82], 0.95 + ruido(x * 4, y * 4) * 0.1);
    return;
  }
  if (!enCampus || enJardin || (y > CANCHA.y0 - 3 && y < 80 && (x < CANCHA.x0 - 1.5 || x > CANCHA.x1 + 1.5))) {
    const franja = Math.floor(x / 2.5) & 1 ? 1.04 : 0.96;
    rgb(CESPED, franja * (0.85 + ruido(x * 2.3, y * 2.3) * 0.25));
    return;
  }
  // Adoquín en patrón de ladrillo
  const fila = Math.floor(y / 0.2);
  const u = x / 0.4 + (fila & 1) * 0.5;
  const pieza = Math.floor(u), fu = u - pieza, fv = y / 0.2 - fila;
  if (fu < 0.05 || fv < 0.08) { rgb([138, 126, 112]); return; }
  const h = hash(pieza, fila);
  rgb(h > 0.85 ? [178, 120, 96] : [196, 178, 156], 0.9 + h * 0.15);
}

function colorFachada(e: Edificio, cara: Lado, s: number, z: number, carteles: Cartel[], puertas: PuertaFachada[]) {
  for (const c of carteles) {
    if (c.edificio === e.id && c.cara === cara && s >= c.s && s < c.s + c.ancho && z >= c.z && z < c.z + c.alto) {
      muestrear(c.tex, (s - c.s) * PX, (c.z + c.alto - z) * PX);
      if (A > 0) return;
    }
  }
  let cercaPuerta = false;
  for (const p of puertas) {
    if (p.edificio !== e.id || p.cara !== cara) continue;
    const d = Math.abs(s - p.s);
    if (d < p.ancho / 2 && z < 2.6) {
      if (d > p.ancho / 2 - 0.08 || z > 2.52 || d < 0.04) { rgb([74, 66, 60]); return; }
      rgb([110, 140, 160], 0.75 + 0.25 * (z / 2.6));
      return;
    }
    if (d < p.ancho / 2 + 0.8 && z < 3.4) cercaPuerta = true;
  }
  rgb(e.color);
  if (z < 0.45) { rgb(e.color, 0.78); return; }
  if (z > e.alto - 0.35) { rgb([248, 246, 240]); return; }
  if (cercaPuerta) return;
  const largo = largoFachada(e, cara);
  const piso = Math.floor(z / 3.2), zp = z - piso * 3.2;
  const bahia = (s - (largo % 3) / 2) / 3, fb = bahia - Math.floor(bahia);
  if (s > 0.8 && s < largo - 0.8 && fb > 0.18 && fb < 0.82 && zp > 1.0 && zp < 2.5 && z < e.alto - 0.8) {
    if (fb < 0.21 || fb > 0.79 || zp < 1.06 || zp > 2.44 || Math.abs(fb - 0.5) < 0.012) { rgb([250, 248, 244]); return; }
    rgb([120, 160, 192], 0.75 + 0.35 * ((zp - 1.0) / 1.5));
  }
}

async function trazarExterior(punto: PuntoRecorrido, img: ImageData) {
  const cx = punto.x, cy = punto.y;

  const carteles: Cartel[] = [];
  for (const e of EDIFICIOS) {
    if (!e.letrero) continue;
    const { tex, ancho, alto } = cartel(e.letrero.texto, e.id === "principal" ? 0.75 : 0.55, "#34449a", "#ffffff");
    const largo = largoFachada(e, e.letrero.cara);
    carteles.push({ edificio: e.id, cara: e.letrero.cara, s: (largo - ancho) / 2, z: e.alto - alto - 0.8, tex, ancho, alto });
  }
  const puertas: PuertaFachada[] = [];
  for (const destino of punto.enlaces) {
    const otro = buscarPunto(destino);
    if (otro.ambiente.tipo !== "interior") continue;
    const f = fachadaEnRumbo(cx, cy, rumboEnlace(punto, destino));
    if (!f) continue;
    puertas.push({ edificio: f.edificio.id, cara: f.cara, s: f.s, ancho: 2.6 });
    const { tex, ancho, alto } = cartel(otro.nombre, 0.2, "#b3202a", "#ffffff");
    carteles.push({ edificio: f.edificio.id, cara: f.cara, s: f.s - ancho / 2, z: 2.75, tex, ancho, alto });
  }
  const cajas = EDIFICIOS.map(e => ({ e, c: caja(e.x0, e.y0, 0, e.x1, e.y1, e.alto, e.color) }));
  const sol = { x: 0.35, y: -0.55, z: 0.76 };

  await recorrerPixeles(img, (dx, dy, dz, yaw, pitch) => {
    const ix = 1 / dx, iy = 1 / dy, iz = 1 / dz;
    let t = dz < 0 ? -OJO * iz : Infinity;
    let quien = dz < 0 ? 1 : 0; // 0 cielo, 1 suelo, 2 edificio, 3 copa, 4 tronco
    let edificio: Edificio | null = null, eje = 0;

    for (const { e, c } of cajas) {
      const tc = rayoCaja(c, cx, cy, OJO, ix, iy, iz, t);
      if (tc >= 0 && tc < t) { t = tc; quien = 2; edificio = e; eje = EJE; }
    }
    let arbol = ARBOLES[0];
    for (const a of ARBOLES) {
      // Copa (esfera)
      const ox = cx - a.x, oy = cy - a.y, oz = OJO - a.alto;
      const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - a.r * a.r;
      const disc = b * b - c;
      if (disc > 0) {
        const tc = -b - Math.sqrt(disc);
        if (tc > 0 && tc < t) { t = tc; quien = 3; arbol = a; }
      }
      // Tronco (cilindro vertical)
      const aa = dx * dx + dy * dy;
      const bb = ox * dx + oy * dy, cc = ox * ox + oy * oy - 0.04;
      const d2 = bb * bb - aa * cc;
      if (d2 > 0) {
        const tc = (-bb - Math.sqrt(d2)) / aa;
        const z = OJO + dz * tc;
        if (tc > 0 && tc < t && z < a.alto - a.r * 0.6) { t = tc; quien = 4; arbol = a; }
      }
    }

    const hx = cx + dx * t, hy = cy + dy * t, hz = OJO + dz * t;
    switch (quien) {
      case 0: {
        const altura = Math.max(0, pitch);
        rgb(CIELO_HORIZONTE);
        mezclar(CIELO_ALTO, Math.pow(Math.min(1, altura / 1.2), 0.6));
        if (dz > 0.03) {
          const px = dx / dz, py = dy / dz;
          const n = ruido(px * 1.2 + 3, py * 1.2) * 0.6 + ruido(px * 3, py * 3) * 0.3 + ruido(px * 7, py * 7) * 0.1;
          mezclar([250, 250, 252], suave(0.52, 0.78, n) * suave(0.03, 0.25, dz) * 0.9);
        }
        // Volcanes y montañas en el horizonte
        const lejos = 0.035 + 0.018 * Math.sin(yaw * 3 + 1) + 0.012 * Math.sin(yaw * 7 + 2) + Math.max(0, 0.16 - Math.abs(yaw + 2.35) * 0.32) + Math.max(0, 0.12 - Math.abs(yaw + 1.7) * 0.3);
        const cerca = 0.02 + 0.014 * Math.sin(yaw * 5 + 4) + 0.008 * Math.sin(yaw * 13);
        if (pitch < cerca) rgb([104, 132, 118]);
        else if (pitch < lejos) rgb([132, 154, 178]);
        break;
      }
      case 1: {
        colorSuelo(hx, hy);
        let luz = 1;
        // Sombra suave al pie de los edificios
        for (const e of EDIFICIOS) {
          const ddx = Math.max(e.x0 - hx, 0, hx - e.x1), ddy = Math.max(e.y0 - hy, 0, hy - e.y1);
          luz *= 1 - 0.3 * Math.exp(-Math.hypot(ddx, ddy) * 1.2);
        }
        for (const a of ARBOLES) {
          const d = Math.hypot(hx - a.x - 0.6, hy - a.y + 0.9);
          if (d < a.r) luz *= 0.65 + 0.35 * (d / a.r) ** 2;
        }
        R *= luz; G *= luz; B *= luz;
        break;
      }
      case 2: {
        const e = edificio!;
        if (eje === 2) { rgb([170, 160, 150]); break; }
        const cara: Lado = eje === 0 ? (dx > 0 ? "O" : "E") : dy > 0 ? "S" : "N";
        colorFachada(e, cara, sFachada(e, cara, hx, hy), hz, carteles, puertas);
        const luz = { S: 1.0, E: 0.9, O: 0.8, N: 0.72 }[cara];
        R *= luz; G *= luz; B *= luz;
        break;
      }
      case 3: {
        const nx = (hx - arbol.x) / arbol.r, ny = (hy - arbol.y) / arbol.r, nz = (hz - arbol.alto) / arbol.r;
        const lambert = Math.max(0, nx * sol.x + ny * sol.y + nz * sol.z);
        const n = ruido(hx * 3, hy * 3 + hz * 3);
        rgb([62, 118, 52], (0.45 + 0.6 * lambert) * (0.75 + n * 0.45));
        break;
      }
      case 4:
        rgb([104, 78, 56], 0.8 + 0.2 * ruido(hz * 8, hx * 8));
        break;
    }
    if (quien !== 0) mezclar(NIEBLA, 1 - Math.exp(-t / 160));
  });
}

// ───────────────────────── Recorrido de píxeles ─────────────────────────

type Sombreador = (dx: number, dy: number, dz: number, yaw: number, pitch: number) => void;

async function recorrerPixeles(img: ImageData, sombrear: Sombreador) {
  const { width: w, height: h, data } = img;
  const senoYaw = new Float64Array(w), cosenoYaw = new Float64Array(w), yaws = new Float64Array(w);
  for (let i = 0; i < w; i++) {
    const yaw = ((i + 0.5) / w - 0.5) * Math.PI * 2;
    yaws[i] = yaw; senoYaw[i] = Math.sin(yaw); cosenoYaw[i] = Math.cos(yaw);
  }
  let inicioPaso = performance.now();
  for (let j = 0; j < h; j++) {
    const pitch = (0.5 - (j + 0.5) / h) * Math.PI;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    for (let i = 0; i < w; i++) {
      sombrear(senoYaw[i] * cp, cosenoYaw[i] * cp, sp, yaws[i], pitch);
      const k = (j * w + i) * 4;
      data[k] = R; data[k + 1] = G; data[k + 2] = B; data[k + 3] = 255;
    }
    if (performance.now() - inicioPaso > MS_POR_PASO) {
      await new Promise(r => setTimeout(r));
      inicioPaso = performance.now();
    }
  }
}

const cache = new Map<string, Promise<string>>();

/** Devuelve una URL (blob) con la foto 360° de ejemplo del punto; se genera una sola vez por sesión */
export function generarPanorama(punto: PuntoRecorrido): Promise<string> {
  let p = cache.get(punto.id);
  if (!p) {
    p = (async () => {
      await Promise.all([
        document.fonts.load(`800 40px ${FUENTE_TITULO}`),
        document.fonts.load(`700 40px ${FUENTE_TEXTO}`),
      ]).catch(() => undefined);
      const canvas = document.createElement("canvas");
      canvas.width = ANCHO; canvas.height = ALTO;
      const ctx = canvas.getContext("2d")!;
      const img = ctx.createImageData(ANCHO, ALTO);
      if (punto.ambiente.tipo === "interior") await trazarInterior(punto, img);
      else await trazarExterior(punto, img);
      ctx.putImageData(img, 0, 0);
      const blob = await new Promise<Blob>((ok, mal) => canvas.toBlob(b => (b ? ok(b) : mal(new Error("No se pudo generar la imagen"))), "image/jpeg", 0.9));
      return URL.createObjectURL(blob);
    })();
    p.catch(() => cache.delete(punto.id));
    cache.set(punto.id, p);
  }
  return p;
}

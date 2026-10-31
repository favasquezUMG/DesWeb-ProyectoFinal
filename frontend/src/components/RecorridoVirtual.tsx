/**
 * Recorrido virtual tipo Street View: fotos 360° conectadas con flechas en el piso
 * y un mini-mapa del campus que marca dónde está el visitante y hacia dónde mira.
 * Se carga con React.lazy porque el visor (three.js) es pesado.
 */
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Viewer } from "@photo-sphere-viewer/core";
import { VirtualTourPlugin, type VirtualTourNode } from "@photo-sphere-viewer/virtual-tour-plugin";
import "@photo-sphere-viewer/core/index.css";
import "@photo-sphere-viewer/virtual-tour-plugin/index.css";
import { ARBOLES, CANCHA, EDIFICIOS, JARDINES, PUNTOS, PUNTO_INICIAL, buscarPunto, rumboEnlace } from "../lib/recorrido";
import { generarPanorama } from "../lib/recorridoPanoramas";
import { Avanzar, Contraer, DarVuelta, Expandir, GirarDerecha, GirarIzquierda, Mapa, X, ZoomIn, ZoomOut } from "./Iconos";

const GIRO = Math.PI / 6;
const ANGULO_AVANCE = (55 * Math.PI) / 180;

async function cargarNodo(id: string): Promise<VirtualTourNode> {
  const punto = buscarPunto(id);
  return {
    id,
    name: punto.nombre,
    panorama: punto.foto ?? (await generarPanorama(punto)),
    links: punto.enlaces.map(destino => ({ nodeId: destino, position: { yaw: rumboEnlace(punto, destino), pitch: 0 } })),
  };
}

function diferenciaAngular(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
}

export default function RecorridoVirtual() {
  const marcoRef = useRef<HTMLDivElement>(null);
  const visorRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const tourRef = useRef<VirtualTourPlugin | null>(null);
  const [actual, setActual] = useState(PUNTO_INICIAL);
  const [yaw, setYaw] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pantallaCompleta, setPantallaCompleta] = useState(false);
  const [mapaVisible, setMapaVisible] = useState(() => window.matchMedia("(min-width: 640px)").matches);

  useEffect(() => {
    if (!visorRef.current) return;
    const viewer = new Viewer({
      container: visorRef.current,
      navbar: false,
      keyboard: false,
      mousewheelCtrlKey: true,
      defaultZoomLvl: 20,
      loadingTxt: "Cargando…",
      lang: {
        ctrlZoom: "Use Ctrl + rueda del mouse para acercar",
        twoFingers: "Use dos dedos para moverse",
        loadError: "No se pudo cargar la imagen",
        webglError: "Su navegador no es compatible con WebGL",
        loading: "Cargando…",
      },
      plugins: [
        VirtualTourPlugin.withConfig({
          dataMode: "server",
          positionMode: "manual",
          renderMode: "3d",
          getNode: cargarNodo,
          startNodeId: PUNTO_INICIAL,
          preload: true,
          transitionOptions: { showLoader: true, speed: "20rpm", effect: "fade", rotation: true },
        }),
      ],
    });
    const tour = viewer.getPlugin<VirtualTourPlugin>(VirtualTourPlugin);
    viewerRef.current = viewer;
    tourRef.current = tour;

    tour.addEventListener("node-changed", ({ node }) => {
      setActual(node.id);
    });
    viewer.addEventListener("position-updated", ({ position }) => setYaw(position.yaw));
    viewer.addEventListener("panorama-error", () => setError("No se pudo cargar esta parte del recorrido."));

    return () => {
      viewer.destroy();
      viewerRef.current = null;
      tourRef.current = null;
    };
  }, []);

  useEffect(() => {
    const alCambiar = () => setPantallaCompleta(document.fullscreenElement === marcoRef.current);
    document.addEventListener("fullscreenchange", alCambiar);
    return () => document.removeEventListener("fullscreenchange", alCambiar);
  }, []);

  const ir = useCallback((id: string) => {
    const tour = tourRef.current;
    if (!tour || id === tour.getCurrentNode()?.id) return;
    const enlace = tour.getCurrentNode()?.links?.find(l => l.nodeId === id);
    tour.setCurrentNode(id, undefined, enlace).catch(() => setError("No se pudo cargar esta parte del recorrido."));
  }, []);

  const girar = useCallback((delta: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const { yaw, pitch } = viewer.getPosition();
    viewer.animate({ yaw: yaw + delta, pitch, speed: "8rpm" });
  }, []);

  /** Avanza hacia el enlace que queda más de frente; si no hay ninguno, gira hacia el más cercano */
  const avanzar = useCallback(() => {
    const viewer = viewerRef.current, tour = tourRef.current;
    const nodo = tour?.getCurrentNode();
    if (!viewer || !nodo) return;
    const punto = buscarPunto(nodo.id);
    const mirada = viewer.getPosition().yaw;
    const [mejor] = punto.enlaces
      .map(id => ({ id, diferencia: diferenciaAngular(rumboEnlace(punto, id), mirada) }))
      .sort((a, b) => a.diferencia - b.diferencia);
    if (!mejor) return;
    if (mejor.diferencia <= ANGULO_AVANCE) ir(mejor.id);
    else viewer.animate({ yaw: rumboEnlace(punto, mejor.id), pitch: 0, speed: "8rpm" });
  }, [ir]);

  const zoom = (delta: number) => {
    const viewer = viewerRef.current;
    if (viewer) viewer.zoom(Math.min(100, Math.max(0, viewer.getZoomLevel() + delta)));
  };

  const alternarPantallaCompleta = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
    else marcoRef.current?.requestFullscreen().catch(() => undefined);
  };

  const alTeclear = (e: KeyboardEvent) => {
    const acciones: Record<string, () => void> = {
      ArrowUp: avanzar, w: avanzar, W: avanzar,
      ArrowDown: () => girar(Math.PI), s: () => girar(Math.PI), S: () => girar(Math.PI),
      ArrowLeft: () => girar(-GIRO), a: () => girar(-GIRO), A: () => girar(-GIRO),
      ArrowRight: () => girar(GIRO), d: () => girar(GIRO), D: () => girar(GIRO),
      "+": () => zoom(15), "-": () => zoom(-15),
    };
    const accion = acciones[e.key];
    if (!accion) return;
    e.preventDefault();
    accion();
  };

  const punto = buscarPunto(actual);

  return (
    <div
      ref={marcoRef}
      tabIndex={0}
      onKeyDown={alTeclear}
      onPointerDownCapture={() => marcoRef.current?.focus({ preventScroll: true })}
      aria-label="Recorrido virtual del colegio. Use las flechas del teclado para girar y avanzar."
      className={`recorrido relative overflow-hidden bg-stone-900 outline-none focus-visible:ring-4 focus-visible:ring-subject-social ${pantallaCompleta ? "w-screen h-screen" : "w-full h-[68vh] min-h-[420px] max-h-[720px] rounded-[28px]"}`}
    >
      <div ref={visorRef} className="absolute inset-0" />

      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-danger-700 text-white text-sm font-semibold px-4 py-2 flex items-center gap-2">
          {error}
          <button type="button" onClick={() => setError(null)} aria-label="Cerrar" className="cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Lugar actual */}
      <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-10 max-w-[calc(100%-5rem)] sm:max-w-[calc(100%-12rem)] md:max-w-sm rounded-[20px] bg-stone-900/75 backdrop-blur text-white px-4 py-3 pointer-events-none">
        <p className="font-display text-lg sm:text-xl font-bold leading-tight">{punto.nombre}</p>
        <p className="hidden sm:block text-sm text-white/75 mt-1 leading-snug">{punto.descripcion}</p>
      </div>

      {/* Zoom y pantalla completa */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-10 flex gap-2">
        <BotonVisor etiqueta={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"} onClick={alternarPantallaCompleta}>
          {pantallaCompleta ? <Contraer className="w-5 h-5" /> : <Expandir className="w-5 h-5" />}
        </BotonVisor>
        <span className="hidden sm:contents">
          <BotonVisor etiqueta="Acercar" onClick={() => zoom(15)}><ZoomIn className="w-5 h-5" /></BotonVisor>
          <BotonVisor etiqueta="Alejar" onClick={() => zoom(-15)}><ZoomOut className="w-5 h-5" /></BotonVisor>
        </span>
      </div>

      {/* Flechas de movimiento */}
      <div className="absolute bottom-3 left-3 sm:bottom-4 sm:left-4 z-10 grid grid-cols-3 gap-1.5" role="group" aria-label="Moverse">
        <span />
        <BotonVisor etiqueta="Avanzar (flecha arriba)" onClick={avanzar} destacado><Avanzar className="w-5 h-5" /></BotonVisor>
        <span />
        <BotonVisor etiqueta="Girar a la izquierda (flecha izquierda)" onClick={() => girar(-GIRO)}><GirarIzquierda className="w-5 h-5" /></BotonVisor>
        <BotonVisor etiqueta="Dar la vuelta (flecha abajo)" onClick={() => girar(Math.PI)}><DarVuelta className="w-5 h-5" /></BotonVisor>
        <BotonVisor etiqueta="Girar a la derecha (flecha derecha)" onClick={() => girar(GIRO)}><GirarDerecha className="w-5 h-5" /></BotonVisor>
      </div>

      {/* Mini-mapa */}
      <div className="absolute bottom-3 right-3 sm:bottom-4 sm:right-4 z-10 flex flex-col items-end gap-2">
        {mapaVisible && <MiniMapa actual={actual} yaw={yaw} onIr={ir} />}
        <BotonVisor etiqueta={mapaVisible ? "Ocultar mapa" : "Mostrar mapa"} onClick={() => setMapaVisible(v => !v)} activo={mapaVisible}>
          <Mapa className="w-5 h-5" />
        </BotonVisor>
      </div>
    </div>
  );
}

function BotonVisor({ etiqueta, onClick, children, destacado = false, activo = false }: { etiqueta: string; onClick: () => void; children: ReactNode; destacado?: boolean; activo?: boolean }) {
  return (
    <button
      type="button"
      title={etiqueta}
      aria-label={etiqueta}
      onClick={onClick}
      className={`w-11 h-11 rounded-full flex items-center justify-center backdrop-blur transition-colors cursor-pointer
        ${destacado ? "bg-action-500 text-white hover:bg-action-600" : activo ? "bg-white text-stone-900 hover:bg-sand-100" : "bg-stone-900/70 text-white hover:bg-stone-900/90"}`}
    >
      {children}
    </button>
  );
}

// ───────────────────────── Mini-mapa ─────────────────────────

const MAPA = { x0: -36, x1: 36, y0: -10, y1: 80 };
const mx = (x: number) => x - MAPA.x0;
const my = (y: number) => MAPA.y1 - y;

function MiniMapa({ actual, yaw, onIr }: { actual: string; yaw: number; onIr: (id: string) => void }) {
  const punto = buscarPunto(actual);
  const grados = (yaw * 180) / Math.PI;
  const conexiones = PUNTOS.flatMap(p => p.enlaces.filter(d => p.id < d).map(d => [p, buscarPunto(d)] as const));

  return (
    <div className="rounded-[20px] bg-sand-50/95 backdrop-blur p-2 shadow-lg">
      <svg viewBox={`0 0 ${MAPA.x1 - MAPA.x0} ${MAPA.y1 - MAPA.y0}`} className="w-[132px] sm:w-[190px] h-auto block" role="img" aria-label={`Mapa del campus. Usted está en ${punto.nombre}.`}>
        <rect x={0} y={0} width={72} height={90} rx={4} fill="#9fbf86" />
        <rect x={mx(-36)} y={my(80)} width={72} height={80} fill="#e6dccb" />
        <rect x={0} y={my(-1.5)} width={72} height={8.5} fill="#4a4c52" />
        <path d={`M0 ${my(-5.75)} H72`} stroke="#ecc43c" strokeWidth={0.3} strokeDasharray="1.5 1.5" />
        <rect x={0} y={my(0)} width={72} height={1.5} fill="#c4c0b8" />
        <rect x={mx(-36)} y={my(80)} width={CANCHA.x0 - 1.5 + 36} height={80 - CANCHA.y0 + 3} fill="#9fbf86" />
        <rect x={mx(CANCHA.x1 + 1.5)} y={my(80)} width={36 - CANCHA.x1 - 1.5} height={80 - CANCHA.y0 + 3} fill="#9fbf86" />
        {JARDINES.map((j, i) => <circle key={i} cx={mx(j.x)} cy={my(j.y)} r={j.r} fill="#9fbf86" />)}

        <rect x={mx(CANCHA.x0)} y={my(CANCHA.y1)} width={CANCHA.x1 - CANCHA.x0} height={CANCHA.y1 - CANCHA.y0} fill="#2c7668" />
        <g stroke="#f6f4ee" strokeWidth={0.3} fill="none">
          <rect x={mx(CANCHA.x0) + 0.3} y={my(CANCHA.y1) + 0.3} width={CANCHA.x1 - CANCHA.x0 - 0.6} height={CANCHA.y1 - CANCHA.y0 - 0.6} />
          <path d={`M${mx(CANCHA.x0)} ${my((CANCHA.y0 + CANCHA.y1) / 2)} H${mx(CANCHA.x1)}`} />
          <circle cx={mx(0)} cy={my((CANCHA.y0 + CANCHA.y1) / 2)} r={1.8} />
        </g>

        {EDIFICIOS.map(e => (
          <rect key={e.id} x={mx(e.x0)} y={my(e.y1)} width={e.x1 - e.x0} height={e.y1 - e.y0} rx={1} fill="#fffcf6" stroke="#a59b8b" strokeWidth={0.4}><title>{e.nombre}</title></rect>
        ))}
        {/* Divisiones internas del edificio principal */}
        <g stroke="#d2c8b7" strokeWidth={0.3}>
          <path d={`M${mx(-18)} ${my(18)} H${mx(18)} M${mx(-18)} ${my(22)} H${mx(-4)} M${mx(4)} ${my(22)} H${mx(18)}`} />
          <path d={`M${mx(-5)} ${my(18)} V${my(10)} M${mx(5)} ${my(18)} V${my(10)} M${mx(-5)} ${my(22)} V${my(30)} M${mx(5)} ${my(22)} V${my(30)}`} />
        </g>
        {ARBOLES.map((a, i) => <circle key={i} cx={mx(a.x)} cy={my(a.y)} r={a.r * 0.7} fill="#5e8f4c" opacity={0.85} />)}

        <g stroke="#34449a" strokeWidth={0.5} strokeDasharray="1.2 1" opacity={0.55}>
          {conexiones.map(([a, b]) => <line key={`${a.id}-${b.id}`} x1={mx(a.x)} y1={my(a.y)} x2={mx(b.x)} y2={my(b.y)} />)}
        </g>

        {/* Cono de visión */}
        <g transform={`translate(${mx(punto.x)} ${my(punto.y)}) rotate(${grados})`}>
          <path d="M0 0 L-6 -11 A12.5 12.5 0 0 1 6 -11 Z" fill="#c42b34" opacity={0.28} />
        </g>

        {PUNTOS.map(p => {
          const esActual = p.id === actual;
          return (
            <g key={p.id} onClick={() => onIr(p.id)} className="cursor-pointer focus:outline-none [&:focus-visible>circle:last-of-type]:stroke-[#f2b705] [&:focus-visible>circle:last-of-type]:stroke-[1.2]"
              role="button" tabIndex={0} aria-label={`Ir a ${p.nombre}`}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onIr(p.id); } }}>
              <title>{p.nombre}</title>
              <circle cx={mx(p.x)} cy={my(p.y)} r={4} fill="transparent" />
              <circle cx={mx(p.x)} cy={my(p.y)} r={esActual ? 2.2 : 1.6} fill={esActual ? "#c42b34" : "#34449a"} stroke="#ffffff" strokeWidth={0.6} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

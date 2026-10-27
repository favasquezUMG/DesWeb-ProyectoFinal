/**
 * Íconos de la app (Phosphor), con la misma API que se usaba con lucide-react.
 * Mezcla de estilos:
 *  - duotono por defecto (dos tonos: contorno + relleno suave)
 *  - trazo grueso para flechas y acciones pequeñas
 *  - fino ("light") cuando el ícono es grande (estados vacíos)
 *  - relleno ("fill") cuando se pide con weight="fill" (opción activa del menú)
 *  - a color: envolver en un elemento con la clase "icono-color" (ver index.css)
 *
 * Están repartidos en dos archivos para que el inicio no descargue los del portal
 * (Phosphor trae los seis pesos de cada ícono). Home.tsx y Ui.tsx importan directo de
 * iconos/publicos.tsx: si importaran este archivo, el portal entero entraría en la carga inicial.
 * Un ícono nuevo va en iconos/publicos.tsx solo si lo usa el inicio o Ui.tsx; si no, en iconos/portal.tsx.
 */
export type { Icono } from "./iconos/crear";
export * from "./iconos/publicos";
export * from "./iconos/portal";

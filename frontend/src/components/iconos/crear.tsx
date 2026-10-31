import { forwardRef, type ComponentType } from "react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";

export type Icono = ComponentType<IconProps & { className?: string }>;

const GRANDE = /\b(w|size)-(8|9|10|11|12|14|16)\b/;

// Sin efectos secundarios: así el empaquetador descarta los íconos que una pantalla no usa
/*#__NO_SIDE_EFFECTS__*/
export function crear(Base: ComponentType<IconProps>, pesoBase: IconWeight): Icono {
  const C = forwardRef<SVGSVGElement, IconProps & { className?: string }>(({ weight, className, ...rest }, ref) => {
    const peso = weight ?? (className && GRANDE.test(className) ? "light" : pesoBase);
    return <Base ref={ref} weight={peso} className={className} {...rest} />;
  });
  return C as unknown as Icono;
}

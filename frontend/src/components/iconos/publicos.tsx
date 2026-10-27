// Íconos que usa el sitio público (inicio y componentes base): van en la carga inicial
import {
  ArrowUp as PhArrowUp, CheckCircle as PhCheckCircle, FileMagnifyingGlass as PhFileMagnifyingGlass, Info as PhInfo, List as PhList, MapPin as PhMapPin, NotePencil as PhNotePencil, Phone as PhPhone, Warning as PhWarning, WarningCircle as PhWarningCircle, X as PhX,
} from "@phosphor-icons/react";
import { crear } from "./crear";

export const AlertCircle = crear(PhWarningCircle, "duotone");
export const AlertTriangle = crear(PhWarning, "duotone");
export const CheckCircle2 = crear(PhCheckCircle, "duotone");
export const ClipboardEdit = crear(PhNotePencil, "duotone");
export const FileSearch = crear(PhFileMagnifyingGlass, "duotone");
export const Info = crear(PhInfo, "duotone");
export const MapPin = crear(PhMapPin, "duotone");
export const Menu = crear(PhList, "bold");
export const Phone = crear(PhPhone, "duotone");
export const X = crear(PhX, "bold");
export const Avanzar = crear(PhArrowUp, "bold");

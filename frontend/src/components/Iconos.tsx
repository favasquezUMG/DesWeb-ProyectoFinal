/**
 * Íconos de la app (Phosphor), con la misma API que se usaba con lucide-react.
 * Mezcla de estilos:
 *  - duotono por defecto (dos tonos: contorno + relleno suave)
 *  - trazo grueso para flechas y acciones pequeñas
 *  - fino ("light") cuando el ícono es grande (estados vacíos)
 *  - relleno ("fill") cuando se pide con weight="fill" (opción activa del menú)
 *  - a color: envolver en un elemento con la clase "icono-color" (ver index.css)
 */
import { forwardRef, type ComponentType } from "react";
import type { IconProps, IconWeight } from "@phosphor-icons/react";
import {
  ArrowElbowDownLeft as PhArrowElbowDownLeft, ArrowLeft as PhArrowLeft, ArrowsClockwise as PhArrowsClockwise, ArrowsLeftRight as PhArrowsLeftRight, Bell as PhBell, BellRinging as PhBellRinging, BellSlash as PhBellSlash, BookBookmark as PhBookBookmark, BookOpen as PhBookOpen, BookOpenText as PhBookOpenText, Buildings as PhBuildings, CalendarCheck as PhCalendarCheck, CalendarDots as PhCalendarDots, CalendarSlash as PhCalendarSlash, CalendarX as PhCalendarX, Car as PhCar, CarProfile as PhCarProfile, CaretDown as PhCaretDown, CaretLeft as PhCaretLeft, CaretRight as PhCaretRight, ChartBar as PhChartBar, ChatCircleText as PhChatCircleText, Check as PhCheck, CheckCircle as PhCheckCircle, Checks as PhChecks, ClipboardText as PhClipboardText, Clock as PhClock, ClockCounterClockwise as PhClockCounterClockwise, Copy as PhCopy, CopySimple as PhCopySimple, CreditCard as PhCreditCard, DotsThreeVertical as PhDotsThreeVertical, DownloadSimple as PhDownloadSimple, EnvelopeSimple as PhEnvelopeSimple, Eye as PhEye, EyeSlash as PhEyeSlash, FileMagnifyingGlass as PhFileMagnifyingGlass, FileText as PhFileText, FloppyDisk as PhFloppyDisk, Gauge as PhGauge, GearSix as PhGearSix, GraduationCap as PhGraduationCap, GridNine as PhGridNine, Heart as PhHeart, House as PhHouse, Info as PhInfo, Key as PhKey, Laptop as PhLaptop, Lightbulb as PhLightbulb, List as PhList, ListChecks as PhListChecks, Lock as PhLock, MagnifyingGlass as PhMagnifyingGlass, MapPin as PhMapPin, Medal as PhMedal, NotePencil as PhNotePencil, Notebook as PhNotebook, PaperPlaneTilt as PhPaperPlaneTilt, PauseCircle as PhPauseCircle, PencilSimple as PhPencilSimple, Phone as PhPhone, PlayCircle as PhPlayCircle, Plus as PhPlus, Printer as PhPrinter, Prohibit as PhProhibit, Receipt as PhReceipt, SealCheck as PhSealCheck, ShieldCheck as PhShieldCheck, ShieldWarning as PhShieldWarning, ShoppingCart as PhShoppingCart, SignOut as PhSignOut, SquaresFour as PhSquaresFour, Stack as PhStack, Star as PhStar, Ticket as PhTicket, Trash as PhTrash, Tray as PhTray, TrendUp as PhTrendUp, User as PhUser, UserCheck as PhUserCheck, UserCircle as PhUserCircle, UserMinus as PhUserMinus, UserPlus as PhUserPlus, Users as PhUsers, UsersThree as PhUsersThree, Wallet as PhWallet, Warning as PhWarning, WarningCircle as PhWarningCircle, WarningOctagon as PhWarningOctagon, X as PhX, XCircle as PhXCircle, Target as PhTarget, Binoculars as PhBinoculars, NavigationArrow as PhNavigationArrow, Student as PhStudent, Chalkboard as PhChalkboard,
} from "@phosphor-icons/react";

export type Icono = ComponentType<IconProps & { className?: string }>;

const GRANDE = /\b(w|size)-(8|9|10|11|12|14|16)\b/;

function crear(Base: ComponentType<IconProps>, pesoBase: IconWeight): Icono {
  const C = forwardRef<SVGSVGElement, IconProps & { className?: string }>(({ weight, className, ...rest }, ref) => {
    const peso = weight ?? (className && GRANDE.test(className) ? "light" : pesoBase);
    return <Base ref={ref} weight={peso} className={className} {...rest} />;
  });
  return C as unknown as Icono;
}

export const AlertCircle = crear(PhWarningCircle, "duotone");
export const AlertOctagon = crear(PhWarningOctagon, "duotone");
export const AlertTriangle = crear(PhWarning, "duotone");
export const ArrowLeft = crear(PhArrowLeft, "bold");
export const Award = crear(PhMedal, "duotone");
export const Ban = crear(PhProhibit, "duotone");
export const Bell = crear(PhBell, "duotone");
export const BellOff = crear(PhBellSlash, "duotone");
export const BellRing = crear(PhBellRinging, "duotone");
export const BookMarked = crear(PhBookBookmark, "duotone");
export const BookOpen = crear(PhBookOpen, "duotone");
export const BookOpenCheck = crear(PhBookOpenText, "duotone");
export const BookText = crear(PhNotebook, "duotone");
export const CalendarCheck = crear(PhCalendarCheck, "duotone");
export const CalendarDays = crear(PhCalendarDots, "duotone");
export const CalendarOff = crear(PhCalendarSlash, "duotone");
export const CalendarX2 = crear(PhCalendarX, "duotone");
export const Car = crear(PhCar, "duotone");
export const CarFront = crear(PhCarProfile, "duotone");
export const Check = crear(PhCheck, "bold");
export const CheckCheck = crear(PhChecks, "bold");
export const CheckCircle2 = crear(PhCheckCircle, "duotone");
export const ChevronDown = crear(PhCaretDown, "bold");
export const ChevronLeft = crear(PhCaretLeft, "bold");
export const ChevronRight = crear(PhCaretRight, "bold");
export const ClipboardCheck = crear(PhListChecks, "duotone");
export const ClipboardEdit = crear(PhNotePencil, "duotone");
export const ClipboardList = crear(PhClipboardText, "duotone");
export const Clock = crear(PhClock, "duotone");
export const Copy = crear(PhCopy, "bold");
export const CopyPlus = crear(PhCopySimple, "bold");
export const CornerDownLeft = crear(PhArrowElbowDownLeft, "bold");
export const CreditCard = crear(PhCreditCard, "duotone");
export const Download = crear(PhDownloadSimple, "bold");
export const Edit = crear(PhPencilSimple, "bold");
export const Eye = crear(PhEye, "bold");
export const EyeOff = crear(PhEyeSlash, "bold");
export const FileBarChart = crear(PhChartBar, "duotone");
export const FileCheck2 = crear(PhSealCheck, "duotone");
export const FileSearch = crear(PhFileMagnifyingGlass, "duotone");
export const FileText = crear(PhFileText, "duotone");
export const Gauge = crear(PhGauge, "duotone");
export const GraduationCap = crear(PhGraduationCap, "duotone");
export const Grid3X3 = crear(PhGridNine, "duotone");
export const Heart = crear(PhHeart, "duotone");
export const History = crear(PhClockCounterClockwise, "duotone");
export const Home = crear(PhHouse, "duotone");
export const Inbox = crear(PhTray, "duotone");
export const Info = crear(PhInfo, "duotone");
export const KeyRound = crear(PhKey, "duotone");
export const Laptop = crear(PhLaptop, "duotone");
export const Layers = crear(PhStack, "duotone");
export const LayoutDashboard = crear(PhSquaresFour, "duotone");
export const Lightbulb = crear(PhLightbulb, "duotone");
export const Lock = crear(PhLock, "duotone");
export const LogOut = crear(PhSignOut, "bold");
export const Mail = crear(PhEnvelopeSimple, "duotone");
export const MapPin = crear(PhMapPin, "duotone");
export const Menu = crear(PhList, "bold");
export const MessageSquare = crear(PhChatCircleText, "duotone");
export const MoreVertical = crear(PhDotsThreeVertical, "bold");
export const PauseCircle = crear(PhPauseCircle, "duotone");
export const Pencil = crear(PhPencilSimple, "bold");
export const Phone = crear(PhPhone, "duotone");
export const PlayCircle = crear(PhPlayCircle, "duotone");
export const Plus = crear(PhPlus, "bold");
export const Printer = crear(PhPrinter, "duotone");
export const Receipt = crear(PhReceipt, "duotone");
export const RefreshCw = crear(PhArrowsClockwise, "bold");
export const Repeat = crear(PhArrowsLeftRight, "bold");
export const Save = crear(PhFloppyDisk, "duotone");
export const School = crear(PhBuildings, "duotone");
export const Search = crear(PhMagnifyingGlass, "bold");
export const Send = crear(PhPaperPlaneTilt, "duotone");
export const Settings = crear(PhGearSix, "duotone");
export const ShieldAlert = crear(PhShieldWarning, "duotone");
export const ShieldCheck = crear(PhShieldCheck, "duotone");
export const ShoppingCart = crear(PhShoppingCart, "duotone");
export const Star = crear(PhStar, "duotone");
export const Ticket = crear(PhTicket, "duotone");
export const Trash2 = crear(PhTrash, "bold");
export const TrendingUp = crear(PhTrendUp, "duotone");
export const User = crear(PhUser, "duotone");
export const UserCheck = crear(PhUserCheck, "duotone");
export const UserMinus = crear(PhUserMinus, "duotone");
export const UserPlus = crear(PhUserPlus, "duotone");
export const UserRound = crear(PhUserCircle, "duotone");
export const UserX = crear(PhUserMinus, "duotone");
export const Users = crear(PhUsers, "duotone");
export const Users2 = crear(PhUsersThree, "duotone");
export const Wallet = crear(PhWallet, "duotone");
export const X = crear(PhX, "bold");
export const XCircle = crear(PhXCircle, "duotone");

// Íconos de la página de inicio
export const Target = crear(PhTarget, "duotone");
export const Binoculars = crear(PhBinoculars, "duotone");
export const Navigation = crear(PhNavigationArrow, "duotone");
export const Student = crear(PhStudent, "duotone");
export const Chalkboard = crear(PhChalkboard, "duotone");

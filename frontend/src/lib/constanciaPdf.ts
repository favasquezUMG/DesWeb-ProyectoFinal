import { jsPDF } from "jspdf";
import type { SolicitudGuardada } from "./solicitudes";
import { formatearFecha } from "./solicitudes";

const PRIMARY = [26, 57, 41] as const; // primary-700
const WARNING = [146, 64, 14] as const; // warning-800
const TEXT = [30, 30, 30] as const;
const MUTED = [110, 110, 110] as const;

export function etiquetaGradoSolicitud(alumno: SolicitudGuardada["alumno"]): string {
  if (alumno.carrera && alumno.anio) return `${alumno.anio} año — ${alumno.carrera}`;
  return alumno.grado ?? "";
}

/** Genera y descarga la constancia de la solicitud como PDF, en el cliente. */
export function generarConstanciaPdf(solicitud: SolicitudGuardada): void {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margenX = 20;
  const anchoUtil = 216 - margenX * 2; // carta ≈ 216mm de ancho
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.text("Colegio Vanguardia", margenX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  y += 7;
  doc.text("Constancia de solicitud de inscripción", margenX, y);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  y += 3;
  doc.line(margenX, y, 216 - margenX, y);

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Número de solicitud: ${solicitud.numero}`, margenX, y);
  doc.setFont("helvetica", "normal");
  y += 6;
  doc.text(`Fecha de emisión: ${formatearFecha(solicitud.fechaSolicitud)}`, margenX, y);

  const seccion = (titulo: string) => {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...PRIMARY);
    doc.text(titulo, margenX, y);
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.2);
    doc.line(margenX, y + 1.5, 216 - margenX, y + 1.5);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...TEXT);
    y += 7;
  };

  const linea = (label: string, valor: string) => {
    doc.text(`${label}: ${valor}`, margenX, y);
    y += 6;
  };

  seccion("Datos del encargado");
  linea("Nombre", `${solicitud.encargado.nombres} ${solicitud.encargado.apellidos}`);
  linea("DPI", solicitud.encargado.dpi);
  linea("Teléfono", solicitud.encargado.telefono);
  linea("Correo electrónico", solicitud.encargado.correo);
  linea("Parentesco con el alumno", solicitud.encargado.parentesco);

  seccion("Datos del alumno");
  linea("Nombre", `${solicitud.alumno.nombres} ${solicitud.alumno.apellidos}`);
  linea("Fecha de nacimiento", formatearFecha(solicitud.alumno.fechaNacimiento));
  linea("Nivel", solicitud.alumno.nivel);
  if (solicitud.alumno.carrera) linea("Carrera", solicitud.alumno.carrera);
  linea("Grado / año solicitado", etiquetaGradoSolicitud(solicitud.alumno));
  linea("Sede", solicitud.alumno.sede);

  seccion("Documentos a presentar en la sede");
  solicitud.documentos.forEach((label) => {
    const lineas = doc.splitTextToSize(`•  ${label}`, anchoUtil);
    doc.text(lineas, margenX, y);
    y += lineas.length * 5;
  });

  seccion("Plazo y condiciones");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WARNING);
  doc.text(`Fecha límite para entregar los documentos: ${formatearFecha(solicitud.fechaLimite)}`, margenX, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT);
  const avisoVencimiento = doc.splitTextToSize(
    "Si los documentos no se presentan físicamente en la sede antes de esa fecha, la solicitud pasará automáticamente a estado VENCIDA y deberá iniciarse un nuevo proceso.",
    anchoUtil
  );
  doc.text(avisoVencimiento, margenX, y);
  y += avisoVencimiento.length * 5 + 4;
  doc.text("El resultado de la solicitud (aprobada o rechazada) se resuelve en un plazo de 5 días hábiles.", margenX, y);

  y += 10;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WARNING);
  const avisoCredenciales = doc.splitTextToSize(
    "Esta constancia NO otorga acceso al sistema. Las credenciales de acceso se envían por correo electrónico únicamente si la solicitud es aprobada.",
    anchoUtil
  );
  doc.text(avisoCredenciales, margenX, y);
  y += avisoCredenciales.length * 5;

  // Firma y sello — si no cabe en la página, se pasa a una nueva
  const yFirma = Math.max(y + 25, 245);
  if (yFirma > 265) {
    doc.addPage();
    y = 30;
  } else {
    y = yFirma;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.setDrawColor(140, 140, 140);
  doc.setLineWidth(0.3);

  doc.line(margenX, y, margenX + 70, y);
  doc.text("Firma del encargado", margenX, y + 5);

  doc.line(216 - margenX - 70, y, 216 - margenX, y);
  doc.text("Sello del colegio", 216 - margenX - 70, y + 5);

  doc.save(`${solicitud.numero}.pdf`);
}

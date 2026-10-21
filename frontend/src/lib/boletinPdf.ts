import { jsPDF } from "jspdf";
import type { BoletinHijoDto } from "./api";

const PRIMARY = [26, 57, 41] as const; // primary-700
const SUCCESS = [21, 128, 61] as const;
const DANGER = [185, 28, 28] as const;
const TEXT = [30, 30, 30] as const;
const MUTED = [110, 110, 110] as const;

const fmt = (n: number | null) => (n === null ? "—" : String(Math.round(n)));

export function generarBoletinPdf(boletin: BoletinHijoDto): void {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margenX = 18;
  const ancho = 216 - margenX * 2;
  let y = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.text("Colegio Vanguardia", margenX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  y += 7;
  doc.text(`Boletín de calificaciones — Ciclo ${boletin.anioLectivo}`, margenX, y);

  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  y += 3;
  doc.line(margenX, y, 216 - margenX, y);

  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const datos: [string, string][] = [
    ["Alumno", boletin.nombre],
    ["Grado", `${boletin.grado} sección ${boletin.seccion}`],
    ["Sede", boletin.sede],
    ["Emitido", new Date().toLocaleDateString("es-GT")],
  ];
  for (const [k, v] of datos) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, margenX, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, margenX + 22, y);
    y += 6;
  }

  // Tabla: curso | U1..U4 | promedio | estado
  y += 4;
  const columnas = [
    { titulo: "Curso", x: margenX + 2 },
    { titulo: "I", x: margenX + 92 },
    { titulo: "II", x: margenX + 106 },
    { titulo: "III", x: margenX + 120 },
    { titulo: "IV", x: margenX + 134 },
    { titulo: "Prom.", x: margenX + 148 },
    { titulo: "Estado", x: margenX + 162 },
  ];
  doc.setFillColor(240, 240, 238);
  doc.rect(margenX, y - 5, ancho, 8, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  columnas.forEach((c) => doc.text(c.titulo, c.x, y));
  y += 8;

  doc.setFontSize(9.5);
  for (const curso of boletin.cursos) {
    if (y > 260) {
      doc.addPage();
      y = 20;
    }
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT);
    const nombreCurso = curso.seccionAnterior ? `${curso.curso} (sec. anterior)` : curso.curso;
    doc.text(doc.splitTextToSize(nombreCurso, 86)[0], columnas[0].x, y);
    curso.unidades.forEach((u, i) => doc.text(fmt(u.nota), columnas[i + 1].x, y));
    doc.setFont("helvetica", "bold");
    doc.text(fmt(curso.promedio), columnas[5].x, y);
    if (curso.aprobado === null) {
      doc.setTextColor(...MUTED);
      doc.text("Pendiente", columnas[6].x, y);
    } else {
      if (curso.aprobado) doc.setTextColor(...SUCCESS);
      else doc.setTextColor(...DANGER);
      doc.text(curso.aprobado ? "Aprobado" : "Reprobado", columnas[6].x, y);
    }
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.2);
    doc.line(margenX, y + 2.5, 216 - margenX, y + 2.5);
    y += 7.5;
  }

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  doc.text(`Promedio general: ${fmt(boletin.promedioGeneral)}`, margenX, y);
  doc.text(`Cursos aprobados: ${boletin.cursosAprobados} de ${boletin.cursosEvaluados} evaluados`, margenX + 70, y);

  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Cada unidad se califica sobre 100 puntos (zona + examen). Nota mínima de aprobación: ${boletin.notaAprobacion}. ` +
      "El promedio considera solo las unidades ya evaluadas.",
    margenX,
    y,
    { maxWidth: ancho },
  );

  const nombreArchivo = `boletin-${boletin.nombre.toLowerCase().replace(/\s+/g, "-")}-${boletin.anioLectivo}.pdf`;
  doc.save(nombreArchivo);
}

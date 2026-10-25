import { jsPDF } from "jspdf";
import type { CatedraticoSedeDto, DashboardSedeDto } from "./api";

const PRIMARY = [43, 58, 140] as const;
const TEXT = [30, 30, 30] as const;
const MUTED = [110, 110, 110] as const;
const ANCHO = 216;
const MARGEN = 18;

function encabezado(doc: jsPDF, titulo: string, subtitulo: string): number {
  let y = 20;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(...PRIMARY);
  doc.text("Colegio Vanguardia", MARGEN, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...MUTED);
  y += 7;
  doc.text(titulo, MARGEN, y);
  y += 5;
  doc.setFontSize(9);
  doc.text(`${subtitulo} · Generado el ${new Date().toLocaleDateString("es-GT")}`, MARGEN, y);
  doc.setDrawColor(...PRIMARY);
  doc.setLineWidth(0.6);
  y += 3;
  doc.line(MARGEN, y, ANCHO - MARGEN, y);
  return y + 9;
}

// Tabla simple con salto de página; columnas en mm desde el margen
function tabla(doc: jsPDF, y: number, columnas: { titulo: string; x: number }[], filas: string[][]): number {
  const cabecera = () => {
    doc.setFillColor(240, 240, 238);
    doc.rect(MARGEN, y - 5, ANCHO - MARGEN * 2, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    columnas.forEach((c) => doc.text(c.titulo, MARGEN + c.x, y));
    y += 8;
  };
  cabecera();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  for (const fila of filas) {
    if (y > 260) {
      doc.addPage();
      y = 20;
      cabecera();
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
    }
    doc.setTextColor(...TEXT);
    fila.forEach((celda, i) => {
      const ancho = (columnas[i + 1]?.x ?? ANCHO - MARGEN * 2) - columnas[i].x - 2;
      doc.text(doc.splitTextToSize(celda, ancho)[0] ?? "", MARGEN + columnas[i].x, y);
    });
    doc.setDrawColor(225, 225, 225);
    doc.setLineWidth(0.2);
    doc.line(MARGEN, y + 2.5, ANCHO - MARGEN, y + 2.5);
    y += 7;
  }
  return y + 4;
}

const archivo = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-");

export function generarResumenSedePdf(d: DashboardSedeDto): void {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  let y = encabezado(doc, `Resumen de ${d.sede}`, `Ciclo escolar ${d.anioLectivo}`);

  doc.setFontSize(10);
  doc.setTextColor(...TEXT);
  const datos: [string, string][] = [
    ["Alumnos inscritos", `${d.alumnos.total} (ciclo anterior: ${d.alumnos.anterior})`],
    ["Tasa de aprobación", d.aprobacion.porcentaje !== null ? `${d.aprobacion.porcentaje}% · promedio ${d.aprobacion.promedio}` : "Sin notas"],
    ["Cuentas con pagos vencidos", `${d.mora.alumnos} (${d.mora.porcentaje}%)`],
    ["Becas activas", `${d.becas.activas} (${d.becas.porcentaje}% del alumnado)`],
    ["Pendientes", `${d.pendientes.solicitudes} solicitudes · ${d.pendientes.justificaciones} justificaciones · ${d.pendientes.sinEncargado} alumnos sin encargado`],
  ];
  for (const [k, v] of datos) {
    doc.setFont("helvetica", "bold");
    doc.text(`${k}:`, MARGEN, y);
    doc.setFont("helvetica", "normal");
    doc.text(v, MARGEN + 58, y);
    y += 6.5;
  }

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PRIMARY);
  doc.text("Aprobación por grado", MARGEN, y);
  y += 8;
  y = tabla(doc, y,
    [{ titulo: "Grado", x: 0 }, { titulo: "Alumnos", x: 80 }, { titulo: "Evaluados", x: 105 }, { titulo: "Aprobados", x: 130 }, { titulo: "%", x: 155 }],
    d.porGrado.map((g) => [g.grado, String(g.total), String(g.evaluados), String(g.aprobados), g.evaluados ? `${Math.round((g.aprobados / g.evaluados) * 100)}%` : "—"]));

  if (d.enRiesgo.length) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PRIMARY);
    doc.text("Alumnos en riesgo académico", MARGEN, y);
    y += 8;
    tabla(doc, y,
      [{ titulo: "Alumno", x: 0 }, { titulo: "Grado", x: 75 }, { titulo: "Promedio", x: 130 }, { titulo: "Cursos < 61", x: 155 }],
      d.enRiesgo.map((a) => [a.nombre, a.grado, String(a.promedio), String(a.cursosReprobados)]));
  }

  doc.save(`resumen-${archivo(d.sede)}-${d.anioLectivo}.pdf`);
}

const minutos = (h: string) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };

export function generarCargaHorariaPdf(catedraticos: CatedraticoSedeDto[], sede: string, anio: number): void {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const y = encabezado(doc, "Carga horaria por catedrático", `${sede} · Ciclo ${anio}`);
  const filas = catedraticos.map((c) => {
    const cursos = c.cursos.filter((x) => x.anioLectivo === anio);
    const horas = cursos.flatMap((x) => x.horarios).reduce((acc, h) => acc + minutos(h.horaFin) - minutos(h.horaInicio), 0) / 60;
    return [c.nombre, c.especialidad ?? "—", String(cursos.length), `${Math.round(horas * 10) / 10} h`, cursos.map((x) => `${x.curso} (${x.seccion})`).join(", ") || "Sin cursos"];
  });
  tabla(doc, y,
    [{ titulo: "Catedrático", x: 0 }, { titulo: "Especialidad", x: 50 }, { titulo: "Cursos", x: 85 }, { titulo: "Horas/sem", x: 102 }, { titulo: "Asignaciones", x: 124 }],
    filas);
  doc.save(`carga-horaria-${archivo(sede)}-${anio}.pdf`);
}

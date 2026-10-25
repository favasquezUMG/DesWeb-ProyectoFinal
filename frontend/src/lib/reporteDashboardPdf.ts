import { jsPDF } from "jspdf";
import type {
  ConteoAlumnosDto,
  TasaAprobacionDTO,
  MetricaMoraDto,
  MetricaBecaDto,
  TendenciaNotasDto,
  BitacoraDto,
} from "./api";

// Paleta de colores ejecutiva
const PRIMARY = [43, 58, 140] as const;     // #2b3a8c - Teal institucional
const ACCENT = [242, 100, 59] as const;      // #b3202a - Coral / Acento
const TEXT_MAIN = [30, 41, 59] as const;     // Slate 800
const TEXT_MUTED = [100, 116, 139] as const; // Slate 500
const BG_CARD = [248, 250, 252] as const;    // Slate 50
const BORDER_CARD = [226, 232, 240] as const;// Slate 200

interface DatosReporteConsolidado {
  alumnos: ConteoAlumnosDto | null;
  aprobacion: TasaAprobacionDTO | null;
  mora: MetricaMoraDto | null;
  becas: MetricaBecaDto | null;
  tendencia: TendenciaNotasDto[];
  actividades: BitacoraDto[];
}

// Helper para limpiar caracteres extraños o emojis que arruinan la fuente estándar de jsPDF
function limpiarTexto(str: string): string {
  return str.replace(/[^\x00-\x7FáéíóúÁÉÍÓÚñÑüÜ%/°—–-]/g, "").trim();
}

export function generarReporteConsolidadoPdf(datos: DatosReporteConsolidado): void {
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  const margenX = 18;
  const anchoPagina = 216;
  const anchoUtil = anchoPagina - margenX * 2; // 180mm
  let y = 18;

  // --- 1. ENCABEZADO INSTITUCIONAL ---
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, anchoPagina, 6, "F"); // Barra superior de acento

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(...PRIMARY);
  doc.text("COLEGIO VANGUARDIA", margenX, y + 8);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Reporte Ejecutivo Consolidado — Dashboard General", margenX, y + 14);

  // Bloque Fecha / Ciclo (Alineado a la derecha)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_MAIN);
  doc.text(`Ciclo Escolar: ${new Date().getFullYear()}`, anchoPagina - margenX, y + 8, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-GT")}`, anchoPagina - margenX, y + 13, { align: "right" });

  y += 20;
  doc.setDrawColor(...BORDER_CARD);
  doc.setLineWidth(0.4);
  doc.line(margenX, y, anchoPagina - margenX, y);

  // --- 2. TARJETAS KPI (GRID 2x2) ---
  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("INDICADORES CLAVE DEL SISTEMA", margenX, y);

  y += 5;
  const anchoCard = (anchoUtil - 6) / 2; // 87mm por tarjeta
  const altoCard = 18;

  const kpis = [
    {
      label: "TOTAL DE ALUMNOS",
      val: datos.alumnos ? `${datos.alumnos.total.toLocaleString()}` : "0",
      sub: datos.alumnos ? limpiarTexto(datos.alumnos.subtexto) : "Sin datos",
    },
    {
      label: "TASA DE APROBACIÓN",
      val: datos.aprobacion ? `${datos.aprobacion.tasaAprobacion}%` : "0%",
      sub: datos.aprobacion ? limpiarTexto(datos.aprobacion.subtexto) : "Sin datos",
    },
    {
      label: "PORCENTAJE DE MORA",
      val: datos.mora ? `${datos.mora.porcentajeMora}%` : "0%",
      sub: datos.mora ? limpiarTexto(datos.mora.subtexto) : "Sin datos",
    },
    {
      label: "BECAS ACTIVAS",
      val: datos.becas ? `${datos.becas.becasActivas}` : "0",
      sub: datos.becas ? limpiarTexto(datos.becas.subtexto) : "Sin datos",
    },
  ];

  kpis.forEach((kpi, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const posX = margenX + col * (anchoCard + 6);
    const posY = y + row * (altoCard + 4);

    // Fondo y borde de la tarjeta
    doc.setFillColor(...BG_CARD);
    doc.setDrawColor(...BORDER_CARD);
    doc.roundedRect(posX, posY, anchoCard, altoCard, 2, 2, "FD");

    // Label
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MUTED);
    doc.text(kpi.label, posX + 4, posY + 5);

    // Valor principal
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(...PRIMARY);
    doc.text(kpi.val, posX + 4, posY + 11);

    // Subtexto
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...TEXT_MAIN);
    doc.text(kpi.sub, posX + 4, posY + 15);
  });

  y += altoCard * 2 + 12;

  // --- 3. TABLA DE RENDIMIENTO ACADÉMICO MES A MES ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("RENDIMIENTO ACADÉMICO PROMEDIO", margenX, y);

  y += 5;
  const anchoCol = anchoUtil / 12; // 15mm por mes

  // Encabezados de meses
  doc.setFillColor(...PRIMARY);
  doc.rect(margenX, y, anchoUtil, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  meses.forEach((m, idx) => {
    doc.text(m, margenX + idx * anchoCol + anchoCol / 2, y + 4.2, { align: "center" });
  });

  // Fila de Valores
  y += 6;
  doc.setFillColor(...BG_CARD);
  doc.setDrawColor(...BORDER_CARD);
  doc.rect(margenX, y, anchoUtil, 7, "FD");

  doc.setFont("helvetica", "semibold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MAIN);

  meses.forEach((_, idx) => {
    const item = datos.tendencia[idx];
    const valStr = item ? `${item.promedio} pts` : "0 pts";
    doc.text(valStr, margenX + idx * anchoCol + anchoCol / 2, y + 4.8, { align: "center" });
  });

  y += 15;

  // --- 4. SECCIÓN DE BITÁCORA / ACTIVIDAD RECIENTE ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PRIMARY);
  doc.text("ÚLTIMAS ACTIVIDADES REGISTRADAS EN BITÁCORA", margenX, y);

  y += 5;

  // Cabecera de la tabla de actividades
  doc.setFillColor(...PRIMARY);
  doc.rect(margenX, y, anchoUtil, 6, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text("FECHA", margenX + 3, y + 4.2);
  doc.text("DETALLE DE LA ACTIVIDAD", margenX + 28, y + 4.2);
  doc.text("USUARIO", anchoPagina - margenX - 3, y + 4.2, { align: "right" });

  y += 6;

  if (datos.actividades && datos.actividades.length > 0) {
    datos.actividades.slice(0, 5).forEach((act, idx) => {
      const fechaFmt = new Date(act.fecha).toLocaleDateString("es-GT");
      const detalleLimpio = limpiarTexto(act.detalle);
      const usuarioLimpio = limpiarTexto(act.usuario);

      // Calcular número de líneas para el detalle comprimido
      const lineasDetalle = doc.splitTextToSize(detalleLimpio, 110);
      const altoFila = Math.max(7, lineasDetalle.length * 4 + 2);

      // Alternar color de fondo en filas
      if (idx % 2 === 0) {
        doc.setFillColor(...BG_CARD);
        doc.rect(margenX, y, anchoUtil, altoFila, "F");
      }
      doc.setDrawColor(...BORDER_CARD);
      doc.line(margenX, y + altoFila, anchoPagina - margenX, y + altoFila);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...TEXT_MAIN);

      // Columna Fecha
      doc.text(fechaFmt, margenX + 3, y + 4.5);

      // Columna Detalle
      doc.text(lineasDetalle, margenX + 28, y + 4.5);

      // Columna Usuario
      doc.setFont("helvetica", "bold");
      doc.text(usuarioLimpio, anchoPagina - margenX - 3, y + 4.5, { align: "right" });

      y += altoFila;
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...TEXT_MUTED);
    doc.text("No existen registros recientes en la bitácora.", margenX + 3, y + 5);
    y += 8;
  }

  // --- 5. FIRMAS DE VALIDACIÓN ---
  const yFirma = Math.max(y + 18, 235);

  doc.setDrawColor(...BORDER_CARD);
  doc.setLineWidth(0.4);

  // Firma 1
  doc.line(margenX + 10, yFirma, margenX + 70, yFirma);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MAIN);
  doc.text("Dirección General", margenX + 40, yFirma + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Colegio Vanguardia", margenX + 40, yFirma + 7.5, { align: "center" });

  // Firma 2
  doc.line(anchoPagina - margenX - 70, yFirma, anchoPagina - margenX - 10, yFirma);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...TEXT_MAIN);
  doc.text("Sello Institucional", anchoPagina - margenX - 40, yFirma + 4, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Validación del Sistema", anchoPagina - margenX - 40, yFirma + 7.5, { align: "center" });

  // Pie de página de cierre
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...TEXT_MUTED);
  doc.text("Documento generado automáticamente por el Sistema de Administración Escolar.", anchoPagina / 2, 268, { align: "center" });

  doc.save(`Reporte_Consolidado_${new Date().getFullYear()}.pdf`);
}
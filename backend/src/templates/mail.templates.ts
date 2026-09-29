type PlantillaResult = {
    subject: string;
    html: string;
};

// Escapa el texto que escriben los usuarios (catedraticos, administradores) antes de meterlo al HTML
const escapeHtml = (texto: string): string =>
    texto
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const parrafos = (texto: string): string =>
    escapeHtml(texto)
        .split(/\r?\n/)
        .filter((linea) => linea.trim())
        .map((linea) => `<p style="margin:0 0 10px 0;">${linea}</p>`)
        .join("");

const botonIngresar = (): string =>
    process.env.APP_URL
        ? `<p style="margin-top:20px;"><a href="${process.env.APP_URL}" style="background-color:#1d4ed8; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:bold;">Ingresar al sistema</a></p>`
        : "";

// Las columnas @db.Date llegan como medianoche UTC; se formatean en UTC para no correr el dia
const formatearFecha = (fecha: Date | string): string =>
    new Date(fecha).toLocaleDateString("es-GT", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
    });

const baseTemplate = (titulo: string, contenidoHtml: string): string => `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8" />
</head>
<body style="margin:0; padding:0; background-color:#f4f4f7; font-family: Arial, Helvetica, sans-serif;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding:24px 0;">
        <tr>
            <td align="center">
                <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:8px; overflow:hidden;">
                    <tr>
                        <td style="background-color:#1d4ed8; padding:16px 24px;">
                            <span style="color:#ffffff; font-size:18px; font-weight:bold;">Sistema Escolar</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:24px;">
                            <h2 style="margin:0 0 16px 0; color:#111827; font-size:18px;">${titulo}</h2>
                            <div style="color:#374151; font-size:14px; line-height:1.6;">
                                ${contenidoHtml}
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding:16px 24px; background-color:#f9fafb; color:#9ca3af; font-size:12px;">
                            Este es un correo automático, por favor no responder.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
`;

export const plantillaRecordatorioEvento = (datos: {
    nombreDestinatario: string;
    nombreEvento: string;
    fecha: Date | string;
    descripcion?: string | null;
    esManana?: boolean;
}): PlantillaResult => {
    const fechaFormateada = formatearFecha(datos.fecha);
    const esManana = datos.esManana ?? true;

    return {
        subject: esManana
            ? `Recordatorio: ${datos.nombreEvento} es mañana`
            : `Recordatorio: ${datos.nombreEvento} - ${fechaFormateada}`,
        html: baseTemplate(
            "Recordatorio de evento",
            `
            <p>Hola ${datos.nombreDestinatario},</p>
            <p>Te recordamos que ${esManana ? "mañana " : "el "}<strong>${fechaFormateada}</strong> se realizará el evento:</p>
            <p style="font-size:16px; font-weight:bold; color:#1d4ed8;">${datos.nombreEvento}</p>
            ${datos.descripcion ? `<p>${datos.descripcion}</p>` : ""}
            `
        ),
    };
};

export const plantillaMatricula = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    estado: "Aceptada" | "Rechazada";
    motivo?: string | null;
}): PlantillaResult => {
    const aceptada = datos.estado === "Aceptada";
    const color = aceptada ? "#16a34a" : "#dc2626";

    return {
        subject: aceptada ? "Matrícula aceptada" : "Matrícula rechazada",
        html: baseTemplate(
            "Notificación de matrícula",
            `
            <p>Hola ${datos.nombreDestinatario},</p>
            <p>La matrícula de <strong>${datos.nombreAlumno}</strong> ha sido:</p>
            <p style="font-size:16px; font-weight:bold; color:${color};">${datos.estado}</p>
            ${datos.motivo ? `<p><strong>Motivo:</strong> ${datos.motivo}</p>` : ""}
            `
        ),
    };
};

export const plantillaNotificacionGeneral = (datos: {
    nombreDestinatario?: string;
    titulo: string;
    mensaje: string;
}): PlantillaResult => {
    return {
        subject: datos.titulo,
        html: baseTemplate(
            datos.titulo,
            `
            ${datos.nombreDestinatario ? `<p>Hola ${datos.nombreDestinatario},</p>` : ""}
            <p>${datos.mensaje}</p>
            `
        ),
    };
};

export const plantillaBoletaNotas = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    seccion: string;
    cursos: { curso: string; unidades: { numero: number; nota: number }[]; total: number }[];
}): PlantillaResult => {
    const numerosUnidad = [...new Set(datos.cursos.flatMap((c) => c.unidades.map((u) => u.numero)))].sort((a, b) => a - b);
    const celda = "padding:6px 8px; border-bottom:1px solid #e5e7eb; text-align:center;";
    const colorNota = (nota: number) => (Math.round(nota) >= 61 ? "#16a34a" : "#dc2626");

    const filas = datos.cursos
        .map((c) => {
            const notasUnidad = numerosUnidad
                .map((n) => {
                    const unidad = c.unidades.find((u) => u.numero === n);
                    return `<td style="${celda}">${unidad ? unidad.nota.toFixed(0) : "—"}</td>`;
                })
                .join("");
            return `<tr>
                <td style="${celda} text-align:left;">${escapeHtml(c.curso)}</td>
                ${notasUnidad}
                <td style="${celda} font-weight:bold; color:${colorNota(c.total)};">${c.total.toFixed(0)}</td>
            </tr>`;
        })
        .join("");

    return {
        subject: `Boleta de notas - ${datos.nombreAlumno}`,
        html: baseTemplate(
            "Boleta de calificaciones",
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            <p>Compartimos las calificaciones de <strong>${escapeHtml(datos.nombreAlumno)}</strong> (${escapeHtml(datos.seccion)}):</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; margin:12px 0;">
                <tr style="background-color:#f3f4f6;">
                    <th style="${celda} text-align:left;">Curso</th>
                    ${numerosUnidad.map((n) => `<th style="${celda}">U${n}</th>`).join("")}
                    <th style="${celda}">Total</th>
                </tr>
                ${filas}
            </table>
            <p style="font-size:12px; color:#6b7280;">La nota mínima de aprobación es 61 puntos.</p>
            ${botonIngresar()}
            `
        ),
    };
};

export const plantillaReporteConducta = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    tipo: string;
    titulo: string;
    descripcion: string;
    autor: string;
    fecha: Date | string;
}): PlantillaResult => {
    const colores: Record<string, string> = { Positivo: "#16a34a", Leve: "#d97706", Grave: "#dc2626" };
    const color = colores[datos.tipo] ?? "#1d4ed8";
    const esPositivo = datos.tipo === "Positivo";

    return {
        subject: esPositivo
            ? `Reconocimiento para ${datos.nombreAlumno}`
            : `Reporte de conducta - ${datos.nombreAlumno}`,
        html: baseTemplate(
            esPositivo ? "Reconocimiento de conducta" : "Reporte de conducta",
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            <p>Se registró un reporte sobre <strong>${escapeHtml(datos.nombreAlumno)}</strong>:</p>
            <p style="margin:12px 0;">
                <span style="background-color:${color}; color:#ffffff; padding:3px 10px; border-radius:12px; font-size:12px; font-weight:bold;">${escapeHtml(datos.tipo)}</span>
                <strong style="margin-left:6px;">${escapeHtml(datos.titulo)}</strong>
            </p>
            <div style="border-left:3px solid ${color}; padding-left:12px; margin:12px 0;">${parrafos(datos.descripcion)}</div>
            <p style="font-size:12px; color:#6b7280;">Reportado por ${escapeHtml(datos.autor)} el ${formatearFecha(datos.fecha)}.</p>
            ${esPositivo ? "" : "<p>Le solicitamos ingresar al sistema para revisar el reporte y marcarlo como revisado.</p>"}
            ${botonIngresar()}
            `
        ),
    };
};

export const plantillaComunicado = (datos: {
    nombreDestinatario: string;
    tipo: string;
    titulo: string;
    mensaje: string;
}): PlantillaResult => {
    return {
        subject: `[${datos.tipo}] ${datos.titulo}`,
        html: baseTemplate(
            escapeHtml(datos.titulo),
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            ${parrafos(datos.mensaje)}
            ${botonIngresar()}
            `
        ),
    };
};

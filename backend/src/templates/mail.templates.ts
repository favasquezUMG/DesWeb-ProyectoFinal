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
                    <th style="${celda}">Promedio</th>
                </tr>
                ${filas}
            </table>
            <p style="font-size:12px; color:#6b7280;">Cada unidad se califica sobre 100 puntos (60 de zona y 40 de examen). La nota final es el promedio de las unidades; la mínima de aprobación es 61 puntos.</p>
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

export const plantillaBeca = (datos: {
    nombreDestinatario: string;
    titulo: string;
    mensaje: string;
}): PlantillaResult => {
    return {
        subject: datos.titulo,
        html: baseTemplate(
            escapeHtml(datos.titulo),
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            ${parrafos(datos.mensaje)}
            <p>Puede consultar el detalle en la sección de Becas del portal.</p>
            ${botonIngresar()}
            `
        ),
    };
};

const quetzales = (monto: number): string =>
    `Q${monto.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const plantillaComprobantePago = (datos: {
    nombreDestinatario: string;
    numero: string;
    fechaPago: Date;
    conceptos: { descripcion: string; alumno: string; monto: number }[];
    total: number;
    referencia: string;
    tarjeta?: string | null;
}): PlantillaResult => {
    const celda = "padding:6px 8px; border-bottom:1px solid #e5e7eb;";
    const fecha = datos.fechaPago.toLocaleString("es-GT", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: process.env.COLEGIO_ZONA_HORARIA || "America/Guatemala",
    });

    const filas = datos.conceptos
        .map(
            (c) => `<tr>
                <td style="${celda}">${escapeHtml(c.descripcion)}<br /><span style="color:#6b7280; font-size:12px;">${escapeHtml(c.alumno)}</span></td>
                <td style="${celda} text-align:right; white-space:nowrap;">${quetzales(c.monto)}</td>
            </tr>`
        )
        .join("");

    return {
        subject: `Comprobante de pago ${datos.numero}`,
        html: baseTemplate(
            "Comprobante de pago",
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            <p>Recibimos su pago correctamente. Este es el detalle:</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; margin:12px 0;">
                <tr><td style="color:#6b7280;">No. de comprobante</td><td style="text-align:right; font-weight:bold;">${escapeHtml(datos.numero)}</td></tr>
                <tr><td style="color:#6b7280;">Fecha de pago</td><td style="text-align:right;">${fecha}</td></tr>
                ${datos.tarjeta ? `<tr><td style="color:#6b7280;">Método de pago</td><td style="text-align:right;">${escapeHtml(datos.tarjeta)}</td></tr>` : ""}
                <tr><td style="color:#6b7280;">Referencia</td><td style="text-align:right; font-size:11px;">${escapeHtml(datos.referencia)}</td></tr>
            </table>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse; font-size:13px; margin:12px 0;">
                <tr style="background-color:#f3f4f6;">
                    <th style="${celda} text-align:left;">Concepto</th>
                    <th style="${celda} text-align:right;">Monto</th>
                </tr>
                ${filas}
                <tr>
                    <td style="padding:8px; font-weight:bold;">Total pagado</td>
                    <td style="padding:8px; text-align:right; font-weight:bold; color:#16a34a;">${quetzales(datos.total)}</td>
                </tr>
            </table>
            <p style="font-size:12px; color:#6b7280;">Este comprobante no sustituye a la factura electrónica (FEL).</p>
            ${botonIngresar()}
            `
        ),
    };
};

// Lleva directo a la circular: el frontend pide iniciar sesion si hace falta y luego la abre
const botonCircular = (eventoId: number, conCosto: boolean): string =>
    process.env.APP_URL
        ? `<p style="margin-top:20px;"><a href="${process.env.APP_URL}/?circular=${eventoId}" style="background-color:#1d4ed8; color:#ffffff; padding:12px 20px; border-radius:6px; text-decoration:none; font-weight:bold;">${conCosto ? "Autorizar y pagar" : "Responder circular"}</a></p>`
        : "";

export const plantillaNuevaCircular = (datos: {
    eventoId: number;
    nombreDestinatario: string;
    nombreEvento: string;
    fecha: Date | string;
    descripcion?: string | null;
    costo: number;
    fechaLimite: Date | string;
}): PlantillaResult => ({
    subject: `Circular: ${datos.nombreEvento} - se requiere su autorización`,
    html: baseTemplate(
        "Nueva circular de autorización",
        `
        <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
        <p>El colegio organiza la siguiente actividad y necesita que autorice (o no) la participación de su hijo o hija:</p>
        <p style="font-size:16px; font-weight:bold; color:#1d4ed8;">${escapeHtml(datos.nombreEvento)}</p>
        ${datos.descripcion ? parrafos(datos.descripcion) : ""}
        <table width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; margin:12px 0;">
            <tr><td style="color:#6b7280;">Fecha de la actividad</td><td style="text-align:right;">${formatearFecha(datos.fecha)}</td></tr>
            <tr><td style="color:#6b7280;">Costo por alumno</td><td style="text-align:right;">${datos.costo > 0 ? quetzales(datos.costo) : "Sin costo"}</td></tr>
            <tr><td style="color:#6b7280;">Responder${datos.costo > 0 ? " y pagar" : ""} a más tardar</td><td style="text-align:right; font-weight:bold;">${formatearFecha(datos.fechaLimite)}</td></tr>
        </table>
        <p>${datos.costo > 0
            ? "Con el botón puede autorizar y pagar en línea en un solo paso. Si autoriza y prefiere pagar después, el cargo queda en su estado de cuenta hasta la fecha límite."
            : "Con el botón puede responder la circular directamente."} También la encuentra en la sección <strong>Circulares</strong> del sistema.</p>
        ${botonCircular(datos.eventoId, datos.costo > 0)}
        `
    ),
});

export const plantillaRecuperarPassword = (datos: {
    nombreDestinatario: string;
    enlace: string;
    minutosVigencia: number;
}): PlantillaResult => {
    return {
        subject: "Restablecer contraseña",
        html: baseTemplate(
            "Restablecer contraseña",
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            <p>Recibimos una solicitud para restablecer la contraseña de su cuenta. Haga clic en el botón para crear una nueva:</p>
            <p style="margin-top:20px;"><a href="${datos.enlace}" style="background-color:#1d4ed8; color:#ffffff; padding:10px 18px; border-radius:6px; text-decoration:none; font-weight:bold;">Crear nueva contraseña</a></p>
            <p style="margin-top:20px;">El enlace vence en ${datos.minutosVigencia} minutos y solo puede usarse una vez.</p>
            <p>Si usted no lo solicitó, ignore este correo: su contraseña actual sigue funcionando.</p>
            `
        ),
    };
};

export const plantillaJustificacion = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    fecha: Date | string;
    aprobada: boolean;
    comentario?: string | null;
}): PlantillaResult => {
    const color = datos.aprobada ? "#16a34a" : "#dc2626";
    const resultado = datos.aprobada ? "aprobada" : "rechazada";
    return {
        subject: `Justificación ${resultado} - ${datos.nombreAlumno}`,
        html: baseTemplate(
            `Justificación de ausencia ${resultado}`,
            `
            <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
            <p>La solicitud para justificar la ausencia de <strong>${escapeHtml(datos.nombreAlumno)}</strong>
            del ${formatearFecha(datos.fecha)} fue
            <strong style="color:${color};">${resultado}</strong>.</p>
            ${datos.aprobada ? "<p>Las faltas de ese día quedan registradas como justificadas.</p>" : ""}
            ${datos.comentario ? `<div style="border-left:3px solid ${color}; padding-left:12px; margin:12px 0;">${parrafos(datos.comentario)}</div>` : ""}
            ${botonIngresar()}
            `
        ),
    };
};

type Credencial = { usuario: string; password: string };

const bloqueCredencial = (titulo: string, c: Credencial): string => `
    <div style="background-color:#f3f4f6; border-radius:6px; padding:12px 16px; margin:12px 0;">
        <p style="margin:0 0 6px 0; font-weight:bold;">${escapeHtml(titulo)}</p>
        <p style="margin:0;">Usuario: <strong>${escapeHtml(c.usuario)}</strong></p>
        <p style="margin:0;">Contraseña temporal: <strong style="font-family:monospace;">${escapeHtml(c.password)}</strong></p>
    </div>`;

export const plantillaInscripcionAprobada = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    grado: string;
    seccion: string;
    sede: string;
    anioLectivo: number;
    /** null si el encargado ya tenía cuenta: usa su contraseña de siempre */
    credencialEncargado: Credencial | null;
    usuarioEncargado: string;
    /** null si el alumno no tiene acceso al portal (por su nivel) */
    credencialAlumno: Credencial | null;
}): PlantillaResult => ({
    subject: `Inscripción aprobada - ${datos.nombreAlumno}`,
    html: baseTemplate(
        "¡Bienvenidos al colegio!",
        `
        <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
        <p>La solicitud de inscripción de <strong>${escapeHtml(datos.nombreAlumno)}</strong> fue
        <strong style="color:#16a34a;">aprobada</strong>. Quedó matriculado en
        <strong>${escapeHtml(datos.grado)} sección ${escapeHtml(datos.seccion)}</strong>, ${escapeHtml(datos.sede)}, ciclo ${datos.anioLectivo}.</p>
        ${datos.credencialEncargado
            ? bloqueCredencial("Su cuenta de encargado", datos.credencialEncargado)
            : `<p>Ya tenía una cuenta en el sistema (<strong>${escapeHtml(datos.usuarioEncargado)}</strong>): el alumno aparece ahora entre sus hijos.</p>`}
        ${datos.credencialAlumno
            ? bloqueCredencial("Cuenta del alumno", datos.credencialAlumno)
            : "<p>Por su nivel, el alumno no tiene cuenta propia en el portal: usted consulta sus notas, asistencia, horario y avisos desde su cuenta.</p>"}
        ${datos.credencialEncargado || datos.credencialAlumno ? "<p>Por seguridad, cambie la contraseña temporal la primera vez que ingrese.</p>" : ""}
        ${botonIngresar()}
        `,
    ),
});

export const plantillaInscripcionRechazada = (datos: {
    nombreDestinatario: string;
    nombreAlumno: string;
    numero: string;
    motivo: string;
}): PlantillaResult => ({
    subject: `Solicitud de inscripción ${datos.numero}`,
    html: baseTemplate(
        "Resultado de su solicitud de inscripción",
        `
        <p>Hola ${escapeHtml(datos.nombreDestinatario)},</p>
        <p>Lamentamos informarle que la solicitud <strong>${escapeHtml(datos.numero)}</strong> para inscribir a
        <strong>${escapeHtml(datos.nombreAlumno)}</strong> no fue aprobada.</p>
        <div style="border-left:3px solid #dc2626; padding-left:12px; margin:12px 0;">${parrafos(datos.motivo)}</div>
        <p>Si tiene dudas, comuníquese con la administración de la sede.</p>
        `,
    ),
});

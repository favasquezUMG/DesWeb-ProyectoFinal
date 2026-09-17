/**
 * Plantillas HTML simples para los correos que envía el sistema.
 * Cada plantilla devuelve { subject, html } listo para pasarle a sendMail().
 */

type PlantillaResult = {
    subject: string;
    html: string;
};

// Envoltorio comun para que todos los correos tengan el mismo estilo
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

// Recordatorio de evento (se envía un día antes)
export const plantillaRecordatorioEvento = (datos: {
    nombreDestinatario: string;
    nombreEvento: string;
    fecha: Date | string;
    descripcion?: string | null;
}): PlantillaResult => {
    const fechaFormateada = new Date(datos.fecha).toLocaleDateString("es-GT", {
        day: "numeric",
        month: "long",
        year: "numeric",
    });

    return {
        subject: `Recordatorio: ${datos.nombreEvento} es mañana`,
        html: baseTemplate(
            "Recordatorio de evento",
            `
            <p>Hola ${datos.nombreDestinatario},</p>
            <p>Te recordamos que mañana <strong>${fechaFormateada}</strong> se realizará el evento:</p>
            <p style="font-size:16px; font-weight:bold; color:#1d4ed8;">${datos.nombreEvento}</p>
            ${datos.descripcion ? `<p>${datos.descripcion}</p>` : ""}
            `
        ),
    };
};

// Notificación de matrícula aceptada o rechazada
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

// Notificación general de la administración
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

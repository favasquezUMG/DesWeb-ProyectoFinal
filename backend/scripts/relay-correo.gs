// Relay de correo para el backend en Render: el plan gratis bloquea los puertos SMTP, así que el
// backend manda cada correo por HTTPS a este script y Google lo envía desde la cuenta dueña del script.
// Ver enviarPorRelay en backend/src/services/mail.service.ts.
//
// Instalación (en https://script.google.com con la cuenta que envía los correos):
//   1. Nuevo proyecto → pegar este archivo en Código.gs → guardar.
//   2. Configuración del proyecto → Propiedades del script → TOKEN = el mismo valor de MAIL_RELAY_TOKEN.
//   3. Implementar → Nueva implementación → Aplicación web.
//      Ejecutar como: "Yo". Quién tiene acceso: "Cualquier usuario". Autorizar los permisos.
//   4. Copiar la URL (termina en /exec) en MAIL_RELAY_URL del backend.
// Al cambiar el código: Implementar → Gestionar implementaciones → editar → Nueva versión (la URL se mantiene).

function doPost(e) {
  try {
    const datos = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('TOKEN');
    if (!token || datos.token !== token) return responder({ ok: false, error: 'Token inválido' });
    if (!datos.to || !datos.subject) return responder({ ok: false, error: 'Faltan destinatario o asunto' });

    MailApp.sendEmail(datos.to, datos.subject, datos.texto || '', {
      htmlBody: datos.html,
      name: datos.nombre || 'Colegio Vanguardia',
    });
    return responder({ ok: true, cuotaRestante: MailApp.getRemainingDailyQuota() });
  } catch (error) {
    return responder({ ok: false, error: String(error) });
  }
}

function responder(datos) {
  return ContentService.createTextOutput(JSON.stringify(datos)).setMimeType(ContentService.MimeType.JSON);
}

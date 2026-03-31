/**
 * WHATSAPP.CONTROLLER.JS - Webhook de respuestas WhatsApp de Twilio
 *
 * Twilio llama a POST /api/webhooks/whatsapp cuando un paciente responde al recordatorio.
 * El body llega como application/x-www-form-urlencoded con campos: From, Body, etc.
 *
 * Flujo:
 *   Paciente responde "1" o "confirmar" → buscar su próximo turno → confirmar → responder ok
 *   Paciente responde "2" o "cancelar"  → buscar su próximo turno → cancelar  → responder ok
 */

const turnoModel = require('../models/turno.model');
const { normalizarTelefono } = require('../services/whatsapp.service');
const logger = require('../utils/logger');

/**
 * Palabras/payloads que significan "confirmar".
 * Incluye el texto que se define como ButtonPayload en la plantilla de Twilio
 * y los textos planos para el fallback sin plantilla.
 */
const PALABRAS_CONFIRMAR = ['confirmar', 'confirmo', '1', 'si', 'sí', 'ok', 'yes'];
/**
 * Palabras/payloads que significan "cancelar".
 */
const PALABRAS_CANCELAR = ['cancelar', 'cancelo', '2', 'no', 'cancel'];

/**
 * WhatsApp (sobre todo Web) abre los enlaces de botones CTA en un visor embebido.
 * Helmet pone X-Frame-Options: SAMEORIGIN → el iframe queda en blanco y parece que "no abre nada".
 */
function prepareTurnoWebhookHtmlResponse(res) {
  res.removeHeader('X-Frame-Options');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "base-uri 'self'",
      "form-action 'self'",
      'frame-ancestors *',
    ].join('; ')
  );
}

/**
 * Normaliza un string de teléfono a dígitos limpios para comparar.
 * Elimina +, espacios, guiones, etc.
 */
function limpiarTelefono(t) {
  if (!t) return '';
  return String(t).replace(/\D/g, '');
}

/**
 * Webhook POST recibido desde Twilio cuando el paciente responde.
 * Twilio espera una respuesta TwiML (XML) o simplemente HTTP 200.
 */
const webhookIncoming = async (req, res) => {
  try {
    // Twilio envía form-urlencoded
    const from = req.body?.From || '';

    // ButtonPayload: viene cuando el paciente tocó un botón Quick Reply de una plantilla.
    // Body: viene siempre (texto del botón o mensaje libre).
    // Se prioriza ButtonPayload sobre Body para mayor precisión.
    const buttonPayload = (req.body?.ButtonPayload || '').trim().toLowerCase();
    const bodyRaw = buttonPayload || (req.body?.Body || '').trim().toLowerCase();

    if (!from || !bodyRaw) {
      return res.status(200).send(twimlRespuesta(''));
    }

    // Extraer número limpio del remitente (ej. "whatsapp:+5491141499723" → "5491141499723")
    const telefonoLimpio = limpiarTelefono(from.replace('whatsapp:', ''));

    // Determinar intención
    const esConfirmar = PALABRAS_CONFIRMAR.includes(bodyRaw);
    const esCancelar = PALABRAS_CANCELAR.includes(bodyRaw);

    if (!esConfirmar && !esCancelar) {
      return res.status(200).send(twimlRespuesta(
        'No entendimos tu respuesta. Respondé *1* para confirmar o *2* para cancelar tu turno.'
      ));
    }

    // Buscar el próximo turno del paciente con recordatorio enviado
    const turnos = await turnoModel.findProximosConRecordatorio();
    const turno = turnos.find((t) => {
      const telTurno = limpiarTelefono(t.paciente_telefono);
      // Comparar los últimos 8 dígitos (por si hay diferencias de código de país)
      return telTurno.slice(-8) === telefonoLimpio.slice(-8);
    });

    if (!turno) {
      logger.warn(`WhatsApp webhook: no se encontró turno para ${from}`);
      return res.status(200).send(twimlRespuesta(
        'No encontramos ningún turno pendiente asociado a este número. Si necesitás ayuda, comunicate con el consultorio.'
      ));
    }

    if (esConfirmar) {
      if (turno.estado === 'confirmado') {
        return res.status(200).send(twimlRespuesta(
          '✅ Tu turno ya estaba confirmado. ¡Te esperamos!'
        ));
      }
      await turnoModel.confirm(turno.id);
      logger.info(`WhatsApp webhook: turno ${turno.id} confirmado por paciente ${from}`);
      return res.status(200).send(twimlRespuesta(
        `✅ *Turno confirmado.* ¡Gracias ${turno.paciente_nombre}! Te esperamos el ${formatearFechaHora(turno.fecha_hora_inicio)}.`
      ));
    }

    if (esCancelar) {
      await turnoModel.cancel(turno.id, 'Cancelado por el paciente vía WhatsApp', null);
      logger.info(`WhatsApp webhook: turno ${turno.id} cancelado por paciente ${from}`);
      return res.status(200).send(twimlRespuesta(
        `❌ *Turno cancelado.* Lamentamos que no puedas asistir. Si querés reprogramar, comunicate con el consultorio.`
      ));
    }
  } catch (err) {
    logger.error('WhatsApp webhook error:', err);
    return res.status(200).send(twimlRespuesta(
      'Ocurrió un error procesando tu respuesta. Por favor comunicate con el consultorio.'
    ));
  }
};

/**
 * Genera una respuesta TwiML válida para Twilio con un mensaje de texto.
 * Si el mensaje está vacío no se envía ninguna respuesta al paciente.
 */
function twimlRespuesta(mensaje) {
  if (!mensaje) {
    return `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  }
  const safe = mensaje.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

function formatearFechaHora(val) {
  if (!val) return '-';
  try {
    const d = new Date(typeof val === 'string' && !val.endsWith('Z') ? val + 'Z' : val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2, '0');
    const meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    const offset = -3 * 60;
    const local = new Date(d.getTime() + offset * 60000);
    return `${local.getUTCDate()} de ${meses[local.getUTCMonth()]} a las ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}hs`;
  } catch {
    return String(val);
  }
}

/**
 * GET /api/webhooks/turno/:id/confirmar
 * El paciente llega aquí tocando el botón CTA de la plantilla.
 * Confirma el turno y devuelve una página HTML con el resultado.
 */
const confirmarPorUrl = async (req, res) => {
  const { id } = req.params;
  prepareTurnoWebhookHtmlResponse(res);
  try {
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).send(htmlResultado(req, 'error', '⚠️ Turno no encontrado', 'No encontramos el turno solicitado. Puede que ya haya sido cancelado o no exista.'));
    }
    if (turno.estado === 'cancelado') {
      return res.send(htmlResultado(req, 'warning', '⚠️ Turno Cancelado', 'Este turno ya fue cancelado previamente. Comunicate con el consultorio para reprogramarlo.'));
    }
    if (turno.estado === 'confirmado') {
      return res.send(htmlResultado(req, 'success', '✅ Turno Confirmado', `Tu turno del ${formatearFechaHora(turno.fecha_hora_inicio)} ya estaba confirmado. ¡Te esperamos!`));
    }
    await turnoModel.confirm(id);
    logger.info(`Turno ${id} confirmado por paciente via URL`);
    return res.send(htmlResultado(req, 'success', '✅ Turno Confirmado', `Tu turno del <strong>${formatearFechaHora(turno.fecha_hora_inicio)}</strong> fue confirmado correctamente. ¡Te esperamos!`));
  } catch (err) {
    logger.error(`Error confirmando turno ${id} via URL:`, err);
    return res.status(500).send(htmlResultado(req, 'error', 'Error', 'Ocurrió un error al confirmar el turno. Por favor comunicate con el consultorio.'));
  }
};

/**
 * GET /api/webhooks/turno/:id/cancelar
 * El paciente llega aquí tocando el botón CTA de la plantilla.
 * Cancela el turno y devuelve una página HTML con el resultado.
 */
const cancelarPorUrl = async (req, res) => {
  const { id } = req.params;
  prepareTurnoWebhookHtmlResponse(res);
  try {
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).send(htmlResultado(req, 'error', 'Turno no encontrado', 'No encontramos el turno solicitado.'));
    }
    if (turno.estado === 'cancelado') {
      return res.send(htmlResultado(req, 'warning', '⚠️ Turno Cancelado', 'Este turno ya estaba cancelado previamente.'));
    }
    if (['completado', 'ausente'].includes(turno.estado)) {
      return res.send(htmlResultado(req, 'warning', '⚠️ No se puede cancelar', 'Este turno ya fue completado o marcado como ausente.'));
    }
    await turnoModel.cancel(id, 'Cancelado por el paciente vía WhatsApp', null);
    logger.info(`Turno ${id} cancelado por paciente via URL`);
    return res.send(htmlResultado(req, 'cancel', '❌ Turno Cancelado', `Tu turno del <strong>${formatearFechaHora(turno.fecha_hora_inicio)}</strong> fue cancelado. Si querés reprogramarlo, comunicate con el consultorio.`));
  } catch (err) {
    logger.error(`Error cancelando turno ${id} via URL:`, err);
    return res.status(500).send(htmlResultado(req, 'error', 'Error', 'Ocurrió un error al cancelar el turno. Por favor comunicate con el consultorio.'));
  }
};

/**
 * Genera una página HTML simple con el resultado de la acción.
 * @param {import('express').Request} req - para URL absoluta del logo (visores embebidos)
 * @param {'success'|'cancel'|'warning'|'error'} tipo
 * @param {string} titulo
 * @param {string} mensaje
 */
function htmlResultado(req, tipo, titulo, mensaje) {
  const proto = (req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const host = req.get('host');
  const logoSrc = host ? `${proto}://${host}/public/logo.png` : '/public/logo.png';
  const colores = {
    success: { bg: '#f0fdf4', border: '#22c55e', icon: '✅', iconColor: '#16a34a' },
    cancel:  { bg: '#fef2f2', border: '#ef4444', icon: '❌', iconColor: '#dc2626' },
    warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠️', iconColor: '#d97706' },
    error:   { bg: '#fef2f2', border: '#ef4444', icon: '⚠️', iconColor: '#dc2626' },
  };
  const c = colores[tipo] || colores.error;
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Cogniare - ${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #ffffff; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; text-align: center; }
    .logo { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); }
    .logo img { height: auto; width: 360px; max-width: 90vw; object-fit: contain; }
    .result-box { background: ${c.bg}; border: 2px solid ${c.border}; border-radius: 20px; padding: 44px 36px; max-width: 520px; width: 100%; }
    .titulo { color: #111827; font-size: 30px; font-weight: 700; margin-bottom: 18px; display: flex; align-items: center; justify-content: center; gap: 10px; }
    .mensaje { color: #374151; font-size: 18px; line-height: 1.8; }
    .footer { position: fixed; bottom: 24px; left: 0; right: 0; text-align: center; color: #9ca3af; font-size: 13px; }
  </style>
</head>
<body>
  <div class="logo">
    <img src="${logoSrc}" alt="Cogniare" />
  </div>
  <div class="result-box">
    <div class="titulo">${titulo}</div>
    <div class="mensaje">${mensaje}</div>
  </div>
  <div class="footer">Sistema de Gestión Clínica · Cogniare</div>
</body>
</html>`;
}

module.exports = { webhookIncoming, confirmarPorUrl, cancelarPorUrl };

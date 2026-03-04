/**
 * WHATSAPP.SERVICE.JS - Servicio de envío de mensajes WhatsApp via Twilio
 */

const logger = require('../utils/logger');
const logModel = require('../models/log.model');

let twilioClient = null;

function getClient() {
  if (twilioClient) return twilioClient;
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID y TWILIO_AUTH_TOKEN son requeridos');
  }
  const twilio = require('twilio');
  twilioClient = twilio(accountSid, authToken);
  return twilioClient;
}

/**
 * Normaliza un número de teléfono al formato internacional para Argentina (+54...).
 * Si ya tiene +, se deja como está.
 */
function normalizarTelefono(telefono) {
  if (!telefono) return null;
  let t = String(telefono).replace(/\D/g, '');
  // Si ya empieza con 54 y tiene longitud suficiente → agregar +
  if (t.startsWith('54') && t.length >= 12) return `+${t}`;
  // Si empieza con 0 (número local Argentina, ej. 011...) → quitar el 0 y agregar +54
  if (t.startsWith('0')) t = t.slice(1);
  // Si empieza con 15 (celular sin código de área) → no se puede normalizar sin código de área
  return `+54${t}`;
}

/**
 * Enviar mensaje WhatsApp con texto plano.
 * @param {string} to - Número destino (se normaliza a +54...)
 * @param {string} body - Texto del mensaje
 */
async function enviarMensaje(to, body) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM no está configurado');

  const toNormalizado = normalizarTelefono(to);
  if (!toNormalizado) throw new Error(`Número de teléfono inválido: ${to}`);

  const toWhatsApp = toNormalizado.startsWith('whatsapp:') ? toNormalizado : `whatsapp:${toNormalizado}`;
  const fromWhatsApp = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

  const client = getClient();
  const message = await client.messages.create({ from: fromWhatsApp, to: toWhatsApp, body });
  logger.info(`WhatsApp enviado a ${toWhatsApp} | SID: ${message.sid}`);
  return message;
}

/**
 * Enviar mensaje WhatsApp usando una plantilla con botones (Content API).
 * @param {string} to - Número destino
 * @param {string} contentSid - SID de la plantilla (HXxx...)
 * @param {Object} variables - Variables de la plantilla { "1": valor, "2": valor, ... }
 */
async function enviarMensajePlantilla(to, contentSid, variables) {
  const from = process.env.TWILIO_WHATSAPP_FROM;
  if (!from) throw new Error('TWILIO_WHATSAPP_FROM no está configurado');

  const toNormalizado = normalizarTelefono(to);
  if (!toNormalizado) throw new Error(`Número de teléfono inválido: ${to}`);

  const toWhatsApp = toNormalizado.startsWith('whatsapp:') ? toNormalizado : `whatsapp:${toNormalizado}`;
  const fromWhatsApp = from.startsWith('whatsapp:') ? from : `whatsapp:${from}`;

  const client = getClient();
  const message = await client.messages.create({
    from: fromWhatsApp,
    to: toWhatsApp,
    contentSid,
    contentVariables: JSON.stringify(variables),
  });
  logger.info(`WhatsApp (plantilla) enviado a ${toWhatsApp} | SID: ${message.sid}`);
  return message;
}

/**
 * Enviar recordatorio de turno por WhatsApp.
 * - Si TWILIO_CONTENT_SID_RECORDATORIO está configurado → usa la plantilla con botones CTA.
 * - Si no → manda texto plano con instrucciones "1" o "2".
 *
 * Variables de la plantilla:
 *   {{1}} = nombre del paciente
 *   {{2}} = nombre del profesional (con especialidad)
 *   {{3}} = fecha y hora del turno
 *   {{4}} = turno_id  ← usado en la URL de los botones CTA
 *
 * Los botones CTA de la plantilla deben apuntar a:
 *   Confirmar → https://tudominio.com/api/webhooks/turno/{{4}}/confirmar
 *   Cancelar  → https://tudominio.com/api/webhooks/turno/{{4}}/cancelar
 *
 * @param {Object} turno
 */
/**
 * Capitaliza la primera letra de cada palabra (Title Case).
 * "dr. juan pérez" → "Dr. Juan Pérez"
 */
function titleCase(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

async function enviarRecordatorioTurno(turno) {
  // 1. Verificar que el profesional tenga los recordatorios activos
  if (turno.recordatorio_activo === false) {
    logger.warn(`Recordatorio omitido (recordatorios desactivados por el profesional) para turno ${turno.id}`);
    return null;
  }

  // 2. Verificar que el paciente tenga notificaciones habilitadas (más específico, tiene prioridad)
  if (turno.paciente_notificaciones_activas === false) {
    logger.warn(`Recordatorio omitido (notificaciones desactivadas para el paciente) para turno ${turno.id}`);
    return null;
  }

  const telefono = turno.paciente_whatsapp;
  if (!telefono) {
    logger.warn(`Recordatorio omitido (sin número de WhatsApp) para turno ${turno.id}`);
    return null;
  }

  const fecha = formatearFechaHora(turno.fecha_hora_inicio);
  const nombrePaciente = titleCase(`${turno.paciente_nombre || ''} ${turno.paciente_apellido || ''}`.trim());
  const nombreProfesional = titleCase(`${turno.profesional_nombre || ''} ${turno.profesional_apellido || ''}`.trim());
  const especialidad = turno.profesional_especialidad ? titleCase(turno.profesional_especialidad) : '';

  const contentSid = process.env.TWILIO_CONTENT_SID_RECORDATORIO;

  if (contentSid) {
    return enviarMensajePlantilla(telefono, contentSid, {
      '1': nombrePaciente,
      '2': nombreProfesional,
      '3': especialidad,
      '4': fecha,
      '5': turno.id,
    });
  }

  // Fallback: texto plano
  const baseUrl = process.env.API_PUBLIC_URL || '';
  const urlConfirmar = baseUrl ? `${baseUrl}/api/webhooks/turno/${turno.id}/confirmar` : null;
  const urlCancelar = baseUrl ? `${baseUrl}/api/webhooks/turno/${turno.id}/cancelar` : null;

  const lines = [
    `Hola ${nombrePaciente}, te recordamos que tenés el siguiente turno programado:`,
    ``,
    `👨‍⚕️ *Profesional:* ${nombreProfesional}`,
  ];

  if (especialidad) lines.push(`🩺 *Especialidad:* ${especialidad}`);

  lines.push(`📆 *Fecha y Hora:* ${fecha}`);
  lines.push(``);

  if (urlConfirmar && urlCancelar) {
    lines.push(`✅ *Confirmar turno:* ${urlConfirmar}`);
    lines.push(`❌ *Cancelar turno:* ${urlCancelar}`);
  }

  return enviarMensaje(telefono, lines.join('\n'));
}

function formatearFechaHora(val) {
  if (!val) return '-';
  try {
    const d = new Date(typeof val === 'string' && !val.endsWith('Z') ? val + 'Z' : val);
    if (isNaN(d.getTime())) return String(val);
    const pad = (n) => String(n).padStart(2, '0');
    const dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    // Convertir UTC a hora Argentina (UTC-3)
    const offset = -3 * 60;
    const local = new Date(d.getTime() + offset * 60000);
    return `${dias[local.getUTCDay()]} ${local.getUTCDate()} de ${meses[local.getUTCMonth()]} del ${local.getUTCFullYear()} a las ${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}Hs`;
  } catch {
    return String(val);
  }
}

module.exports = { enviarMensaje, enviarRecordatorioTurno, normalizarTelefono };

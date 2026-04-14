/**
 * WHATSAPP.SERVICE.JS - Servicio de envío de mensajes WhatsApp via Twilio
 */

const logger = require('../utils/logger');
const { formatearFechaHoraRecordatorio: formatearFechaHora } = require('../utils/fechaArgentina');

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

/** Estados que indican que Twilio no aceptó / no entregó el mensaje (no marcar recordatorio enviado). */
const TWILIO_STATUS_RECHAZADO = new Set(['failed', 'undelivered', 'canceled']);

/**
 * Tras messages.create, Twilio suele devolver queued/sent/… Si viene errorCode o estado de fallo,
 * o un estado desconocido con valor definido, no consideramos el envío aceptado → no marcar recordatorio.
 */
const TWILIO_STATUS_ACEPTABLE_TRAS_CREATE = new Set([
  'queued',
  'accepted',
  'scheduled',
  'sending',
  'sent',
  'delivered',
  'read',
  'receiving', // legado
]);

/**
 * Twilio suele lanzar RestException en fallos HTTP, pero a veces devuelve 201 con errorCode/status en el cuerpo.
 * Sin esto el backend marca "enviado" aunque la API indique rechazo o estado inválido.
 */
function assertTwilioMessageOk(message, contextLabel) {
  if (!message || typeof message !== 'object') {
    throw new Error(`Twilio [${contextLabel}]: respuesta inválida o vacía`);
  }
  const sid = message.sid;
  if (!sid || typeof sid !== 'string') {
    throw new Error(`Twilio [${contextLabel}]: respuesta sin Message SID`);
  }
  const statusRaw = message.status;
  const status = String(statusRaw ?? '').toLowerCase().trim();
  const code = message.errorCode ?? message.error_code;
  const msg = message.errorMessage ?? message.error_message ?? '';
  if (code != null && code !== '' && Number(code) !== 0) {
    const detail = msg ? `${msg}` : 'sin mensaje';
    throw new Error(`Twilio [${contextLabel}] código ${code}: ${detail} (sid=${sid})`);
  }
  if (TWILIO_STATUS_RECHAZADO.has(status)) {
    throw new Error(
      `Twilio [${contextLabel}] estado "${message.status}"${msg ? `: ${msg}` : ''} (sid=${sid})`
    );
  }
  if (status && !TWILIO_STATUS_ACEPTABLE_TRAS_CREATE.has(status)) {
    throw new Error(
      `Twilio [${contextLabel}] estado no aceptado "${message.status}" (sid=${sid})`
    );
  }
  logger.info(`Twilio [${contextLabel}] aceptado sid=${sid} status=${message.status || '?'}`);
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
  assertTwilioMessageOk(message, 'texto_plano');
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
  assertTwilioMessageOk(message, 'plantilla');
  return message;
}

/**
 * Enviar recordatorio de turno por WhatsApp.
 * - Si TWILIO_CONTENT_SID_RECORDATORIO está configurado → plantilla Content (ver TWILIO_RECORDATORIO_VARS).
 * - Si no → texto plano con links si hay API_PUBLIC_URL.
 *
 * TWILIO_RECORDATORIO_VARS=3 (plantillas solo con 3 placeholders en el cuerpo):
 *   {{1}} día, {{2}} hora, {{3}} profesional (+ especialidad).
 * TWILIO_RECORDATORIO_VARS=5 (plantilla CTA; botones con /turno/{{5}}/…):
 *   {{1}} nombre paciente, {{2}} nombre profesional, {{3}} especialidad, {{4}} fecha y hora, {{5}} UUID del turno.
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
  if (turno.recordatorio_whatsapp_permitido_admin === false) {
    logger.warn(`Recordatorio omitido (WhatsApp deshabilitado por administrador para el profesional) para turno ${turno.id}`);
    return null;
  }

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
  const { dia: fechaDia, hora: fechaHora } = separarDiaYHoraDesdeFormateado(fecha);
  const nombrePaciente = titleCase(`${turno.paciente_nombre || ''} ${turno.paciente_apellido || ''}`.trim());
  const nombreProfesional = titleCase(`${turno.profesional_nombre || ''} ${turno.profesional_apellido || ''}`.trim());
  const especialidad = turno.profesional_especialidad ? titleCase(turno.profesional_especialidad) : '';
  let profesionalParaPlantilla = especialidad
    ? `${nombreProfesional} - ${especialidad}`
    : nombreProfesional;
  profesionalParaPlantilla = profesionalParaPlantilla.trim() || 'Consultorio';

  const contentSid = process.env.TWILIO_CONTENT_SID_RECORDATORIO;
  const recordatorioVars = String(process.env.TWILIO_RECORDATORIO_VARS || '3').trim();

  if (contentSid) {
    if (recordatorioVars === '5') {
      const pac = nombrePaciente.trim() || 'Paciente';
      const prof = nombreProfesional.trim() || 'Profesional';
      const esp = especialidad.trim() || 'Consulta';
      const fechaTxt = fecha.trim() || '-';
      return enviarMensajePlantilla(telefono, contentSid, {
        '1': pac,
        '2': prof,
        '3': esp,
        '4': fechaTxt,
        '5': String(turno.id),
      });
    }
    return enviarMensajePlantilla(telefono, contentSid, {
      '1': fechaDia.trim() || '-',
      '2': fechaHora.trim() || '-',
      '3': profesionalParaPlantilla,
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

/** Parte el texto de formatearFechaHora en día y hora para plantillas tipo "dia {{1}} a las {{2}}". */
function separarDiaYHoraDesdeFormateado(formateado) {
  if (!formateado || formateado === '-') return { dia: '-', hora: '-' };
  const parts = String(formateado).split(' a las ');
  if (parts.length >= 2) return { dia: parts[0].trim(), hora: parts.slice(1).join(' a las ').trim() };
  return { dia: formateado, hora: '-' };
}

module.exports = { enviarMensaje, enviarRecordatorioTurno, normalizarTelefono };

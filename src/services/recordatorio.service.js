/**
 * RECORDATORIO.SERVICE.JS - Servicio de recordatorios automáticos de turnos por WhatsApp
 *
 * Lógica de reintentos:
 *  - Se reintenta hasta 3 veces (recordatorio_intentos < 3).
 *  - Si falla: incrementa recordatorio_intentos y guarda el error → en la próxima pasada lo reintenta.
 *  - Si tiene 3 intentos fallidos: ya no lo vuelve a intentar (queda registrado con el error).
 *  - Si tiene éxito: marca recordatorio_enviado = true.
 */

const turnoModel = require('../models/turno.model');
const { enviarRecordatorioTurno } = require('./whatsapp.service');
const logger = require('../utils/logger');

const MAX_INTENTOS = 3;

/**
 * Procesa todos los turnos que necesitan recordatorio y los envía por WhatsApp.
 * Incluye lógica de reintentos: reintenta hasta MAX_INTENTOS veces si falla.
 */
async function procesarRecordatorios() {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_WHATSAPP_FROM) {
    logger.warn('Recordatorios WhatsApp: variables de Twilio no configuradas, omitiendo.');
    return;
  }

  let turnos = [];
  try {
    turnos = await turnoModel.findParaRecordatorio();
  } catch (err) {
    logger.error('Recordatorios: error consultando turnos pendientes:', err.message);
    return;
  }

  if (turnos.length === 0) {
    logger.info('Recordatorios WhatsApp: sin turnos pendientes.');
    return;
  }

  const pendientes = turnos.filter(t => !t.recordatorio_enviado && (t.recordatorio_intentos ?? 0) < MAX_INTENTOS);
  const reintentando = pendientes.filter(t => (t.recordatorio_intentos ?? 0) > 0);

  logger.info(`Recordatorios WhatsApp: ${pendientes.length} turno(s) a procesar (${reintentando.length} reintentos).`);

  let enviados = 0;
  let fallidos = 0;

  for (const turno of pendientes) {
    const intento = (turno.recordatorio_intentos ?? 0) + 1;
    try {
      await enviarRecordatorioTurno(turno);
      await turnoModel.marcarRecordatorioEnviado(turno.id);
      logger.info(`[OK] Recordatorio enviado | turno ${turno.id} | intento ${intento}`);
      enviados++;
    } catch (err) {
      const errorMsg = err?.message || String(err);
      await turnoModel.marcarRecordatorioFallido(turno.id, errorMsg);
      if (intento >= MAX_INTENTOS) {
        logger.error(`[FALLO DEFINITIVO] Turno ${turno.id} alcanzó ${MAX_INTENTOS} intentos. Último error: ${errorMsg}`);
      } else {
        logger.warn(`[FALLO ${intento}/${MAX_INTENTOS}] Turno ${turno.id}: ${errorMsg}. Se reintentará.`);
      }
      fallidos++;
    }
  }

  logger.info(`Recordatorios WhatsApp: ${enviados} enviados, ${fallidos} fallidos.`);
}

module.exports = { procesarRecordatorios };

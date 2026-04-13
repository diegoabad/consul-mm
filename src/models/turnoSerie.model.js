/**
 * Modelo de series de turnos recurrentes (tabla turno_series)
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

function dateToUTCString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function timeFromDateUTC(d) {
  const date = d instanceof Date ? d : new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * @param {import('pg').PoolClient} [client]
 */
const create = async (data, client = null) => {
  const q = client ? client.query.bind(client) : query;
  try {
    const {
      profesional_id,
      paciente_id,
      frecuencia,
      mensual_modo = null,
      dia_semana = null,
      semana_del_mes = null,
      fecha_inicio_serie,
      fecha_fin = null,
      max_ocurrencias = null,
      creado_por = null
    } = data;

    const ini = fecha_inicio_serie instanceof Date ? fecha_inicio_serie : new Date(fecha_inicio_serie);
    const hora_inicio = timeFromDateUTC(ini);
    const finT = data.fecha_hora_fin_template
      ? new Date(data.fecha_hora_fin_template)
      : ini;
    const hora_fin = timeFromDateUTC(finT);

    const fechaIniStr = dateToUTCString(ini);
    const fechaFinStr = fecha_fin ? dateToUTCString(new Date(fecha_fin)) : null;

    const result = await q(
      `INSERT INTO turno_series (
        profesional_id, paciente_id, frecuencia, mensual_modo, dia_semana, semana_del_mes,
        hora_inicio, hora_fin, fecha_inicio_serie, fecha_fin, max_ocurrencias, creado_por
      ) VALUES ($1, $2, $3, $4, $5, $6, $7::time, $8::time, $9::timestamp, $10::timestamp, $11, $12)
      RETURNING *`,
      [
        profesional_id,
        paciente_id,
        frecuencia,
        mensual_modo,
        dia_semana,
        semana_del_mes,
        hora_inicio,
        hora_fin,
        fechaIniStr,
        fechaFinStr,
        max_ocurrencias,
        creado_por
      ]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create turno_serie:', error);
    throw error;
  }
};

const marcarTerminada = async (serieId, client = null) => {
  const q = client ? client.query.bind(client) : query;
  await q(`UPDATE turno_series SET terminada_en = NOW(), updated_at = NOW() WHERE id = $1`, [serieId]);
};

module.exports = {
  create,
  marcarTerminada,
  timeFromDateUTC
};

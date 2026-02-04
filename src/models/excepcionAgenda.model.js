/**
 * EXCEPCIONAGENDA.MODEL.JS - Modelo de excepciones de agenda
 *
 * Excepciones por fecha puntual: días en que el profesional atiende
 * además o en lugar de su agenda semanal.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las excepciones con filtros opcionales
 * @param {Object} filters - profesional_id, fecha_desde, fecha_hasta
 * @returns {Promise<Array>}
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        e.id, e.profesional_id, e.fecha, e.hora_inicio, e.hora_fin,
        e.duracion_turno_minutos, e.observaciones, e.fecha_creacion, e.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM excepciones_agenda e
      INNER JOIN profesionales p ON e.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.profesional_id) {
      sql += ` AND e.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    if (filters.fecha_desde) {
      sql += ` AND e.fecha >= $${paramIndex++}`;
      params.push(filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      sql += ` AND e.fecha <= $${paramIndex++}`;
      params.push(filters.fecha_hasta);
    }

    sql += ' ORDER BY e.fecha ASC, e.hora_inicio ASC';
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll excepciones_agenda:', error);
    throw error;
  }
};

/**
 * Buscar excepción por ID
 * @param {string} id - UUID
 * @returns {Promise<Object|null>}
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        e.id, e.profesional_id, e.fecha, e.hora_inicio, e.hora_fin,
        e.duracion_turno_minutos, e.observaciones, e.fecha_creacion, e.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM excepciones_agenda e
      INNER JOIN profesionales p ON e.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE e.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById excepciones_agenda:', error);
    throw error;
  }
};

/**
 * Excepciones de un profesional en un rango de fechas (para Turnos / frontend)
 * @param {string} profesionalId - UUID
 * @param {string} fechaDesde - YYYY-MM-DD
 * @param {string} fechaHasta - YYYY-MM-DD
 * @returns {Promise<Array>}
 */
const findByProfesionalAndDateRange = async (profesionalId, fechaDesde, fechaHasta) => {
  try {
    const result = await query(
      `SELECT id, profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones
       FROM excepciones_agenda
       WHERE profesional_id = $1 AND fecha >= $2 AND fecha <= $3
       ORDER BY fecha ASC, hora_inicio ASC`,
      [profesionalId, fechaDesde, fechaHasta]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesionalAndDateRange excepciones_agenda:', error);
    throw error;
  }
};

/**
 * Crear excepción
 * @param {Object} data - profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos?, observaciones?
 * @returns {Promise<Object>}
 */
const create = async (data) => {
  try {
    const {
      profesional_id,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos = 30,
      observaciones = null
    } = data;

    const result = await query(
      `INSERT INTO excepciones_agenda (
        profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones, fecha_creacion, fecha_actualizacion`,
      [profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create excepciones_agenda:', error);
    throw error;
  }
};

/**
 * Actualizar excepción
 * @param {string} id - UUID
 * @param {Object} data - fecha?, hora_inicio?, hora_fin?, duracion_turno_minutos?, observaciones?
 * @returns {Promise<Object|null>}
 */
const update = async (id, data) => {
  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;

    const allowed = ['fecha', 'hora_inicio', 'hora_fin', 'duracion_turno_minutos', 'observaciones'];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        updates.push(`${key} = $${paramIndex++}`);
        params.push(data[key]);
      }
    }
    if (updates.length === 0) return await findById(id);

    params.push(id);
    const result = await query(
      `UPDATE excepciones_agenda SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      params
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update excepciones_agenda:', error);
    throw error;
  }
};

/**
 * Eliminar excepción
 * @param {string} id - UUID
 * @returns {Promise<boolean>}
 */
const deleteById = async (id) => {
  try {
    const result = await query('DELETE FROM excepciones_agenda WHERE id = $1 RETURNING id', [id]);
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error en delete excepciones_agenda:', error);
    throw error;
  }
};

/** Convierte hora "HH:mm:ss" o "HH:mm" a minutos desde medianoche */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const part = String(timeStr).trim().substring(0, 5);
  const [h, m] = part.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Verificar si el profesional tiene una excepción (día puntual) que cubre esa fecha/hora.
 * Usado para permitir turnos en días habilitados puntualmente aunque no estén en la agenda semanal.
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaHora - Fecha y hora de inicio del turno
 * @returns {Promise<boolean>} true si hay al menos una excepción para ese día y esa hora dentro del rango
 */
const coversDateTime = async (profesionalId, fechaHora) => {
  try {
    const year = fechaHora.getFullYear();
    const month = String(fechaHora.getMonth() + 1).padStart(2, '0');
    const day = String(fechaHora.getDate()).padStart(2, '0');
    const fechaStr = `${year}-${month}-${day}`;
    const minutos = fechaHora.getHours() * 60 + fechaHora.getMinutes();

    const excepciones = await findByProfesionalAndDateRange(profesionalId, fechaStr, fechaStr);
    for (const ex of excepciones) {
      const inicioMin = timeToMinutes(ex.hora_inicio);
      const finMin = timeToMinutes(ex.hora_fin);
      if (minutos >= inicioMin && minutos < finMin) return true;
    }
    return false;
  } catch (error) {
    logger.error('Error en coversDateTime excepciones_agenda:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByProfesionalAndDateRange,
  create,
  update,
  delete: deleteById,
  coversDateTime
};

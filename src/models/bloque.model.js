/**
 * BLOQUE.MODEL.JS - Modelo de bloques no disponibles
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con los bloques de tiempo no disponibles (vacaciones, ausencias, etc).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todos los bloques no disponibles con filtros opcionales
 * @param {Object} filters - Filtros: profesional_id, fecha_inicio, fecha_fin
 * @returns {Promise<Array>} Lista de bloques no disponibles
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        b.id, b.profesional_id, b.fecha_hora_inicio, b.fecha_hora_fin,
        b.motivo, b.fecha_creacion, b.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM bloques_no_disponibles b
      INNER JOIN profesionales p ON b.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.profesional_id) {
      sql += ` AND b.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.fecha_inicio) {
      sql += ` AND b.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    }
    
    if (filters.fecha_fin) {
      sql += ` AND b.fecha_hora_fin <= $${paramIndex++}`;
      params.push(filters.fecha_fin);
    }
    
    sql += ' ORDER BY b.fecha_hora_inicio DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll bloques_no_disponibles:', error);
    throw error;
  }
};

/**
 * Buscar bloque no disponible por ID
 * @param {string} id - UUID del bloque
 * @returns {Promise<Object|null>} Bloque encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        b.id, b.profesional_id, b.fecha_hora_inicio, b.fecha_hora_fin,
        b.motivo, b.fecha_creacion, b.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM bloques_no_disponibles b
      INNER JOIN profesionales p ON b.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE b.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById bloque:', error);
    throw error;
  }
};

/**
 * Buscar bloques no disponibles por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaInicio - Fecha de inicio para filtrar (opcional)
 * @param {Date} fechaFin - Fecha de fin para filtrar (opcional)
 * @returns {Promise<Array>} Lista de bloques del profesional
 */
const findByProfesional = async (profesionalId, fechaInicio = null, fechaFin = null) => {
  try {
    let sql = `
      SELECT 
        b.id, b.profesional_id, b.fecha_hora_inicio, b.fecha_hora_fin,
        b.motivo, b.fecha_creacion, b.fecha_actualizacion
      FROM bloques_no_disponibles b
      WHERE b.profesional_id = $1
    `;
    const params = [profesionalId];
    let paramIndex = 2;
    
    if (fechaInicio) {
      sql += ` AND b.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      sql += ` AND b.fecha_hora_fin <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    sql += ' ORDER BY b.fecha_hora_inicio DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional bloque:', error);
    throw error;
  }
};

/**
 * Verificar si hay solapamiento de bloques
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaHoraInicio - Fecha y hora de inicio
 * @param {Date} fechaHoraFin - Fecha y hora de fin
 * @param {string} excludeId - UUID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si hay solapamiento
 */
const checkOverlap = async (profesionalId, fechaHoraInicio, fechaHoraFin, excludeId = null) => {
  try {
    let sql = `
      SELECT COUNT(*) as count
      FROM bloques_no_disponibles
      WHERE profesional_id = $1
        AND (
          (fecha_hora_inicio <= $2 AND fecha_hora_fin > $2)
          OR (fecha_hora_inicio < $3 AND fecha_hora_fin >= $3)
          OR (fecha_hora_inicio >= $2 AND fecha_hora_fin <= $3)
        )
    `;
    const params = [profesionalId, fechaHoraInicio, fechaHoraFin];
    
    if (excludeId) {
      sql += ` AND id != $${params.length + 1}`;
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error en checkOverlap bloque:', error);
    throw error;
  }
};

/**
 * Crear nuevo bloque no disponible
 * @param {Object} bloqueData - Datos del bloque
 * @returns {Promise<Object>} Bloque creado
 */
const create = async (bloqueData) => {
  try {
    const {
      profesional_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      motivo = null
    } = bloqueData;
    
    const result = await query(
      `INSERT INTO bloques_no_disponibles 
        (profesional_id, fecha_hora_inicio, fecha_hora_fin, motivo)
      VALUES ($1, $2, $3, $4)
      RETURNING *`,
      [profesional_id, fecha_hora_inicio, fecha_hora_fin, motivo]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create bloque:', error);
    throw error;
  }
};

/**
 * Actualizar bloque no disponible
 * @param {string} id - UUID del bloque
 * @param {Object} bloqueData - Datos a actualizar
 * @returns {Promise<Object>} Bloque actualizado
 */
const update = async (id, bloqueData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (bloqueData.fecha_hora_inicio !== undefined) {
      fields.push(`fecha_hora_inicio = $${paramIndex++}`);
      values.push(bloqueData.fecha_hora_inicio);
    }
    
    if (bloqueData.fecha_hora_fin !== undefined) {
      fields.push(`fecha_hora_fin = $${paramIndex++}`);
      values.push(bloqueData.fecha_hora_fin);
    }
    
    if (bloqueData.motivo !== undefined) {
      fields.push(`motivo = $${paramIndex++}`);
      values.push(bloqueData.motivo);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE bloques_no_disponibles
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update bloque:', error);
    throw error;
  }
};

/**
 * Eliminar bloque no disponible
 * @param {string} id - UUID del bloque
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteBloque = async (id) => {
  try {
    const result = await query(
      'DELETE FROM bloques_no_disponibles WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete bloque:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByProfesional,
  checkOverlap,
  create,
  update,
  delete: deleteBloque
};

/**
 * AGENDA.MODEL.JS - Modelo de configuración de agenda
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con la configuración de horarios de trabajo de los profesionales.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las configuraciones de agenda con filtros opcionales
 * @param {Object} filters - Filtros: profesional_id, dia_semana, activo
 * @returns {Promise<Array>} Lista de configuraciones de agenda
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM configuracion_agenda ca
      INNER JOIN profesionales p ON ca.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.profesional_id) {
      sql += ` AND ca.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.dia_semana !== undefined) {
      sql += ` AND ca.dia_semana = $${paramIndex++}`;
      params.push(filters.dia_semana);
    }
    
    if (filters.activo !== undefined) {
      sql += ` AND ca.activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    sql += ' ORDER BY ca.profesional_id, ca.dia_semana, ca.hora_inicio';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Buscar configuración de agenda por ID
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object|null>} Configuración encontrada o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM configuracion_agenda ca
      INNER JOIN profesionales p ON ca.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE ca.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Buscar configuraciones de agenda por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @param {boolean} soloActivos - Si true, solo retorna configuraciones activas
 * @returns {Promise<Array>} Lista de configuraciones de agenda del profesional
 */
const findByProfesional = async (profesionalId, soloActivos = false) => {
  try {
    let sql = `
      SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion
      FROM configuracion_agenda ca
      WHERE ca.profesional_id = $1
    `;
    const params = [profesionalId];
    
    if (soloActivos) {
      sql += ' AND ca.activo = $2';
      params.push(true);
    }
    
    sql += ' ORDER BY ca.dia_semana, ca.hora_inicio';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Verificar si existe una configuración duplicada
 * @param {string} profesionalId - UUID del profesional
 * @param {number} diaSemana - Día de la semana (0-6)
 * @param {string} horaInicio - Hora de inicio (TIME format)
 * @param {string} excludeId - UUID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe duplicado
 */
const checkDuplicate = async (profesionalId, diaSemana, horaInicio, excludeId = null) => {
  try {
    let sql = `
      SELECT COUNT(*) as count
      FROM configuracion_agenda
      WHERE profesional_id = $1 AND dia_semana = $2 AND hora_inicio = $3
    `;
    const params = [profesionalId, diaSemana, horaInicio];
    
    if (excludeId) {
      sql += ` AND id != $${params.length + 1}`;
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error en checkDuplicate configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Crear nueva configuración de agenda
 * @param {Object} agendaData - Datos de la configuración
 * @returns {Promise<Object>} Configuración creada
 */
const create = async (agendaData) => {
  try {
    const {
      profesional_id,
      dia_semana,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos = 30,
      activo = true
    } = agendaData;
    
    const result = await query(
      `INSERT INTO configuracion_agenda 
        (profesional_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, activo)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [profesional_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, activo]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Actualizar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @param {Object} agendaData - Datos a actualizar
 * @returns {Promise<Object>} Configuración actualizada
 */
const update = async (id, agendaData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (agendaData.dia_semana !== undefined) {
      fields.push(`dia_semana = $${paramIndex++}`);
      values.push(agendaData.dia_semana);
    }
    
    if (agendaData.hora_inicio !== undefined) {
      fields.push(`hora_inicio = $${paramIndex++}`);
      values.push(agendaData.hora_inicio);
    }
    
    if (agendaData.hora_fin !== undefined) {
      fields.push(`hora_fin = $${paramIndex++}`);
      values.push(agendaData.hora_fin);
    }
    
    if (agendaData.duracion_turno_minutos !== undefined) {
      fields.push(`duracion_turno_minutos = $${paramIndex++}`);
      values.push(agendaData.duracion_turno_minutos);
    }
    
    if (agendaData.activo !== undefined) {
      fields.push(`activo = $${paramIndex++}`);
      values.push(agendaData.activo);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE configuracion_agenda
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Eliminar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteAgenda = async (id) => {
  try {
    const result = await query(
      'DELETE FROM configuracion_agenda WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Activar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object>} Configuración actualizada
 */
const activate = async (id) => {
  try {
    const result = await query(
      'UPDATE configuracion_agenda SET activo = true WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en activate configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Desactivar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object>} Configuración actualizada
 */
const deactivate = async (id) => {
  try {
    const result = await query(
      'UPDATE configuracion_agenda SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en deactivate configuracion_agenda:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByProfesional,
  checkDuplicate,
  create,
  update,
  delete: deleteAgenda,
  activate,
  deactivate
};

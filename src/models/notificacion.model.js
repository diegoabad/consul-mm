/**
 * NOTIFICACION.MODEL.JS - Modelo de notificaciones por email
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con notificaciones enviadas por email.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las notificaciones con filtros opcionales
 * @param {Object} filters - Filtros: destinatario_email, tipo, estado, relacionado_tipo, relacionado_id
 * @returns {Promise<Array>} Lista de notificaciones
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        id, destinatario_email, asunto, contenido, tipo,
        estado, error_mensaje, relacionado_tipo, relacionado_id,
        fecha_envio, fecha_creacion, fecha_actualizacion
      FROM notificaciones_email
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.destinatario_email) {
      sql += ` AND destinatario_email = $${paramIndex++}`;
      params.push(filters.destinatario_email);
    }
    
    if (filters.tipo) {
      sql += ` AND tipo = $${paramIndex++}`;
      params.push(filters.tipo);
    }
    
    if (filters.estado) {
      sql += ` AND estado = $${paramIndex++}`;
      params.push(filters.estado);
    }
    
    if (filters.relacionado_tipo) {
      sql += ` AND relacionado_tipo = $${paramIndex++}`;
      params.push(filters.relacionado_tipo);
    }
    
    if (filters.relacionado_id) {
      sql += ` AND relacionado_id = $${paramIndex++}`;
      params.push(filters.relacionado_id);
    }
    
    sql += ' ORDER BY fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll notificaciones_email:', error);
    throw error;
  }
};

/**
 * Buscar notificación por ID
 * @param {string} id - UUID de la notificación
 * @returns {Promise<Object|null>} Notificación encontrada o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        id, destinatario_email, asunto, contenido, tipo,
        estado, error_mensaje, relacionado_tipo, relacionado_id,
        fecha_envio, fecha_creacion, fecha_actualizacion
      FROM notificaciones_email
      WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById notificación:', error);
    throw error;
  }
};

/**
 * Buscar notificaciones por email del destinatario
 * @param {string} email - Email del destinatario
 * @returns {Promise<Array>} Lista de notificaciones del destinatario
 */
const findByDestinatario = async (email) => {
  try {
    const result = await query(
      `SELECT 
        id, destinatario_email, asunto, contenido, tipo,
        estado, error_mensaje, relacionado_tipo, relacionado_id,
        fecha_envio, fecha_creacion, fecha_actualizacion
      FROM notificaciones_email
      WHERE destinatario_email = $1
      ORDER BY fecha_creacion DESC`,
      [email]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByDestinatario notificación:', error);
    throw error;
  }
};

/**
 * Buscar notificaciones por tipo
 * @param {string} tipo - Tipo de notificación
 * @returns {Promise<Array>} Lista de notificaciones del tipo
 */
const findByTipo = async (tipo) => {
  try {
    const result = await query(
      `SELECT 
        id, destinatario_email, asunto, contenido, tipo,
        estado, error_mensaje, relacionado_tipo, relacionado_id,
        fecha_envio, fecha_creacion, fecha_actualizacion
      FROM notificaciones_email
      WHERE tipo = $1
      ORDER BY fecha_creacion DESC`,
      [tipo]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByTipo notificación:', error);
    throw error;
  }
};

/**
 * Obtener notificaciones pendientes
 * @returns {Promise<Array>} Lista de notificaciones pendientes
 */
const getPending = async () => {
  try {
    const result = await query(
      `SELECT 
        id, destinatario_email, asunto, contenido, tipo,
        estado, error_mensaje, relacionado_tipo, relacionado_id,
        fecha_envio, fecha_creacion, fecha_actualizacion
      FROM notificaciones_email
      WHERE estado = 'pendiente'
      ORDER BY fecha_creacion ASC`,
      []
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en getPending notificaciones:', error);
    throw error;
  }
};

/**
 * Crear nueva notificación
 * @param {Object} notificacionData - Datos de la notificación
 * @returns {Promise<Object>} Notificación creada
 */
const create = async (notificacionData) => {
  try {
    const {
      destinatario_email,
      asunto,
      contenido,
      tipo,
      relacionado_tipo,
      relacionado_id
    } = notificacionData;
    
    const result = await query(
      `INSERT INTO notificaciones_email 
        (destinatario_email, asunto, contenido, tipo, relacionado_tipo, relacionado_id, estado)
      VALUES ($1, $2, $3, $4, $5, $6, 'pendiente')
      RETURNING *`,
      [
        destinatario_email,
        asunto,
        contenido,
        tipo || null,
        relacionado_tipo || null,
        relacionado_id || null
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create notificación:', error);
    throw error;
  }
};

/**
 * Actualizar notificación
 * @param {string} id - UUID de la notificación
 * @param {Object} notificacionData - Datos a actualizar
 * @returns {Promise<Object>} Notificación actualizada
 */
const update = async (id, notificacionData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (notificacionData.asunto !== undefined) {
      fields.push(`asunto = $${paramIndex++}`);
      values.push(notificacionData.asunto);
    }
    
    if (notificacionData.contenido !== undefined) {
      fields.push(`contenido = $${paramIndex++}`);
      values.push(notificacionData.contenido);
    }
    
    if (notificacionData.tipo !== undefined) {
      fields.push(`tipo = $${paramIndex++}`);
      values.push(notificacionData.tipo);
    }
    
    if (notificacionData.estado !== undefined) {
      fields.push(`estado = $${paramIndex++}`);
      values.push(notificacionData.estado);
    }
    
    if (notificacionData.error_mensaje !== undefined) {
      fields.push(`error_mensaje = $${paramIndex++}`);
      values.push(notificacionData.error_mensaje);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE notificaciones_email
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update notificación:', error);
    throw error;
  }
};

/**
 * Marcar notificación como enviada
 * @param {string} id - UUID de la notificación
 * @param {Date} fechaEnvio - Fecha de envío
 * @returns {Promise<Object>} Notificación actualizada
 */
const markAsSent = async (id, fechaEnvio) => {
  try {
    const result = await query(
      `UPDATE notificaciones_email
      SET estado = 'enviado', fecha_envio = $1, error_mensaje = NULL
      WHERE id = $2
      RETURNING *`,
      [fechaEnvio, id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en markAsSent notificación:', error);
    throw error;
  }
};

/**
 * Marcar notificación como fallida
 * @param {string} id - UUID de la notificación
 * @param {string} errorMensaje - Mensaje de error
 * @returns {Promise<Object>} Notificación actualizada
 */
const markAsFailed = async (id, errorMensaje) => {
  try {
    const result = await query(
      `UPDATE notificaciones_email
      SET estado = 'fallido', error_mensaje = $1
      WHERE id = $2
      RETURNING *`,
      [errorMensaje, id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en markAsFailed notificación:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByDestinatario,
  findByTipo,
  getPending,
  create,
  update,
  markAsSent,
  markAsFailed
};

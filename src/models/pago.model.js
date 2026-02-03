/**
 * PAGO.MODEL.JS - Modelo de pagos de profesionales
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con los pagos mensuales de profesionales.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { ESTADOS_PAGO } = require('../utils/constants');

/**
 * Buscar todos los pagos con filtros opcionales
 * @param {Object} filters - Filtros: profesional_id, estado, periodo_desde, periodo_hasta
 * @returns {Promise<Array>} Lista de pagos
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        p.id, p.profesional_id, p.periodo, p.monto, p.fecha_pago,
        p.estado, p.metodo_pago, p.comprobante_url, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        prof.matricula, prof.especialidad, prof.tipo_periodo_pago as profesional_tipo_periodo_pago,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_prof.email as profesional_email
      FROM pagos_profesionales p
      INNER JOIN profesionales prof ON p.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.profesional_id) {
      sql += ` AND p.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.estado) {
      sql += ` AND p.estado = $${paramIndex++}`;
      params.push(filters.estado);
    }
    
    if (filters.periodo_desde) {
      sql += ` AND p.periodo >= $${paramIndex++}`;
      params.push(filters.periodo_desde);
    }
    
    if (filters.periodo_hasta) {
      sql += ` AND p.periodo <= $${paramIndex++}`;
      params.push(filters.periodo_hasta);
    }
    
    sql += ' ORDER BY p.periodo DESC, p.fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll pagos_profesionales:', error);
    throw error;
  }
};

/**
 * Buscar pago por ID
 * @param {string} id - UUID del pago
 * @returns {Promise<Object|null>} Pago encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.profesional_id, p.periodo, p.monto, p.fecha_pago,
        p.estado, p.metodo_pago, p.comprobante_url, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        prof.matricula, prof.especialidad, prof.tipo_periodo_pago as profesional_tipo_periodo_pago,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_prof.email as profesional_email
      FROM pagos_profesionales p
      INNER JOIN profesionales prof ON p.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById pago:', error);
    throw error;
  }
};

/**
 * Buscar pagos por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @returns {Promise<Array>} Lista de pagos del profesional
 */
const findByProfesional = async (profesionalId) => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.profesional_id, p.periodo, p.monto, p.fecha_pago,
        p.estado, p.metodo_pago, p.comprobante_url, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion
      FROM pagos_profesionales p
      WHERE p.profesional_id = $1
      ORDER BY p.periodo DESC`,
      [profesionalId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional pago:', error);
    throw error;
  }
};

/**
 * Obtener pagos pendientes
 * @returns {Promise<Array>} Lista de pagos pendientes
 */
const getPending = async () => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.profesional_id, p.periodo, p.monto, p.fecha_pago,
        p.estado, p.metodo_pago, p.comprobante_url, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        prof.matricula, prof.especialidad, prof.tipo_periodo_pago as profesional_tipo_periodo_pago,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_prof.email as profesional_email
      FROM pagos_profesionales p
      INNER JOIN profesionales prof ON p.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE p.estado = $1
      ORDER BY p.periodo ASC`,
      [ESTADOS_PAGO.PENDIENTE]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en getPending pagos:', error);
    throw error;
  }
};

/**
 * Obtener pagos vencidos
 * @returns {Promise<Array>} Lista de pagos vencidos
 */
const getOverdue = async () => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.profesional_id, p.periodo, p.monto, p.fecha_pago,
        p.estado, p.metodo_pago, p.comprobante_url, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        prof.matricula, prof.especialidad, prof.tipo_periodo_pago as profesional_tipo_periodo_pago,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_prof.email as profesional_email
      FROM pagos_profesionales p
      INNER JOIN profesionales prof ON p.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE p.estado = $1
      ORDER BY p.periodo ASC`,
      [ESTADOS_PAGO.VENCIDO]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en getOverdue pagos:', error);
    throw error;
  }
};

/**
 * Crear nuevo pago
 * @param {Object} pagoData - Datos del pago
 * @returns {Promise<Object>} Pago creado
 */
const create = async (pagoData) => {
  try {
    const {
      profesional_id,
      periodo,
      monto,
      estado = ESTADOS_PAGO.PENDIENTE,
      metodo_pago,
      comprobante_url,
      observaciones
    } = pagoData;
    
    const result = await query(
      `INSERT INTO pagos_profesionales 
        (profesional_id, periodo, monto, estado, metodo_pago, comprobante_url, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [profesional_id, periodo, monto, estado, metodo_pago || null, comprobante_url || null, observaciones || null]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create pago:', error);
    throw error;
  }
};

/**
 * Actualizar pago
 * @param {string} id - UUID del pago
 * @param {Object} pagoData - Datos a actualizar
 * @returns {Promise<Object>} Pago actualizado
 */
const update = async (id, pagoData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (pagoData.monto !== undefined) {
      fields.push(`monto = $${paramIndex++}`);
      values.push(pagoData.monto);
    }
    
    if (pagoData.estado !== undefined) {
      fields.push(`estado = $${paramIndex++}`);
      values.push(pagoData.estado);
    }
    
    if (pagoData.metodo_pago !== undefined) {
      fields.push(`metodo_pago = $${paramIndex++}`);
      values.push(pagoData.metodo_pago);
    }
    
    if (pagoData.comprobante_url !== undefined) {
      fields.push(`comprobante_url = $${paramIndex++}`);
      values.push(pagoData.comprobante_url);
    }
    
    if (pagoData.observaciones !== undefined) {
      fields.push(`observaciones = $${paramIndex++}`);
      values.push(pagoData.observaciones);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE pagos_profesionales
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update pago:', error);
    throw error;
  }
};

/**
 * Marcar pago como pagado
 * @param {string} id - UUID del pago
 * @param {Date} fechaPago - Fecha del pago
 * @param {string} metodoPago - Método de pago
 * @param {string} comprobanteUrl - URL del comprobante
 * @returns {Promise<Object>} Pago actualizado
 */
const markAsPaid = async (id, fechaPago, metodoPago = null, comprobanteUrl = null) => {
  try {
    const result = await query(
      `UPDATE pagos_profesionales
      SET estado = $1, fecha_pago = $2, metodo_pago = $3, comprobante_url = $4
      WHERE id = $5
      RETURNING *`,
      [ESTADOS_PAGO.PAGADO, fechaPago, metodoPago, comprobanteUrl, id]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en markAsPaid pago:', error);
    throw error;
  }
};

/**
 * Verificar si existe un pago para un profesional y periodo
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} periodo - Periodo del pago
 * @returns {Promise<Object|null>} Pago existente o null
 */
const checkPaymentStatus = async (profesionalId, periodo) => {
  try {
    const result = await query(
      `SELECT * FROM pagos_profesionales
      WHERE profesional_id = $1 AND periodo = $2`,
      [profesionalId, periodo]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en checkPaymentStatus:', error);
    throw error;
  }
};

/**
 * Eliminar pago
 * @param {string} id - UUID del pago
 * @returns {Promise<boolean>}
 */
const deleteById = async (id) => {
  try {
    const result = await query(
      'DELETE FROM pagos_profesionales WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  } catch (error) {
    logger.error('Error en deleteById pago:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByProfesional,
  getPending,
  getOverdue,
  create,
  update,
  markAsPaid,
  checkPaymentStatus,
  deleteById
};

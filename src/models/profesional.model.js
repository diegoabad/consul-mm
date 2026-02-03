/**
 * PROFESIONAL.MODEL.JS - Modelo de profesionales médicos
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con profesionales médicos.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todos los profesionales con filtros opcionales
 * @param {Object} filters - Filtros: activo, bloqueado, especialidad, estado_pago
 * @returns {Promise<Array>} Lista de profesionales
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        p.id, p.usuario_id, p.matricula, p.especialidad, 
        p.estado_pago, p.bloqueado, p.razon_bloqueo, 
        p.fecha_ultimo_pago, p.fecha_inicio_contrato, p.monto_mensual, p.tipo_periodo_pago, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        u.email, u.nombre, u.apellido, u.telefono, u.rol, u.activo as usuario_activo
      FROM profesionales p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.activo !== undefined) {
      sql += ` AND u.activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    if (filters.bloqueado !== undefined) {
      sql += ` AND p.bloqueado = $${paramIndex++}`;
      params.push(filters.bloqueado);
    }
    
    if (filters.especialidad) {
      sql += ` AND p.especialidad ILIKE $${paramIndex++}`;
      params.push(`%${filters.especialidad}%`);
    }
    
    if (filters.estado_pago) {
      sql += ` AND p.estado_pago = $${paramIndex++}`;
      params.push(filters.estado_pago);
    }
    
    sql += ' ORDER BY p.fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll profesionales:', error);
    throw error;
  }
};

/**
 * Buscar profesional por ID
 * @param {string} id - UUID del profesional
 * @returns {Promise<Object|null>} Profesional encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.usuario_id, p.matricula, p.especialidad, 
        p.estado_pago, p.bloqueado, p.razon_bloqueo, 
        p.fecha_ultimo_pago, p.fecha_inicio_contrato, p.monto_mensual, p.tipo_periodo_pago, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        u.email, u.nombre, u.apellido, u.telefono, u.rol, u.activo as usuario_activo
      FROM profesionales p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById profesional:', error);
    throw error;
  }
};

/**
 * Buscar profesional por usuario_id
 * @param {string} usuarioId - UUID del usuario
 * @returns {Promise<Object|null>} Profesional encontrado o null
 */
const findByUserId = async (usuarioId) => {
  try {
    const result = await query(
      `SELECT 
        p.id, p.usuario_id, p.matricula, p.especialidad, 
        p.estado_pago, p.bloqueado, p.razon_bloqueo, 
        p.fecha_ultimo_pago, p.fecha_inicio_contrato, p.monto_mensual, p.tipo_periodo_pago, p.observaciones,
        p.fecha_creacion, p.fecha_actualizacion,
        u.email, u.nombre, u.apellido, u.telefono, u.rol, u.activo as usuario_activo
      FROM profesionales p
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE p.usuario_id = $1`,
      [usuarioId]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByUserId profesional:', error);
    throw error;
  }
};

/**
 * Crear nuevo profesional
 * @param {Object} profesionalData - Datos del profesional
 * @returns {Promise<Object>} Profesional creado
 */
const create = async (profesionalData) => {
  try {
    const {
      usuario_id,
      matricula,
      especialidad,
      estado_pago = 'al_dia',
      bloqueado = false,
      razon_bloqueo = null,
      fecha_ultimo_pago = null,
      fecha_inicio_contrato = null,
      monto_mensual = null,
      tipo_periodo_pago = 'mensual',
      observaciones = null
    } = profesionalData;
    
    const result = await query(
      `INSERT INTO profesionales (
        usuario_id, matricula, especialidad, estado_pago, 
        bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato,
        monto_mensual, tipo_periodo_pago, observaciones
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, usuario_id, matricula, especialidad, estado_pago, 
                bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato, monto_mensual, tipo_periodo_pago,
                observaciones, fecha_creacion, fecha_actualizacion`,
      [
        usuario_id, matricula, especialidad, estado_pago,
        bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato,
        monto_mensual, tipo_periodo_pago, observaciones
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create profesional:', error);
    throw error;
  }
};

/**
 * Actualizar profesional
 * @param {string} id - UUID del profesional
 * @param {Object} profesionalData - Datos a actualizar
 * @returns {Promise<Object>} Profesional actualizado
 */
const update = async (id, profesionalData) => {
  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    const allowedFields = [
      'matricula', 'especialidad', 'estado_pago', 'bloqueado',
      'razon_bloqueo', 'fecha_ultimo_pago', 'fecha_inicio_contrato', 'monto_mensual', 'tipo_periodo_pago', 'observaciones'
    ];
    
    for (const field of allowedFields) {
      if (profesionalData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(profesionalData[field]);
      }
    }
    
    if (updates.length === 0) {
      // Si no hay cambios, retornar el profesional actual
      return await findById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE profesionales 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, usuario_id, matricula, especialidad, estado_pago, 
                bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato, monto_mensual, tipo_periodo_pago,
                observaciones, fecha_creacion, fecha_actualizacion
    `;
    
    const result = await query(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update profesional:', error);
    throw error;
  }
};

/**
 * Eliminar profesional (soft delete - elimina el registro)
 * @param {string} id - UUID del profesional
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
const deleteProfesional = async (id) => {
  try {
    const result = await query(
      'DELETE FROM profesionales WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error en delete profesional:', error);
    throw error;
  }
};

/**
 * Bloquear profesional (por impago)
 * @param {string} id - UUID del profesional
 * @param {string} razon - Razón del bloqueo
 * @returns {Promise<Object>} Profesional actualizado
 */
const block = async (id, razon = null) => {
  try {
    const result = await query(
      `UPDATE profesionales 
       SET bloqueado = true, razon_bloqueo = $1
       WHERE id = $2
       RETURNING id, usuario_id, matricula, especialidad, estado_pago, 
                 bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato, monto_mensual, tipo_periodo_pago,
                 observaciones, fecha_creacion, fecha_actualizacion`,
      [razon, id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en block profesional:', error);
    throw error;
  }
};

/**
 * Desbloquear profesional
 * @param {string} id - UUID del profesional
 * @returns {Promise<Object>} Profesional actualizado
 */
const unblock = async (id) => {
  try {
    const result = await query(
      `UPDATE profesionales 
       SET bloqueado = false, razon_bloqueo = NULL
       WHERE id = $1
       RETURNING id, usuario_id, matricula, especialidad, estado_pago, 
                 bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato, monto_mensual, tipo_periodo_pago,
                 observaciones, fecha_creacion, fecha_actualizacion`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en unblock profesional:', error);
    throw error;
  }
};

/**
 * Actualizar fecha de último pago
 * @param {string} id - UUID del profesional
 * @param {Date} fecha - Fecha del último pago
 * @returns {Promise<Object>} Profesional actualizado
 */
const updateLastPayment = async (id, fecha) => {
  try {
    const result = await query(
      `UPDATE profesionales 
       SET fecha_ultimo_pago = $1, estado_pago = 'al_dia'
       WHERE id = $2
       RETURNING id, usuario_id, matricula, especialidad, estado_pago, 
                 bloqueado, razon_bloqueo, fecha_ultimo_pago, fecha_inicio_contrato, monto_mensual, tipo_periodo_pago,
                 observaciones, fecha_creacion, fecha_actualizacion`,
      [fecha, id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en updateLastPayment profesional:', error);
    throw error;
  }
};

/**
 * Obtener profesionales bloqueados
 * @returns {Promise<Array>} Lista de profesionales bloqueados
 */
const getBlocked = async () => {
  try {
    return await findAll({ bloqueado: true });
  } catch (error) {
    logger.error('Error en getBlocked profesionales:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByUserId,
  create,
  update,
  delete: deleteProfesional,
  block,
  unblock,
  updateLastPayment,
  getBlocked
};

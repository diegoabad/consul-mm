/**
 * LOG.MODEL.JS - Modelo de logs de errores (front y back)
 * Una sola tabla; columna origen distingue 'front' | 'back'.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Insertar un log (front o back)
 * @param {Object} data
 * @param {string} data.origen - 'front' | 'back'
 * @param {number} [data.usuario_id]
 * @param {string} [data.rol]
 * @param {string} [data.pantalla]
 * @param {string} [data.accion]
 * @param {string} [data.ruta]
 * @param {string} [data.metodo]
 * @param {string} [data.params] - JSON string o texto
 * @param {string} data.mensaje
 * @param {string} [data.stack]
 */
const create = async (data) => {
  try {
    const {
      origen,
      usuario_id = null,
      rol = null,
      pantalla = null,
      accion = null,
      ruta = null,
      metodo = null,
      params = null,
      mensaje,
      stack = null,
    } = data;

    const result = await query(
      `INSERT INTO logs (origen, usuario_id, rol, pantalla, accion, ruta, metodo, params, mensaje, stack)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, created_at, origen, usuario_id, rol, pantalla, accion, ruta, metodo, params, mensaje, stack`,
      [origen, usuario_id, rol, pantalla, accion, ruta, metodo, params, mensaje || '', stack]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en log.model create:', error);
    throw error;
  }
};

/**
 * Listar logs con filtros (solo admin)
 * @param {Object} filters - fecha_desde (YYYY-MM-DD), fecha_hasta, origen (front|back), limit, offset
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT l.id, l.created_at, l.origen, l.usuario_id, l.rol, l.pantalla, l.accion,
             l.ruta, l.metodo, l.params, l.mensaje, l.stack,
             u.email AS usuario_email
      FROM logs l
      LEFT JOIN usuarios u ON u.id = l.usuario_id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (filters.fecha_desde) {
      sql += ` AND l.created_at >= $${paramIndex++}::date`;
      params.push(filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      sql += ` AND l.created_at::date <= $${paramIndex++}::date`;
      params.push(filters.fecha_hasta);
    }
    if (filters.origen) {
      sql += ` AND l.origen = $${paramIndex++}`;
      params.push(filters.origen);
    }

    sql += ' ORDER BY l.created_at DESC';

    const limit = Math.min(parseInt(filters.limit, 10) || 100, 500);
    const offset = parseInt(filters.offset, 10) || 0;
    sql += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en log.model findAll:', error);
    throw error;
  }
};

/**
 * Contar total de logs con los mismos filtros (para paginación)
 */
const count = async (filters = {}) => {
  try {
    let sql = 'SELECT COUNT(*) AS total FROM logs l WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (filters.fecha_desde) {
      sql += ` AND l.created_at >= $${paramIndex++}::date`;
      params.push(filters.fecha_desde);
    }
    if (filters.fecha_hasta) {
      sql += ` AND l.created_at::date <= $${paramIndex++}::date`;
      params.push(filters.fecha_hasta);
    }
    if (filters.origen) {
      sql += ` AND l.origen = $${paramIndex++}`;
      params.push(filters.origen);
    }

    const result = await query(sql, params);
    return parseInt(result.rows[0].total, 10);
  } catch (error) {
    logger.error('Error en log.model count:', error);
    throw error;
  }
};

/**
 * Borrar todos los logs (solo admin)
 * @returns {number} Cantidad de filas eliminadas
 */
const deleteAll = async () => {
  try {
    const result = await query('DELETE FROM logs');
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Error en log.model deleteAll:', error);
    throw error;
  }
};

/**
 * Borrar un log por id (solo admin)
 * @param {number} id
 * @returns {number} 1 si se eliminó, 0 si no existía
 */
const deleteById = async (id) => {
  try {
    const result = await query('DELETE FROM logs WHERE id = $1', [id]);
    return result.rowCount || 0;
  } catch (error) {
    logger.error('Error en log.model deleteById:', error);
    throw error;
  }
};

module.exports = {
  create,
  findAll,
  count,
  deleteAll,
  deleteById,
};

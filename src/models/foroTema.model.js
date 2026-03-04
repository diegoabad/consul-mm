const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Listar temas activos con paginación (para profesionales)
 */
const findAllActivosPaginated = async (filters = {}) => {
  try {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 10));
    const offset = (page - 1) * limit;

    const countResult = await query(
      'SELECT COUNT(*)::int AS total FROM foro_tema WHERE activo = true'
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataResult = await query(
      `SELECT t.*, u.nombre as creador_nombre, u.apellido as creador_apellido
       FROM foro_tema t
       LEFT JOIN usuarios u ON t.creado_por = u.id
       WHERE t.activo = true
       ORDER BY t.orden ASC, t.fecha_creacion DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: dataResult.rows, total };
  } catch (error) {
    logger.error('Error en findAllActivosPaginated foro_tema:', error);
    throw error;
  }
};

/**
 * Listar temas activos (para profesionales, sin paginación - legacy)
 */
const findAllActivos = async () => {
  try {
    const result = await query(
      `SELECT t.*, u.nombre as creador_nombre, u.apellido as creador_apellido
       FROM foro_tema t
       LEFT JOIN usuarios u ON t.creado_por = u.id
       WHERE t.activo = true
       ORDER BY t.orden ASC, t.fecha_creacion DESC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findAllActivos foro_tema:', error);
    throw error;
  }
};

/**
 * Listar temas con paginación (admin)
 */
const findAllPaginated = async (filters = {}) => {
  try {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const includeInactive = filters.includeInactive === true || filters.includeInactive === 'true';

    const where = includeInactive ? '' : ' WHERE t.activo = true';
    const countSql = `SELECT COUNT(*)::int AS total FROM foro_tema t${where}`;
    const countResult = await query(countSql);
    const total = countResult.rows[0]?.total ?? 0;

    const dataResult = await query(
      `SELECT t.*, u.nombre as creador_nombre, u.apellido as creador_apellido
       FROM foro_tema t
       LEFT JOIN usuarios u ON t.creado_por = u.id
       ${where}
       ORDER BY t.orden ASC, t.fecha_creacion DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return { rows: dataResult.rows, total };
  } catch (error) {
    logger.error('Error en findAllPaginated foro_tema:', error);
    throw error;
  }
};

/**
 * Buscar tema por ID
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT t.*, u.nombre as creador_nombre, u.apellido as creador_apellido
       FROM foro_tema t
       LEFT JOIN usuarios u ON t.creado_por = u.id
       WHERE t.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById foro_tema:', error);
    throw error;
  }
};

/**
 * Crear tema
 */
const create = async (data) => {
  try {
    const { titulo, descripcion, imagen_url, creado_por, orden } = data;
    const result = await query(
      `INSERT INTO foro_tema (titulo, descripcion, imagen_url, creado_por, orden, activo)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING *`,
      [titulo, descripcion || null, imagen_url || null, creado_por, orden ?? 0]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create foro_tema:', error);
    throw error;
  }
};

/**
 * Actualizar tema
 */
const update = async (id, data) => {
  try {
    const { titulo, descripcion, imagen_url, activo, orden } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (titulo !== undefined) { updates.push(`titulo = $${paramCount++}`); values.push(titulo); }
    if (descripcion !== undefined) { updates.push(`descripcion = $${paramCount++}`); values.push(descripcion); }
    if (imagen_url !== undefined) { updates.push(`imagen_url = $${paramCount++}`); values.push(imagen_url); }
    if (activo !== undefined) { updates.push(`activo = $${paramCount++}`); values.push(activo); }
    if (orden !== undefined) { updates.push(`orden = $${paramCount++}`); values.push(orden); }

    if (updates.length === 0) return await findById(id);

    values.push(id);
    const result = await query(
      `UPDATE foro_tema SET ${updates.join(', ')}, fecha_actualizacion = NOW() WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update foro_tema:', error);
    throw error;
  }
};

/**
 * Eliminar tema
 */
const deleteById = async (id) => {
  try {
    await query('DELETE FROM foro_tema WHERE id = $1', [id]);
    return true;
  } catch (error) {
    logger.error('Error en delete foro_tema:', error);
    throw error;
  }
};

module.exports = {
  findAllActivos,
  findAllActivosPaginated,
  findAllPaginated,
  findById,
  create,
  update,
  deleteById,
};

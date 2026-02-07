const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Obtener todas las especialidades activas
 */
const findAll = async () => {
  try {
    const result = await query(
      'SELECT * FROM especialidades WHERE activo = true ORDER BY nombre ASC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll especialidades:', error);
    throw error;
  }
};

/**
 * Obtener todas las especialidades (incluyendo inactivas)
 */
const findAllIncludingInactive = async () => {
  try {
    const result = await query(
      'SELECT * FROM especialidades ORDER BY nombre ASC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findAllIncludingInactive especialidades:', error);
    throw error;
  }
};

/**
 * Listar especialidades con paginación y filtros
 * @param {Object} filters - { page, limit, includeInactive, q }
 * @returns {Promise<{ rows: Array, total: number }>}
 */
const findAllPaginated = async (filters = {}) => {
  try {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 10));
    const offset = (page - 1) * limit;
    const includeInactive = filters.includeInactive === true || filters.includeInactive === 'true';
    const q = (filters.q && String(filters.q).trim()) || '';

    let where = includeInactive ? ' WHERE 1=1' : ' WHERE activo = true';
    const countParams = [];
    const dataParams = [];
    let paramIndex = 1;

    if (q) {
      where += ` AND nombre ILIKE $${paramIndex}`;
      countParams.push(`%${q}%`);
      dataParams.push(`%${q}%`);
      paramIndex += 1;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int AS total FROM especialidades ${where}`,
      countParams
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataParamsFinal = [...dataParams, limit, offset];
    const limitIdx = dataParams.length + 1;
    const offsetIdx = dataParams.length + 2;
    const dataResult = await query(
      `SELECT * FROM especialidades ${where} ORDER BY nombre ASC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      dataParamsFinal
    );
    return { rows: dataResult.rows, total };
  } catch (error) {
    logger.error('Error en findAllPaginated especialidades:', error);
    throw error;
  }
};

/**
 * Buscar especialidad por ID
 */
const findById = async (id) => {
  try {
    const result = await query(
      'SELECT * FROM especialidades WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById especialidad:', error);
    throw error;
  }
};

/**
 * Buscar especialidad por nombre
 */
const findByName = async (nombre) => {
  try {
    const result = await query(
      'SELECT * FROM especialidades WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByName especialidad:', error);
    throw error;
  }
};

/**
 * Crear nueva especialidad
 */
const create = async (data) => {
  try {
    const { nombre, descripcion } = data;
    const result = await query(
      `INSERT INTO especialidades (nombre, descripcion, activo)
       VALUES ($1, $2, true)
       RETURNING *`,
      [nombre, descripcion || null]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create especialidad:', error);
    throw error;
  }
};

/**
 * Actualizar especialidad
 */
const update = async (id, data) => {
  try {
    const { nombre, descripcion, activo } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramCount++}`);
      values.push(nombre);
    }
    if (descripcion !== undefined) {
      updates.push(`descripcion = $${paramCount++}`);
      values.push(descripcion);
    }
    if (activo !== undefined) {
      updates.push(`activo = $${paramCount++}`);
      values.push(activo);
    }

    if (updates.length === 0) {
      return await findById(id);
    }

    values.push(id);
    const result = await query(
      `UPDATE especialidades 
       SET ${updates.join(', ')}, fecha_actualizacion = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update especialidad:', error);
    throw error;
  }
};

/**
 * Desactivar especialidad (soft delete)
 */
const deactivate = async (id) => {
  try {
    const result = await query(
      'UPDATE especialidades SET activo = false, fecha_actualizacion = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en deactivate especialidad:', error);
    throw error;
  }
};

/**
 * Contar profesionales que tienen esta especialidad (por nombre)
 */
const countProfesionalesByNombre = async (nombre) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM profesionales 
       WHERE TRIM(LOWER(COALESCE(especialidad, ''))) = TRIM(LOWER($1))`,
      [nombre || '']
    );
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    logger.error('Error en countProfesionalesByNombre especialidad:', error);
    throw error;
  }
};

/**
 * Eliminar especialidad (hard delete - borra el registro)
 */
const deleteById = async (id) => {
  try {
    await query('DELETE FROM especialidades WHERE id = $1', [id]);
    return true;
  } catch (error) {
    logger.error('Error en delete especialidad:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findAllIncludingInactive,
  findAllPaginated,
  findById,
  findByName,
  create,
  update,
  deactivate,
  deleteById,
  countProfesionalesByNombre,
};

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Obtener todas las obras sociales activas
 */
const findAll = async () => {
  try {
    const result = await query(
      'SELECT * FROM obras_sociales WHERE activo = true ORDER BY nombre ASC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll obras_sociales:', error);
    throw error;
  }
};

/**
 * Obtener todas las obras sociales (incluyendo inactivas)
 */
const findAllIncludingInactive = async () => {
  try {
    const result = await query(
      'SELECT * FROM obras_sociales ORDER BY nombre ASC'
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findAllIncludingInactive obras_sociales:', error);
    throw error;
  }
};

/**
 * Buscar obra social por ID
 */
const findById = async (id) => {
  try {
    const result = await query(
      'SELECT * FROM obras_sociales WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById obra_social:', error);
    throw error;
  }
};

/**
 * Buscar obra social por nombre
 */
const findByName = async (nombre) => {
  try {
    const result = await query(
      'SELECT * FROM obras_sociales WHERE LOWER(nombre) = LOWER($1)',
      [nombre]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByName obra_social:', error);
    throw error;
  }
};

/**
 * Crear nueva obra social
 */
const create = async (data) => {
  try {
    const { nombre, codigo, descripcion } = data;
    const result = await query(
      `INSERT INTO obras_sociales (nombre, codigo, descripcion, activo)
       VALUES ($1, $2, $3, true)
       RETURNING *`,
      [nombre, codigo || null, descripcion || null]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create obra_social:', error);
    throw error;
  }
};

/**
 * Actualizar obra social
 */
const update = async (id, data) => {
  try {
    const { nombre, codigo, descripcion, activo } = data;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (nombre !== undefined) {
      updates.push(`nombre = $${paramCount++}`);
      values.push(nombre);
    }
    if (codigo !== undefined) {
      updates.push(`codigo = $${paramCount++}`);
      values.push(codigo);
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
      `UPDATE obras_sociales 
       SET ${updates.join(', ')}, fecha_actualizacion = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update obra_social:', error);
    throw error;
  }
};

/**
 * Desactivar obra social (soft delete)
 */
const deactivate = async (id) => {
  try {
    const result = await query(
      'UPDATE obras_sociales SET activo = false, fecha_actualizacion = NOW() WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en deactivate obra_social:', error);
    throw error;
  }
};

/**
 * Contar pacientes que tienen esta obra social (por nombre)
 */
const countPacientesByNombre = async (nombre) => {
  try {
    const result = await query(
      `SELECT COUNT(*)::int AS count FROM pacientes 
       WHERE TRIM(LOWER(COALESCE(obra_social, ''))) = TRIM(LOWER($1))`,
      [nombre || '']
    );
    return result.rows[0]?.count ?? 0;
  } catch (error) {
    logger.error('Error en countPacientesByNombre obra_social:', error);
    throw error;
  }
};

/**
 * Eliminar obra social (hard delete - borra el registro)
 */
const deleteById = async (id) => {
  try {
    await query('DELETE FROM obras_sociales WHERE id = $1', [id]);
    return true;
  } catch (error) {
    logger.error('Error en delete obra_social:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findAllIncludingInactive,
  findById,
  findByName,
  create,
  update,
  deactivate,
  deleteById,
  countPacientesByNombre,
};

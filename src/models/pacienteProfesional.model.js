/**
 * PACIENTEPROFESIONAL.MODEL.JS - Asignación paciente-profesional
 * Un paciente puede tener varios profesionales asignados; el profesional solo ve pacientes asignados.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Listar asignaciones con filtros
 * @param {Object} filters - paciente_id, profesional_id
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT pp.id, pp.paciente_id, pp.profesional_id, pp.asignado_por_usuario_id, pp.fecha_asignacion,
             p.nombre as paciente_nombre, p.apellido as paciente_apellido,
             u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
             prof.especialidad as profesional_especialidad
      FROM paciente_profesional pp
      INNER JOIN pacientes p ON pp.paciente_id = p.id
      INNER JOIN profesionales prof ON pp.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE 1=1
    `;
    const params = [];
    let i = 1;
    if (filters.paciente_id) {
      sql += ` AND pp.paciente_id = $${i++}`;
      params.push(filters.paciente_id);
    }
    if (filters.profesional_id) {
      sql += ` AND pp.profesional_id = $${i++}`;
      params.push(filters.profesional_id);
    }
    sql += ' ORDER BY pp.fecha_asignacion DESC';
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll paciente_profesional:', error);
    throw error;
  }
};

/**
 * IDs de pacientes asignados a un profesional
 * @param {string} profesionalId - UUID del profesional
 * @returns {Promise<string[]>} Array de paciente_id
 */
const getPacienteIdsByProfesional = async (profesionalId) => {
  try {
    const result = await query(
      'SELECT paciente_id FROM paciente_profesional WHERE profesional_id = $1',
      [profesionalId]
    );
    return result.rows.map((r) => r.paciente_id);
  } catch (error) {
    logger.error('Error en getPacienteIdsByProfesional:', error);
    throw error;
  }
};

/**
 * Asignar un profesional a un paciente
 */
const create = async ({ paciente_id, profesional_id, asignado_por_usuario_id = null }) => {
  try {
    const result = await query(
      `INSERT INTO paciente_profesional (paciente_id, profesional_id, asignado_por_usuario_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (paciente_id, profesional_id) DO NOTHING
       RETURNING id, paciente_id, profesional_id, asignado_por_usuario_id, fecha_asignacion`,
      [paciente_id, profesional_id, asignado_por_usuario_id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en create paciente_profesional:', error);
    throw error;
  }
};

/**
 * Quitar asignación de un profesional a un paciente
 */
const remove = async (paciente_id, profesional_id) => {
  try {
    const result = await query(
      'DELETE FROM paciente_profesional WHERE paciente_id = $1 AND profesional_id = $2 RETURNING id',
      [paciente_id, profesional_id]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error en remove paciente_profesional:', error);
    throw error;
  }
};

/**
 * Reemplazar todas las asignaciones de un paciente en una sola operación
 * @param {string} paciente_id - UUID del paciente
 * @param {string[]} profesionalIds - Array de UUIDs de profesionales (puede ser vacío)
 * @param {string|null} asignado_por_usuario_id - UUID del usuario que realiza la acción
 * @returns {Promise<Object[]>} Lista de asignaciones actualizada (con joins)
 */
const replaceAll = async (paciente_id, profesionalIds, asignado_por_usuario_id = null) => {
  try {
    await query('DELETE FROM paciente_profesional WHERE paciente_id = $1', [paciente_id]);
    if (profesionalIds.length === 0) {
      return [];
    }
    const values = [];
    const placeholders = [];
    let i = 1;
    profesionalIds.forEach((profId) => {
      placeholders.push(`($${i++}, $${i++}, $${i++})`);
      values.push(paciente_id, profId, asignado_por_usuario_id);
    });
    await query(
      `INSERT INTO paciente_profesional (paciente_id, profesional_id, asignado_por_usuario_id)
       VALUES ${placeholders.join(', ')}
       ON CONFLICT (paciente_id, profesional_id) DO NOTHING`,
      values
    );
    return findAll({ paciente_id });
  } catch (error) {
    logger.error('Error en replaceAll paciente_profesional:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  getPacienteIdsByProfesional,
  create,
  remove,
  replaceAll,
};

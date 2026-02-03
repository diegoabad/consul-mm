/**
 * NOTA.MODEL.JS - Modelo de notas de paciente
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con notas administrativas sobre pacientes.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las notas con filtros opcionales
 * @param {Object} filters - Filtros: paciente_id, usuario_id
 * @returns {Promise<Array>} Lista de notas
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        n.id, n.paciente_id, n.usuario_id, n.contenido,
        n.fecha_creacion, n.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        u.nombre as usuario_nombre, u.apellido as usuario_apellido,
        prof.especialidad
      FROM notas_paciente n
      INNER JOIN pacientes p ON n.paciente_id = p.id
      INNER JOIN usuarios u ON n.usuario_id = u.id
      LEFT JOIN profesionales prof ON prof.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.paciente_id) {
      sql += ` AND n.paciente_id = $${paramIndex++}`;
      params.push(filters.paciente_id);
    }
    
    if (filters.usuario_id) {
      sql += ` AND n.usuario_id = $${paramIndex++}`;
      params.push(filters.usuario_id);
    }
    
    sql += ' ORDER BY n.fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll notas_paciente:', error);
    throw error;
  }
};

/**
 * Buscar nota por ID
 * @param {string} id - UUID de la nota
 * @returns {Promise<Object|null>} Nota encontrada o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        n.id, n.paciente_id, n.usuario_id, n.contenido,
        n.fecha_creacion, n.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        u.nombre as usuario_nombre, u.apellido as usuario_apellido,
        prof.especialidad
      FROM notas_paciente n
      INNER JOIN pacientes p ON n.paciente_id = p.id
      INNER JOIN usuarios u ON n.usuario_id = u.id
      LEFT JOIN profesionales prof ON prof.usuario_id = u.id
      WHERE n.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById nota:', error);
    throw error;
  }
};

/**
 * Buscar notas por paciente_id
 * @param {string} pacienteId - UUID del paciente
 * @returns {Promise<Array>} Lista de notas del paciente
 */
const findByPaciente = async (pacienteId) => {
  try {
    const result = await query(
      `SELECT 
        n.id, n.paciente_id, n.usuario_id, n.contenido,
        n.fecha_creacion, n.fecha_actualizacion,
        u.nombre as usuario_nombre, u.apellido as usuario_apellido,
        prof.especialidad
      FROM notas_paciente n
      INNER JOIN usuarios u ON n.usuario_id = u.id
      LEFT JOIN profesionales prof ON prof.usuario_id = u.id
      WHERE n.paciente_id = $1
      ORDER BY n.fecha_creacion DESC`,
      [pacienteId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByPaciente nota:', error);
    throw error;
  }
};

/**
 * Buscar notas por usuario_id
 * @param {string} usuarioId - UUID del usuario
 * @returns {Promise<Array>} Lista de notas del usuario
 */
const findByUsuario = async (usuarioId) => {
  try {
    const result = await query(
      `SELECT 
        n.id, n.paciente_id, n.usuario_id, n.contenido,
        n.fecha_creacion, n.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
      FROM notas_paciente n
      INNER JOIN pacientes p ON n.paciente_id = p.id
      WHERE n.usuario_id = $1
      ORDER BY n.fecha_creacion DESC`,
      [usuarioId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByUsuario nota:', error);
    throw error;
  }
};

/**
 * Crear nueva nota
 * @param {Object} notaData - Datos de la nota
 * @returns {Promise<Object>} Nota creada
 */
const create = async (notaData) => {
  try {
    const {
      paciente_id,
      usuario_id,
      contenido
    } = notaData;
    
    const result = await query(
      `INSERT INTO notas_paciente 
        (paciente_id, usuario_id, contenido)
      VALUES ($1, $2, $3)
      RETURNING *`,
      [paciente_id, usuario_id, contenido]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create nota:', error);
    throw error;
  }
};

/**
 * Actualizar nota
 * @param {string} id - UUID de la nota
 * @param {Object} notaData - Datos a actualizar
 * @returns {Promise<Object>} Nota actualizada
 */
const update = async (id, notaData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (notaData.contenido !== undefined) {
      fields.push(`contenido = $${paramIndex++}`);
      values.push(notaData.contenido);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE notas_paciente
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update nota:', error);
    throw error;
  }
};

/**
 * Eliminar nota
 * @param {string} id - UUID de la nota
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteNota = async (id) => {
  try {
    const result = await query(
      'DELETE FROM notas_paciente WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete nota:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByPaciente,
  findByUsuario,
  create,
  update,
  delete: deleteNota
};

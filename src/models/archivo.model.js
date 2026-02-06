/**
 * ARCHIVO.MODEL.JS - Modelo de archivos de paciente
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con archivos adjuntos de pacientes (estudios, imágenes, etc).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todos los archivos con filtros opcionales
 * @param {Object} filters - Filtros: paciente_id, profesional_id
 * @returns {Promise<Array>} Lista de archivos
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        a.id, a.paciente_id, a.profesional_id, a.usuario_id, a.nombre_archivo, a.tipo_archivo,
        a.url_archivo, a.tamanio_bytes, a.descripcion, a.fecha_subida, a.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        prof.matricula, prof.especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_subido.nombre as usuario_subido_nombre, u_subido.apellido as usuario_subido_apellido
      FROM archivos_paciente a
      INNER JOIN pacientes p ON a.paciente_id = p.id
      INNER JOIN usuarios u_subido ON a.usuario_id = u_subido.id
      LEFT JOIN profesionales prof ON a.profesional_id = prof.id
      LEFT JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.paciente_id) {
      sql += ` AND a.paciente_id = $${paramIndex++}`;
      params.push(filters.paciente_id);
    }
    
    if (filters.profesional_id) {
      sql += ` AND a.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    sql += ' ORDER BY a.fecha_subida DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll archivos_paciente:', error);
    throw error;
  }
};

/**
 * Buscar archivo por ID
 * @param {string} id - UUID del archivo
 * @returns {Promise<Object|null>} Archivo encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        a.id, a.paciente_id, a.profesional_id, a.usuario_id, a.nombre_archivo, a.tipo_archivo,
        a.url_archivo, a.tamanio_bytes, a.descripcion, a.fecha_subida, a.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        prof.matricula, prof.especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_subido.nombre as usuario_subido_nombre, u_subido.apellido as usuario_subido_apellido
      FROM archivos_paciente a
      INNER JOIN pacientes p ON a.paciente_id = p.id
      INNER JOIN usuarios u_subido ON a.usuario_id = u_subido.id
      LEFT JOIN profesionales prof ON a.profesional_id = prof.id
      LEFT JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById archivo:', error);
    throw error;
  }
};

/**
 * Buscar archivos por paciente_id
 * @param {string} pacienteId - UUID del paciente
 * @returns {Promise<Array>} Lista de archivos del paciente
 */
const findByPaciente = async (pacienteId) => {
  try {
    const result = await query(
      `SELECT 
        a.id, a.paciente_id, a.profesional_id, a.usuario_id, a.nombre_archivo, a.tipo_archivo,
        a.url_archivo, a.tamanio_bytes, a.descripcion, a.fecha_subida, a.fecha_actualizacion,
        prof.matricula, prof.especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        u_subido.nombre as usuario_subido_nombre, u_subido.apellido as usuario_subido_apellido
      FROM archivos_paciente a
      INNER JOIN usuarios u_subido ON a.usuario_id = u_subido.id
      LEFT JOIN profesionales prof ON a.profesional_id = prof.id
      LEFT JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      WHERE a.paciente_id = $1
      ORDER BY a.fecha_subida DESC`,
      [pacienteId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByPaciente archivo:', error);
    throw error;
  }
};

/**
 * Buscar archivos por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @returns {Promise<Array>} Lista de archivos del profesional
 */
const findByProfesional = async (profesionalId) => {
  try {
    const result = await query(
      `SELECT 
        a.id, a.paciente_id, a.profesional_id, a.nombre_archivo, a.tipo_archivo,
        a.url_archivo, a.tamanio_bytes, a.descripcion, a.fecha_subida, a.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
      FROM archivos_paciente a
      INNER JOIN pacientes p ON a.paciente_id = p.id
      WHERE a.profesional_id = $1
      ORDER BY a.fecha_subida DESC`,
      [profesionalId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional archivo:', error);
    throw error;
  }
};

/**
 * Crear nuevo archivo
 * @param {Object} archivoData - Datos del archivo
 * @returns {Promise<Object>} Archivo creado
 */
const create = async (archivoData) => {
  try {
    const {
      paciente_id,
      usuario_id,
      profesional_id = null,
      nombre_archivo,
      tipo_archivo = null,
      url_archivo,
      tamanio_bytes = null,
      descripcion = null
    } = archivoData;
    
    const result = await query(
      `INSERT INTO archivos_paciente 
        (paciente_id, usuario_id, profesional_id, nombre_archivo, tipo_archivo, url_archivo, tamanio_bytes, descripcion)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [paciente_id, usuario_id, profesional_id, nombre_archivo, tipo_archivo, url_archivo, tamanio_bytes, descripcion]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create archivo:', error);
    throw error;
  }
};

/**
 * Actualizar archivo
 * @param {string} id - UUID del archivo
 * @param {Object} archivoData - Datos a actualizar
 * @returns {Promise<Object>} Archivo actualizado
 */
const update = async (id, archivoData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (archivoData.nombre_archivo !== undefined) {
      fields.push(`nombre_archivo = $${paramIndex++}`);
      values.push(archivoData.nombre_archivo);
    }
    
    if (archivoData.tipo_archivo !== undefined) {
      fields.push(`tipo_archivo = $${paramIndex++}`);
      values.push(archivoData.tipo_archivo);
    }
    
    if (archivoData.url_archivo !== undefined) {
      fields.push(`url_archivo = $${paramIndex++}`);
      values.push(archivoData.url_archivo);
    }
    
    if (archivoData.tamanio_bytes !== undefined) {
      fields.push(`tamanio_bytes = $${paramIndex++}`);
      values.push(archivoData.tamanio_bytes);
    }
    
    if (archivoData.descripcion !== undefined) {
      fields.push(`descripcion = $${paramIndex++}`);
      values.push(archivoData.descripcion);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE archivos_paciente
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update archivo:', error);
    throw error;
  }
};

/**
 * Eliminar archivo
 * @param {string} id - UUID del archivo
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteArchivo = async (id) => {
  try {
    const result = await query(
      'DELETE FROM archivos_paciente WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete archivo:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByPaciente,
  findByProfesional,
  create,
  update,
  delete: deleteArchivo
};

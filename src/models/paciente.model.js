/**
 * PACIENTE.MODEL.JS - Modelo de pacientes
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con pacientes.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todos los pacientes con filtros opcionales
 * @param {Object} filters - Filtros: activo, obra_social
 * @returns {Promise<Array>} Lista de pacientes
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.activo !== undefined) {
      sql += ` AND activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    if (filters.obra_social) {
      sql += ` AND obra_social ILIKE $${paramIndex++}`;
      params.push(`%${filters.obra_social}%`);
    }
    
    if (filters.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
      sql += ` AND id = ANY($${paramIndex++})`;
      params.push(filters.ids);
    }
    
    sql += ' ORDER BY fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll pacientes:', error);
    throw error;
  }
};

/**
 * Buscar paciente por ID
 * @param {string} id - UUID del paciente
 * @returns {Promise<Object|null>} Paciente encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes
      WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById paciente:', error);
    throw error;
  }
};

/**
 * Buscar paciente por DNI
 * @param {string} dni - DNI del paciente
 * @returns {Promise<Object|null>} Paciente encontrado o null
 */
const findByDni = async (dni) => {
  try {
    const result = await query(
      `SELECT 
        id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes
      WHERE dni = $1`,
      [dni]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByDni paciente:', error);
    throw error;
  }
};

/**
 * Búsqueda por nombre, apellido o DNI
 * @param {string} searchTerm - Término de búsqueda
 * @returns {Promise<Array>} Lista de pacientes encontrados
 */
const search = async (searchTerm) => {
  try {
    const term = `%${searchTerm}%`;
    const result = await query(
      `SELECT 
        id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes
      WHERE 
        nombre ILIKE $1 OR 
        apellido ILIKE $1 OR 
        dni ILIKE $1
      ORDER BY nombre, apellido
      LIMIT 50`,
      [term]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en search pacientes:', error);
    throw error;
  }
};

/**
 * Crear nuevo paciente
 * @param {Object} pacienteData - Datos del paciente
 * @returns {Promise<Object>} Paciente creado
 */
const create = async (pacienteData) => {
  try {
    const {
      dni,
      nombre,
      apellido,
      fecha_nacimiento,
      telefono,
      email,
      direccion,
      obra_social,
      numero_afiliado,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono,
      activo = true
    } = pacienteData;
    
    const result = await query(
      `INSERT INTO pacientes (
        dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
                direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
                contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion`,
      [
        dni, nombre, apellido, fecha_nacimiento || null, telefono || null,
        email || null, direccion || null, obra_social || null, numero_afiliado || null,
        contacto_emergencia_nombre || null, contacto_emergencia_telefono || null, activo
      ]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create paciente:', error);
    throw error;
  }
};

/**
 * Actualizar paciente
 * @param {string} id - UUID del paciente
 * @param {Object} pacienteData - Datos a actualizar
 * @returns {Promise<Object>} Paciente actualizado
 */
const update = async (id, pacienteData) => {
  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    const allowedFields = [
      'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'email',
      'direccion', 'obra_social', 'numero_afiliado', 'contacto_emergencia_nombre',
      'contacto_emergencia_telefono', 'activo'
    ];
    
    for (const field of allowedFields) {
      if (pacienteData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(pacienteData[field]);
      }
    }
    
    if (updates.length === 0) {
      // Si no hay cambios, retornar el paciente actual
      return await findById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE pacientes 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
                direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
                contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion
    `;
    
    const result = await query(sql, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update paciente:', error);
    throw error;
  }
};

/**
 * Eliminar paciente (hard delete - eliminar permanentemente)
 * @param {string} id - UUID del paciente
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
const deletePaciente = async (id) => {
  try {
    const result = await query(
      'DELETE FROM pacientes WHERE id = $1',
      [id]
    );
    return result.rowCount > 0;
  } catch (error) {
    logger.error('Error en delete paciente:', error);
    throw error;
  }
};

/**
 * Activar paciente
 * @param {string} id - UUID del paciente
 * @returns {Promise<Object>} Paciente actualizado
 */
const activate = async (id) => {
  try {
    const result = await query(
      `UPDATE pacientes 
       SET activo = true
       WHERE id = $1
       RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
                 direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
                 contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en activate paciente:', error);
    throw error;
  }
};

/**
 * Desactivar paciente
 * @param {string} id - UUID del paciente
 * @returns {Promise<Object>} Paciente actualizado
 */
const deactivate = async (id) => {
  try {
    const result = await query(
      `UPDATE pacientes 
       SET activo = false
       WHERE id = $1
       RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
                 direccion, obra_social, numero_afiliado, contacto_emergencia_nombre,
                 contacto_emergencia_telefono, activo, fecha_creacion, fecha_actualizacion`,
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en deactivate paciente:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByDni,
  search,
  create,
  update,
  delete: deletePaciente,
  activate,
  deactivate
};

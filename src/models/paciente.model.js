/**
 * PACIENTE.MODEL.JS - Modelo de pacientes
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con pacientes.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { encryptPacienteRow, decryptPacienteRow, decryptPacienteRows } = require('../utils/encryption');

/**
 * Buscar todos los pacientes con filtros opcionales
 * @param {Object} filters - Filtros: activo, obra_social
 * @returns {Promise<Array>} Lista de pacientes
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
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
    return decryptPacienteRows(result.rows);
  } catch (error) {
    logger.error('Error en findAll pacientes:', error);
    throw error;
  }
};

/**
 * Listar pacientes con paginación y filtros (búsqueda, activo, obra_social)
 * @param {Object} filters - { q, activo, obra_social, ids, page, limit }
 * @returns {Promise<{ rows: Array, total: number }>}
 */
const findAllPaginated = async (filters = {}) => {
  try {
    const { page = 1, limit = 10 } = filters;
    const limitVal = Math.min(100, Math.max(1, limit));
    const offset = (Math.max(1, page) - 1) * limitVal;
    const hasQ = filters.q && String(filters.q).trim();

    let where = ' WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    if (filters.activo !== undefined) {
      where += ` AND activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    if (filters.obra_social) {
      where += ` AND obra_social ILIKE $${paramIndex++}`;
      params.push(`%${filters.obra_social}%`);
    }
    if (filters.ids && Array.isArray(filters.ids) && filters.ids.length > 0) {
      where += ` AND id = ANY($${paramIndex++})`;
      params.push(filters.ids);
    }
    if (hasQ) {
      const term = `%${String(filters.q).trim()}%`;
      where += ` AND (nombre ILIKE $${paramIndex} OR apellido ILIKE $${paramIndex} OR dni ILIKE $${paramIndex})`;
      params.push(term);
      paramIndex += 1;
    }

    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM pacientes ${where}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;
    const dataParams = [...params, limitVal, offset];
    const dataSql = `
      SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes ${where}
      ORDER BY fecha_creacion DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    const dataResult = await query(dataSql, dataParams);
    return { rows: decryptPacienteRows(dataResult.rows), total };
  } catch (error) {
    logger.error('Error en findAllPaginated pacientes:', error);
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
        id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
      FROM pacientes
      WHERE id = $1`,
      [id]
    );
    const row = result.rows[0] || null;
    return row ? decryptPacienteRow(row) : null;
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
    const term = String(dni || '').trim().replace(/\D/g, '');
    if (!term) return null;
    const result = await query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
       direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
       contacto_emergencia_telefono, contacto_emergencia_nombre_2,
       contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
       FROM pacientes
       WHERE REGEXP_REPLACE(COALESCE(dni,''), '[^0-9]', '', 'g') = $1 OR dni = $2
       LIMIT 1`,
      [term, dni]
    );
    const row = result.rows[0];
    return row ? decryptPacienteRow(row) : null;
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
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return [];
    const sqlTerm = `%${term}%`;
    const result = await query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
       direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
       contacto_emergencia_telefono, contacto_emergencia_nombre_2,
       contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
       FROM pacientes
       WHERE nombre ILIKE $1 OR apellido ILIKE $1 OR dni ILIKE $1
       ORDER BY nombre, apellido
       LIMIT 50`,
      [sqlTerm]
    );
    return decryptPacienteRows(result.rows);
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
    const raw = {
      dni: pacienteData.dni,
      nombre: pacienteData.nombre,
      apellido: pacienteData.apellido,
      fecha_nacimiento: pacienteData.fecha_nacimiento ?? null,
      telefono: pacienteData.telefono ?? null,
      whatsapp: pacienteData.whatsapp ?? null,
      email: pacienteData.email ?? null,
      direccion: pacienteData.direccion ?? null,
      obra_social: pacienteData.obra_social ?? null,
      numero_afiliado: pacienteData.numero_afiliado ?? null,
      plan: pacienteData.plan ?? null,
      contacto_emergencia_nombre: pacienteData.contacto_emergencia_nombre ?? null,
      contacto_emergencia_telefono: pacienteData.contacto_emergencia_telefono ?? null,
      contacto_emergencia_nombre_2: pacienteData.contacto_emergencia_nombre_2 ?? null,
      contacto_emergencia_telefono_2: pacienteData.contacto_emergencia_telefono_2 ?? null,
      activo: pacienteData.activo !== false,
      notificaciones_activas: pacienteData.notificaciones_activas !== false
    };
    const enc = encryptPacienteRow(raw);
    const result = await query(
      `INSERT INTO pacientes (
        dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
                direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
                contacto_emergencia_telefono, contacto_emergencia_nombre_2,
                contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion`,
      [
        enc.dni, enc.nombre, enc.apellido, enc.fecha_nacimiento, enc.telefono,
        enc.whatsapp, enc.email, enc.direccion, enc.obra_social, enc.numero_afiliado, enc.plan,
        enc.contacto_emergencia_nombre, enc.contacto_emergencia_telefono,
        enc.contacto_emergencia_nombre_2, enc.contacto_emergencia_telefono_2,
        enc.notificaciones_activas, enc.activo
      ]
    );
    return decryptPacienteRow(result.rows[0]);
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
    const allowedFields = [
      'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'whatsapp', 'email',
      'direccion', 'obra_social', 'numero_afiliado', 'plan', 'contacto_emergencia_nombre',
      'contacto_emergencia_telefono', 'contacto_emergencia_nombre_2',
      'contacto_emergencia_telefono_2', 'notificaciones_activas', 'activo'
    ];
    const raw = {};
    for (const field of allowedFields) {
      if (pacienteData[field] !== undefined) raw[field] = pacienteData[field];
    }
    if (Object.keys(raw).length === 0) return await findById(id);

    const enc = encryptPacienteRow(raw);
    const updates = [];
    const params = [];
    let paramIndex = 1;
    for (const field of allowedFields) {
      if (enc[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(enc[field]);
      }
    }
    params.push(id);
    const sql = `
      UPDATE pacientes 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, dni, nombre, apellido, fecha_nacimiento, telefono, whatsapp, email,
                direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
                contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion
    `;
    const result = await query(sql, params);
    return result.rows[0] ? decryptPacienteRow(result.rows[0]) : null;
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
                 direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
                 contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion`,
      [id]
    );
    return result.rows[0] ? decryptPacienteRow(result.rows[0]) : null;
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
                 direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
                 contacto_emergencia_telefono, contacto_emergencia_nombre_2,
        contacto_emergencia_telefono_2, notificaciones_activas, activo, fecha_creacion, fecha_actualizacion`,
      [id]
    );
    return result.rows[0] ? decryptPacienteRow(result.rows[0]) : null;
  } catch (error) {
    logger.error('Error en deactivate paciente:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findAllPaginated,
  findById,
  findByDni,
  search,
  create,
  update,
  delete: deletePaciente,
  activate,
  deactivate
};

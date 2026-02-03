/**
 * USUARIO.MODEL.JS - Modelo de usuarios
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con usuarios (autenticación, CRUD, roles).
 */

const { query } = require('../config/database');
const bcrypt = require('bcrypt');
const logger = require('../utils/logger');

const findAll = async (filters = {}) => {
  try {
    let sql = 'SELECT id, email, nombre, apellido, telefono, rol, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (filters.rol) {
      sql += ` AND rol = $${paramIndex++}`;
      params.push(filters.rol);
    }
    
    if (filters.activo !== undefined) {
      sql += ` AND activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    sql += ' ORDER BY fecha_creacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll usuarios:', error);
    throw error;
  }
};

const findById = async (id) => {
  try {
    const result = await query(
      'SELECT id, email, nombre, apellido, telefono, rol, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById usuario:', error);
    throw error;
  }
};

const findByEmail = async (email) => {
  try {
    const result = await query(
      'SELECT id, email, password_hash, nombre, apellido, telefono, rol, activo, fecha_creacion, fecha_actualizacion FROM usuarios WHERE email = $1',
      [email]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByEmail usuario:', error);
    throw error;
  }
};

const create = async (userData) => {
  try {
    const { email, password, nombre, apellido, telefono, rol, activo = true } = userData;
    
    // Hashear password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);
    
    const result = await query(
      `INSERT INTO usuarios (email, password_hash, nombre, apellido, telefono, rol, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, email, nombre, apellido, telefono, rol, activo, fecha_creacion, fecha_actualizacion`,
      [email, password_hash, nombre || '', apellido || '', telefono || null, rol, activo]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create usuario:', error);
    throw error;
  }
};

const update = async (id, userData) => {
  try {
    const { email, nombre, apellido, telefono, rol, activo } = userData;
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    if (email !== undefined) {
      updates.push(`email = $${paramIndex++}`);
      params.push(email);
    }
    
    if (nombre !== undefined) {
      updates.push(`nombre = $${paramIndex++}`);
      params.push(nombre);
    }
    
    if (apellido !== undefined) {
      updates.push(`apellido = $${paramIndex++}`);
      params.push(apellido);
    }
    
    if (telefono !== undefined) {
      updates.push(`telefono = $${paramIndex++}`);
      params.push(telefono);
    }
    
    if (rol !== undefined) {
      updates.push(`rol = $${paramIndex++}`);
      params.push(rol);
    }
    
    if (activo !== undefined) {
      updates.push(`activo = $${paramIndex++}`);
      params.push(activo);
    }
    
    if (updates.length === 0) {
      return await findById(id);
    }
    
    // fecha_actualizacion se actualiza automáticamente con el trigger
    params.push(id);
    
    const sql = `UPDATE usuarios SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING id, email, nombre, apellido, telefono, rol, activo, fecha_creacion, fecha_actualizacion`;
    
    const result = await query(sql, params);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update usuario:', error);
    throw error;
  }
};

const deleteUser = async (id) => {
  try {
    // Eliminación real (DELETE). Las FK con ON DELETE CASCADE eliminan registros relacionados.
    const result = await query(
      'DELETE FROM usuarios WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en delete usuario:', error);
    throw error;
  }
};

const activate = async (id) => {
  try {
    // fecha_actualizacion se actualiza automáticamente con el trigger
    const result = await query(
      'UPDATE usuarios SET activo = true WHERE id = $1 RETURNING id, activo',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en activate usuario:', error);
    throw error;
  }
};

const deactivate = async (id) => {
  try {
    // fecha_actualizacion se actualiza automáticamente con el trigger
    const result = await query(
      'UPDATE usuarios SET activo = false WHERE id = $1 RETURNING id, activo',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en deactivate usuario:', error);
    throw error;
  }
};

const updatePassword = async (id, newPassword) => {
  try {
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(newPassword, saltRounds);
    
    // fecha_actualizacion se actualiza automáticamente con el trigger
    const result = await query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2 RETURNING id',
      [password_hash, id]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en updatePassword usuario:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByEmail,
  create,
  update,
  delete: deleteUser,
  activate,
  deactivate,
  updatePassword
};

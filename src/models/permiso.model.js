/**
 * PERMISO.MODEL.JS - Modelo de permisos personalizados de usuarios
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con permisos personalizados asignados a usuarios (excepciones a permisos por rol).
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

const findAll = async (filters = {}) => {
  try {
    let sql = 'SELECT * FROM permisos_usuario WHERE 1=1';
    const params = [];
    let paramIndex = 1;
    
    if (filters.usuario_id) {
      sql += ` AND usuario_id = $${paramIndex++}`;
      params.push(filters.usuario_id);
    }
    
    if (filters.permiso) {
      sql += ` AND permiso = $${paramIndex++}`;
      params.push(filters.permiso);
    }
    
    if (filters.activo !== undefined) {
      sql += ` AND activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    sql += ' ORDER BY fecha_asignacion DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll permisos:', error);
    throw error;
  }
};

const findById = async (id) => {
  try {
    const result = await query(
      'SELECT * FROM permisos_usuario WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById permiso:', error);
    throw error;
  }
};

const findByUsuario = async (usuarioId) => {
  try {
    const result = await query(
      'SELECT * FROM permisos_usuario WHERE usuario_id = $1 ORDER BY fecha_asignacion DESC',
      [usuarioId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByUsuario permiso:', error);
    throw error;
  }
};

const findByUsuarioAndPermiso = async (usuarioId, permiso) => {
  try {
    const result = await query(
      'SELECT * FROM permisos_usuario WHERE usuario_id = $1 AND permiso = $2',
      [usuarioId, permiso]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findByUsuarioAndPermiso:', error);
    throw error;
  }
};

const create = async (permisoData) => {
  try {
    const { usuario_id, permiso, activo = true } = permisoData;
    
    const result = await query(
      `INSERT INTO permisos_usuario (usuario_id, permiso, activo)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [usuario_id, permiso, activo]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create permiso:', error);
    throw error;
  }
};

const update = async (id, permisoData) => {
  try {
    const { activo } = permisoData;
    
    // fecha_actualizacion se actualiza automáticamente con el trigger (si existe)
    const result = await query(
      `UPDATE permisos_usuario 
       SET activo = $1
       WHERE id = $2
       RETURNING *`,
      [activo, id]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en update permiso:', error);
    throw error;
  }
};

const deletePermiso = async (id) => {
  try {
    const result = await query(
      'DELETE FROM permisos_usuario WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en delete permiso:', error);
    throw error;
  }
};

const grant = async (usuarioId, permiso) => {
  try {
    // Verificar si ya existe
    const existing = await findByUsuarioAndPermiso(usuarioId, permiso);
    
    if (existing) {
      // Actualizar a activo = true
      return await update(existing.id, { activo: true });
    } else {
      // Crear nuevo permiso
      return await create({ usuario_id: usuarioId, permiso, activo: true });
    }
  } catch (error) {
    logger.error('Error en grant permiso:', error);
    throw error;
  }
};

const revoke = async (usuarioId, permiso) => {
  try {
    // Verificar si ya existe
    const existing = await findByUsuarioAndPermiso(usuarioId, permiso);
    
    if (existing) {
      // Actualizar a activo = false
      return await update(existing.id, { activo: false });
    } else {
      // Crear nuevo permiso con activo = false
      return await create({ usuario_id: usuarioId, permiso, activo: false });
    }
  } catch (error) {
    logger.error('Error en revoke permiso:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByUsuario,
  findByUsuarioAndPermiso,
  create,
  update,
  delete: deletePermiso,
  grant,
  revoke
};

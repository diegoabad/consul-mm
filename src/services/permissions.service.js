/**
 * PERMISSIONS.SERVICE.JS - Lógica de verificación de permisos
 * 
 * Este servicio contiene la lógica para verificar permisos de usuarios,
 * considerando tanto permisos por rol como permisos personalizados.
 */

const permisoModel = require('../models/permiso.model');
const { PERMISOS, PERMISOS_POR_ROL } = require('../utils/constants');
const logger = require('../utils/logger');

/**
 * Obtener permisos por defecto de un rol
 */
const getPermissionsForRole = (rol) => {
  return PERMISOS_POR_ROL[rol] || [];
};

/**
 * Obtener todos los permisos de un usuario (rol + personalizados)
 */
const getUserPermissions = async (usuarioId, rol) => {
  try {
    // Permisos por rol
    const rolePermissions = getPermissionsForRole(rol);
    
    // Permisos personalizados
    const customPermissions = await permisoModel.findByUsuario(usuarioId);
    
    // Crear mapa de permisos personalizados
    const customPermissionsMap = {};
    customPermissions.forEach(perm => {
      // Solo considerar permisos activos
      if (perm.activo) {
        customPermissionsMap[perm.permiso] = true;
      } else {
        customPermissionsMap[perm.permiso] = false;
      }
    });
    
    // Combinar: permisos personalizados tienen prioridad
    const allPermissions = {};
    
    // Primero agregar permisos de rol
    rolePermissions.forEach(perm => {
      allPermissions[perm] = true;
    });
    
    // Luego aplicar permisos personalizados (sobrescriben los de rol)
    Object.keys(customPermissionsMap).forEach(perm => {
      allPermissions[perm] = customPermissionsMap[perm];
    });
    
    return allPermissions;
  } catch (error) {
    logger.error('Error en getUserPermissions:', error);
    throw error;
  }
};

/**
 * Verificar si un usuario tiene un permiso específico
 */
const hasPermission = async (usuarioId, rol, permiso) => {
  try {
    // Validar que el permiso exista en la lista de permisos
    if (!PERMISOS.includes(permiso)) {
      logger.warn(`Permiso no válido: ${permiso}`);
      return false;
    }
    
    // Verificar permiso personalizado primero
    const customPerm = await permisoModel.findByUsuarioAndPermiso(usuarioId, permiso);
    
    if (customPerm) {
      // Permiso personalizado tiene prioridad
      return customPerm.activo === true;
    }
    
    // Si no hay permiso personalizado, verificar por rol
    const rolePermissions = getPermissionsForRole(rol);
    return rolePermissions.includes(permiso);
  } catch (error) {
    logger.error('Error en hasPermission:', error);
    throw error;
  }
};

/**
 * Verificar acceso (alias de hasPermission)
 */
const canAccess = async (usuarioId, rol, permiso) => {
  return await hasPermission(usuarioId, rol, permiso);
};

module.exports = {
  hasPermission,
  getPermissionsForRole,
  getUserPermissions,
  canAccess
};

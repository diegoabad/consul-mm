/**
 * PERMISSIONS.MIDDLEWARE.JS - Middleware de verificación de permisos
 * 
 * Este middleware verifica que el usuario tenga los permisos necesarios
 * para realizar una acción específica.
 */

const permissionsService = require('../services/permissions.service');
const logger = require('../utils/logger');
const { ROLES } = require('../utils/constants');

/**
 * Middleware factory que requiere un permiso específico
 */
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Usuario no autenticado',
            code: 'NOT_AUTHENTICATED'
          }
        });
      }
      
      const hasAccess = await permissionsService.canAccess(
        req.user.id,
        req.user.rol,
        permission
      );
      
      if (!hasAccess) {
        logger.warn('Acceso denegado:', {
          usuarioId: req.user.id,
          rol: req.user.rol,
          permiso: permission,
          path: req.path
        });
        
        return res.status(403).json({
          success: false,
          error: {
            message: 'No tiene permisos para realizar esta acción',
            code: 'FORBIDDEN',
            requiredPermission: permission
          }
        });
      }
      
      next();
    } catch (error) {
      logger.error('Error en requirePermission:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Error verificando permisos',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

/**
 * Middleware factory que requiere uno de varios roles
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Usuario no autenticado',
          code: 'NOT_AUTHENTICATED'
        }
      });
    }
    
    const allowedRoles = Array.isArray(roles) ? roles : [roles];
    
    if (!allowedRoles.includes(req.user.rol)) {
      logger.warn('Acceso denegado por rol:', {
        usuarioId: req.user.id,
        rol: req.user.rol,
        rolesRequeridos: allowedRoles,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tiene el rol necesario para realizar esta acción',
          code: 'FORBIDDEN',
          requiredRoles: allowedRoles
        }
      });
    }
    
    next();
  };
};

/**
 * Middleware factory que requiere al menos un permiso de la lista
 */
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: {
            message: 'Usuario no autenticado',
            code: 'NOT_AUTHENTICATED'
          }
        });
      }
      
      const permissionList = Array.isArray(permissions) ? permissions : [permissions];
      
      // Verificar si tiene al menos uno de los permisos
      for (const permission of permissionList) {
        const hasAccess = await permissionsService.canAccess(
          req.user.id,
          req.user.rol,
          permission
        );
        
        if (hasAccess) {
          return next();
        }
      }
      
      logger.warn('Acceso denegado - ningún permiso válido:', {
        usuarioId: req.user.id,
        rol: req.user.rol,
        permisosRequeridos: permissionList,
        path: req.path
      });
      
      return res.status(403).json({
        success: false,
        error: {
          message: 'No tiene permisos para realizar esta acción',
          code: 'FORBIDDEN',
          requiredPermissions: permissionList
        }
      });
    } catch (error) {
      logger.error('Error en requireAnyPermission:', error);
      return res.status(500).json({
        success: false,
        error: {
          message: 'Error verificando permisos',
          code: 'PERMISSION_CHECK_ERROR'
        }
      });
    }
  };
};

module.exports = {
  requirePermission,
  requireRole,
  requireAnyPermission
};

/**
 * AUTH.MIDDLEWARE.JS - Middleware de autenticación JWT
 * 
 * Este middleware verifica la autenticación del usuario mediante JWT tokens.
 */

const jwt = require('jsonwebtoken');
require('dotenv').config();
const logger = require('../utils/logger');

/**
 * Middleware para verificar autenticación
 */
const authenticate = (req, res, next) => {
  try {
    // Extraer token del header Authorization
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token no proporcionado',
          code: 'NO_TOKEN'
        }
      });
    }
    
    const token = authHeader.substring(7); // Remover "Bearer "
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token no proporcionado',
          code: 'NO_TOKEN'
        }
      });
    }
    
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Agregar datos del usuario a req.user
    req.user = {
      id: decoded.id,
      email: decoded.email,
      rol: decoded.rol
    };
    
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token expirado',
          code: 'TOKEN_EXPIRED'
        }
      });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: {
          message: 'Token inválido',
          code: 'INVALID_TOKEN'
        }
      });
    }
    
    logger.error('Error en autenticación:', error);
    return res.status(401).json({
      success: false,
      error: {
        message: 'Error de autenticación',
        code: 'AUTH_ERROR'
      }
    });
  }
};

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = {
          id: decoded.id,
          email: decoded.email,
          rol: decoded.rol
        };
      } catch (error) {
        // Si el token es inválido, simplemente no agregamos req.user
        // No es un error en este caso
      }
    }
    
    next();
  } catch (error) {
    // En caso de error, continuar sin autenticación
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth
};

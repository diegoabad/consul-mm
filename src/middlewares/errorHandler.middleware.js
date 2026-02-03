/**
 * ERRORHANDLER.MIDDLEWARE.JS - Middleware de manejo centralizado de errores
 * 
 * Este middleware captura todos los errores de la aplicación y los maneja
 * de forma centralizada, retornando respuestas consistentes.
 */

const logger = require('../utils/logger');

/**
 * Mapear errores de PostgreSQL a mensajes legibles
 */
const mapPostgresError = (error) => {
  const code = error.code;
  
  switch (code) {
    case '23505': // unique_violation
      return {
        message: 'El registro ya existe',
        code: 'DUPLICATE_ENTRY',
        statusCode: 409
      };
    case '23503': // foreign_key_violation
      return {
        message: 'Referencia inválida',
        code: 'FOREIGN_KEY_ERROR',
        statusCode: 400
      };
    case '23502': // not_null_violation
      return {
        message: 'Campo requerido faltante',
        code: 'REQUIRED_FIELD',
        statusCode: 400
      };
    case '42P01': // undefined_table
      return {
        message: 'Tabla no encontrada',
        code: 'TABLE_NOT_FOUND',
        statusCode: 500
      };
    case '23514': // check_violation
      return {
        message: 'El valor no es válido (revisar restricciones de la base de datos)',
        code: 'CHECK_VIOLATION',
        statusCode: 400
      };
    default:
      return {
        message: 'Error de base de datos',
        code: 'DATABASE_ERROR',
        statusCode: 500
      };
  }
};

/**
 * Middleware de manejo de errores
 */
const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let errorResponse = {
    success: false,
    error: {
      message: 'Error interno del servidor',
      code: 'INTERNAL_ERROR'
    }
  };
  
  // Error de JWT
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    errorResponse.error = {
      message: 'Token inválido',
      code: 'INVALID_TOKEN'
    };
    logger.warn('Token inválido:', { path: req.path });
  }
  // Token expirado
  else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    errorResponse.error = {
      message: 'Token expirado',
      code: 'TOKEN_EXPIRED'
    };
    logger.warn('Token expirado:', { path: req.path });
  }
  // Error de validación Joi
  else if (err.isJoi) {
    statusCode = 400;
    errorResponse.error = {
      message: 'Error de validación',
      code: 'VALIDATION_ERROR',
      details: err.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }))
    };
    logger.warn('Error de validación:', { path: req.path, error: err.details });
  }
  // Error de PostgreSQL
  else if (err.code && err.code.startsWith('23') || err.code && err.code.startsWith('42')) {
    const mappedError = mapPostgresError(err);
    statusCode = mappedError.statusCode;
    errorResponse.error = {
      message: mappedError.message,
      code: mappedError.code
    };
    logger.error('Error de PostgreSQL:', { code: err.code, message: err.message });
  }
  // Error personalizado con statusCode
  else if (err.statusCode) {
    statusCode = err.statusCode;
    errorResponse.error = {
      message: err.message || 'Error en la solicitud',
      code: err.code || 'REQUEST_ERROR',
      ...(err.details && { details: err.details })
    };
    logger.warn('Error de solicitud:', { statusCode, message: err.message, path: req.path });
  }
  // Error genérico
  else {
    errorResponse.error = {
      message: process.env.NODE_ENV === 'production' 
        ? 'Error interno del servidor' 
        : err.message,
      code: 'INTERNAL_ERROR',
      ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    };
    logger.error('Error no manejado:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method
    });
  }
  
  res.status(statusCode).json(errorResponse);
};

module.exports = errorHandler;

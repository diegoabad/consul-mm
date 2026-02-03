/**
 * VALIDATE.MIDDLEWARE.JS - Middleware de validación con Joi
 * 
 * Este middleware valida los datos de entrada (body, params, query)
 * usando esquemas de validación Joi.
 */

const Joi = require('joi');
const logger = require('../utils/logger');

// Configurar mensajes por defecto en español para Joi
const defaultMessages = {
  'string.empty': '{{#label}} no puede estar vacío',
  'string.base': '{{#label}} debe ser un texto',
  'string.min': '{{#label}} debe tener al menos {{#limit}} caracteres',
  'string.max': '{{#label}} no puede exceder {{#limit}} caracteres',
  'any.required': '{{#label}} es requerido',
  'any.empty': '{{#label}} no puede estar vacío',
  'any.invalid': '{{#label}} no puede estar vacío',
  'number.base': '{{#label}} debe ser un número',
  'number.min': '{{#label}} debe ser mayor o igual a {{#limit}}',
  'number.max': '{{#label}} debe ser menor o igual a {{#limit}}',
  'date.base': '{{#label}} debe ser una fecha válida',
  'date.format': '{{#label}} debe tener un formato válido',
  'boolean.base': '{{#label}} debe ser verdadero o falso',
  'string.email': '{{#label}} debe tener un formato de email válido',
  'string.guid': '{{#label}} debe ser un UUID válido',
  'any.only': '{{#label}} debe ser uno de los valores permitidos'
};

/**
 * Formatear errores de Joi
 */
const formatJoiError = (error) => {
  return error.details.map(detail => ({
    field: detail.path.join('.'),
    message: detail.message
  }));
};

/**
 * Middleware factory genérico
 */
const validate = (schema) => {
  return (req, res, next) => {
    const errors = [];
    
    // Validar body
    if (schema.body) {
      const { error, value } = schema.body.validate(req.body, { 
        abortEarly: false,
        messages: defaultMessages
      });
      if (error) {
        errors.push(...formatJoiError(error));
      } else {
        req.body = value;
      }
    }
    
    // Validar params
    if (schema.params) {
      const { error, value } = schema.params.validate(req.params, { 
        abortEarly: false,
        messages: defaultMessages
      });
      if (error) {
        errors.push(...formatJoiError(error));
      } else {
        req.params = value;
      }
    }
    
    // Validar query
    if (schema.query) {
      const { error, value } = schema.query.validate(req.query, { 
        abortEarly: false,
        messages: defaultMessages
      });
      if (error) {
        errors.push(...formatJoiError(error));
      } else {
        req.query = value;
      }
    }
    
    if (errors.length > 0) {
      logger.warn('Error de validación:', { errors, path: req.path });
      return res.status(400).json({
        success: false,
        error: {
          message: 'Error de validación',
          code: 'VALIDATION_ERROR',
          details: errors
        }
      });
    }
    
    next();
  };
};

/**
 * Validar solo body
 */
const validateBody = (schema) => {
  return validate({ body: schema });
};

/**
 * Validar solo params
 */
const validateParams = (schema) => {
  return validate({ params: schema });
};

/**
 * Validar solo query
 */
const validateQuery = (schema) => {
  return validate({ query: schema });
};

module.exports = {
  validate,
  validateBody,
  validateParams,
  validateQuery
};

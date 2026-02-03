/**
 * NOTIFICACION.VALIDATOR.JS - Validadores de notificaciones
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de notificaciones por email.
 */

const Joi = require('joi');

const ESTADOS_NOTIFICACION = ['pendiente', 'enviado', 'fallido'];

const createNotificacionSchema = Joi.object({
  destinatario_email: Joi.string().email().required()
    .messages({
      'string.email': 'El destinatario_email debe ser un email válido',
      'any.required': 'El destinatario_email es requerido'
    }),
  asunto: Joi.string().min(1).max(255).required()
    .messages({
      'string.min': 'El asunto debe tener al menos 1 carácter',
      'string.max': 'El asunto no puede exceder 255 caracteres',
      'any.required': 'El asunto es requerido'
    }),
  contenido: Joi.string().min(1).required()
    .messages({
      'string.min': 'El contenido debe tener al menos 1 carácter',
      'any.required': 'El contenido es requerido'
    }),
  tipo: Joi.string().max(50).optional().allow(null, ''),
  relacionado_tipo: Joi.string().max(50).optional().allow(null, ''),
  relacionado_id: Joi.string().uuid().optional().allow(null, '')
    .messages({
      'string.guid': 'El relacionado_id debe ser un UUID válido'
    })
});

const updateNotificacionSchema = Joi.object({
  asunto: Joi.string().min(1).max(255).optional(),
  contenido: Joi.string().min(1).optional(),
  tipo: Joi.string().max(50).optional().allow(null, ''),
  estado: Joi.string().valid(...ESTADOS_NOTIFICACION).optional(),
  error_mensaje: Joi.string().optional().allow(null, '')
});

const notificacionParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const notificacionQuerySchema = Joi.object({
  destinatario_email: Joi.string().email().optional(),
  tipo: Joi.string().max(50).optional(),
  estado: Joi.string().valid(...ESTADOS_NOTIFICACION).optional(),
  relacionado_tipo: Joi.string().max(50).optional(),
  relacionado_id: Joi.string().uuid().optional()
});

module.exports = {
  createNotificacionSchema,
  updateNotificacionSchema,
  notificacionParamsSchema,
  notificacionQuerySchema
};

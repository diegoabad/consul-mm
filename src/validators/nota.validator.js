/**
 * NOTA.VALIDATOR.JS - Validadores de notas de paciente
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de notas de paciente.
 */

const Joi = require('joi');

const createNotaSchema = Joi.object({
  paciente_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El paciente_id debe ser un UUID válido',
      'any.required': 'El paciente_id es requerido'
    }),
  usuario_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El usuario_id debe ser un UUID válido',
      'any.required': 'El usuario_id es requerido'
    }),
  contenido: Joi.string().min(1).required()
    .messages({
      'string.min': 'El contenido debe tener al menos 1 carácter',
      'any.required': 'El contenido es requerido'
    })
});

const updateNotaSchema = Joi.object({
  contenido: Joi.string().min(1).required()
    .messages({
      'string.min': 'El contenido debe tener al menos 1 carácter',
      'any.required': 'El contenido es requerido'
    })
});

const notaParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const notaQuerySchema = Joi.object({
  paciente_id: Joi.string().uuid().optional(),
  usuario_id: Joi.string().uuid().optional()
});

module.exports = {
  createNotaSchema,
  updateNotaSchema,
  notaParamsSchema,
  notaQuerySchema
};

/**
 * ARCHIVO.VALIDATOR.JS - Validadores de archivos
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de archivos de paciente.
 */

const Joi = require('joi');

const createArchivoSchema = Joi.object({
  paciente_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El paciente_id debe ser un UUID válido',
      'any.required': 'El paciente_id es requerido'
    }),
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    }),
  descripcion: Joi.string().optional().allow(null, '')
    .messages({
      'string.base': 'La descripcion debe ser un texto'
    })
}).unknown(true); // Permitir campos adicionales (como los que vienen de multer)

const updateArchivoSchema = Joi.object({
  nombre_archivo: Joi.string().max(255).optional()
    .messages({
      'string.max': 'El nombre_archivo no puede exceder 255 caracteres'
    }),
  tipo_archivo: Joi.string().max(100).optional()
    .messages({
      'string.max': 'El tipo_archivo no puede exceder 100 caracteres'
    }),
  descripcion: Joi.string().optional().allow(null, '')
});

const archivoParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const archivoQuerySchema = Joi.object({
  paciente_id: Joi.string().uuid().optional(),
  profesional_id: Joi.string().uuid().optional()
});

module.exports = {
  createArchivoSchema,
  updateArchivoSchema,
  archivoParamsSchema,
  archivoQuerySchema
};

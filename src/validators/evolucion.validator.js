/**
 * EVOLUCION.VALIDATOR.JS - Validadores de evoluciones clínicas
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de evoluciones clínicas.
 */

const Joi = require('joi');

const createEvolucionSchema = Joi.object({
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
  turno_id: Joi.string().uuid().optional().allow(null, '')
    .messages({
      'string.guid': 'El turno_id debe ser un UUID válido'
    }),
  evolucion_anterior_id: Joi.string().uuid().optional().allow(null, '')
    .messages({
      'string.guid': 'El evolucion_anterior_id debe ser un UUID válido'
    }),
  fecha_consulta: Joi.date().iso().required()
    .messages({
      'date.base': 'La fecha_consulta debe ser una fecha válida',
      'date.format': 'La fecha_consulta debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)',
      'any.required': 'La fecha_consulta es requerida'
    }),
  motivo_consulta: Joi.string().optional().allow(null, ''),
  diagnostico: Joi.string().optional().allow(null, ''),
  tratamiento: Joi.string().optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const updateEvolucionSchema = Joi.object({
  turno_id: Joi.string().uuid().optional().allow(null, '')
    .messages({
      'string.guid': 'El turno_id debe ser un UUID válido'
    }),
  fecha_consulta: Joi.date().iso().optional()
    .messages({
      'date.base': 'La fecha_consulta debe ser una fecha válida',
      'date.format': 'La fecha_consulta debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)'
    }),
  motivo_consulta: Joi.string().optional().allow(null, ''),
  diagnostico: Joi.string().optional().allow(null, ''),
  tratamiento: Joi.string().optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const evolucionParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const evolucionQuerySchema = Joi.object({
  paciente_id: Joi.string().uuid().optional(),
  profesional_id: Joi.string().uuid().optional(),
  turno_id: Joi.string().uuid().optional(),
  fecha_inicio: Joi.date().iso().optional(),
  fecha_fin: Joi.date().iso().optional()
});

module.exports = {
  createEvolucionSchema,
  updateEvolucionSchema,
  evolucionParamsSchema,
  evolucionQuerySchema
};

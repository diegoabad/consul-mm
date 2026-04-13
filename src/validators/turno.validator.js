/**
 * TURNO.VALIDATOR.JS - Validadores de turnos
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de turnos.
 */

const Joi = require('joi');
const { ESTADOS_TURNO } = require('../utils/constants');

const createTurnoSchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    }),
  paciente_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El paciente_id debe ser un UUID válido',
      'any.required': 'El paciente_id es requerido'
    }),
  fecha_hora_inicio: Joi.date().iso().required()
    .messages({
      'date.base': 'La fecha_hora_inicio debe ser una fecha válida',
      'date.format': 'La fecha_hora_inicio debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)',
      'any.required': 'La fecha_hora_inicio es requerida'
    }),
  fecha_hora_fin: Joi.date().iso().required()
    .greater(Joi.ref('fecha_hora_inicio'))
    .messages({
      'date.base': 'La fecha_hora_fin debe ser una fecha válida',
      'date.format': 'La fecha_hora_fin debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)',
      'date.greater': 'La fecha_hora_fin debe ser posterior a fecha_hora_inicio',
      'any.required': 'La fecha_hora_fin es requerida'
    }),
  estado: Joi.string().valid(...Object.values(ESTADOS_TURNO)).default(ESTADOS_TURNO.PENDIENTE),
  sobreturno: Joi.boolean().optional().default(false),
  motivo: Joi.string().optional().allow(null, ''),
  permiso_fuera_agenda: Joi.boolean().optional().default(false)
});

const updateTurnoSchema = Joi.object({
  fecha_hora_inicio: Joi.date().iso().optional(),
  fecha_hora_fin: Joi.date().iso().optional()
    .when('fecha_hora_inicio', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('fecha_hora_inicio'))
        .messages({
          'date.greater': 'La fecha_hora_fin debe ser posterior a fecha_hora_inicio'
        }),
      otherwise: Joi.date()
    }),
  estado: Joi.string().valid(...Object.values(ESTADOS_TURNO)).optional(),
  motivo: Joi.string().optional().allow(null, '')
});

const cancelTurnoSchema = Joi.object({
  razon_cancelacion: Joi.string().optional().allow(null, '')
});

const turnoParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const turnoQuerySchema = Joi.object({
  profesional_id: Joi.string().uuid().optional(),
  paciente_id: Joi.string().uuid().optional(),
  estado: Joi.string().valid(...Object.values(ESTADOS_TURNO), 'activos').optional(),
  fecha_inicio: Joi.date().iso().optional(),
  fecha_fin: Joi.date().iso().optional(),
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional()
});

const availabilitySchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    }),
  fecha_hora_inicio: Joi.date().iso().required()
    .messages({
      'date.base': 'La fecha_hora_inicio debe ser una fecha válida',
      'any.required': 'La fecha_hora_inicio es requerida'
    }),
  fecha_hora_fin: Joi.date().iso().required()
    .greater(Joi.ref('fecha_hora_inicio'))
    .messages({
      'date.base': 'La fecha_hora_fin debe ser una fecha válida',
      'date.greater': 'La fecha_hora_fin debe ser posterior a fecha_hora_inicio',
      'any.required': 'La fecha_hora_fin es requerida'
    })
});

const previewRecurrenciaSchema = Joi.object({
  profesional_id: Joi.string().uuid().required(),
  paciente_id: Joi.string().uuid().required(),
  frecuencia: Joi.string().valid('semanal', 'quincenal', 'mensual').required(),
  fecha_hora_inicio: Joi.date().iso().required(),
  fecha_hora_fin: Joi.date().iso().required().greater(Joi.ref('fecha_hora_inicio')),
  dia_semana: Joi.number().integer().min(0).max(6).optional(),
  semana_del_mes: Joi.number().integer().min(1).max(4).allow(null).optional(),
  fecha_fin: Joi.date().iso().allow(null).optional(),
  max_ocurrencias: Joi.number().integer().min(1).optional(),
  meses_max: Joi.number().integer().min(1).optional(),
  permiso_fuera_agenda: Joi.boolean().optional()
});

const ocurrenciaConfirmadaSchema = Joi.object({
  fecha_hora_inicio: Joi.date().iso().required(),
  fecha_hora_fin: Joi.date().iso().required().greater(Joi.ref('fecha_hora_inicio')),
  permiso_fuera_agenda: Joi.boolean().optional()
});

const createRecurrenciaSchema = Joi.object({
  profesional_id: Joi.string().uuid().required(),
  paciente_id: Joi.string().uuid().required(),
  motivo: Joi.string().optional().allow(null, ''),
  permiso_fuera_agenda: Joi.boolean().optional(),
  serie: Joi.object({
    frecuencia: Joi.string().valid('semanal', 'quincenal', 'mensual').required(),
    mensual_modo: Joi.string().valid('nth_weekday', 'dia_calendario').allow(null).optional(),
    dia_semana: Joi.number().integer().min(0).max(6).allow(null).optional(),
    semana_del_mes: Joi.number().integer().min(1).max(4).allow(null).optional(),
    fecha_fin: Joi.date().iso().allow(null).optional(),
    max_ocurrencias: Joi.number().integer().min(1).optional()
  }).required(),
  ocurrencias: Joi.array().items(ocurrenciaConfirmadaSchema).min(1).required()
});

const deleteTurnoQuerySchema = Joi.object({
  alcance: Joi.string().valid('solo_este', 'desde_aqui_en_adelante').optional()
});

module.exports = {
  createTurnoSchema,
  updateTurnoSchema,
  cancelTurnoSchema,
  turnoParamsSchema,
  turnoQuerySchema,
  availabilitySchema,
  previewRecurrenciaSchema,
  createRecurrenciaSchema,
  deleteTurnoQuerySchema
};

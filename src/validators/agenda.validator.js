/**
 * AGENDA.VALIDATOR.JS - Validadores de agenda
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de configuración de agenda y bloques no disponibles.
 */

const Joi = require('joi');

// ============================================
// VALIDADORES PARA CONFIGURACIÓN DE AGENDA
// ============================================

const createAgendaSchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    }),
  dia_semana: Joi.number().integer().min(0).max(6).required()
    .messages({
      'number.base': 'El dia_semana debe ser un número',
      'number.integer': 'El dia_semana debe ser un número entero',
      'number.min': 'El dia_semana debe ser entre 0 y 6 (0=Domingo, 6=Sábado)',
      'number.max': 'El dia_semana debe ser entre 0 y 6 (0=Domingo, 6=Sábado)',
      'any.required': 'El dia_semana es requerido'
    }),
  hora_inicio: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'La hora_inicio debe tener formato HH:mm:ss (ej: 09:00:00)',
      'any.required': 'La hora_inicio es requerida'
    }),
  hora_fin: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).required()
    .messages({
      'string.pattern.base': 'La hora_fin debe tener formato HH:mm:ss (ej: 18:00:00)',
      'any.required': 'La hora_fin es requerida'
    }),
  duracion_turno_minutos: Joi.number().integer().min(5).max(480).default(30)
    .messages({
      'number.base': 'La duracion_turno_minutos debe ser un número',
      'number.integer': 'La duracion_turno_minutos debe ser un número entero',
      'number.min': 'La duracion_turno_minutos debe ser al menos 5 minutos',
      'number.max': 'La duracion_turno_minutos no puede exceder 480 minutos (8 horas)'
    }),
  activo: Joi.boolean().default(true)
}).custom((value, helpers) => {
  // Validar que hora_fin sea posterior a hora_inicio
  if (value.hora_inicio && value.hora_fin) {
    const inicio = value.hora_inicio.split(':').map(Number);
    const fin = value.hora_fin.split(':').map(Number);
    const inicioMinutos = inicio[0] * 60 + inicio[1];
    const finMinutos = fin[0] * 60 + fin[1];
    
    if (finMinutos <= inicioMinutos) {
      return helpers.error('custom.hora_fin', {
        message: 'La hora_fin debe ser posterior a hora_inicio'
      });
    }
  }
  return value;
}).messages({
  'custom.hora_fin': 'La hora_fin debe ser posterior a hora_inicio'
});

const updateAgendaSchema = Joi.object({
  dia_semana: Joi.number().integer().min(0).max(6).optional()
    .messages({
      'number.base': 'El dia_semana debe ser un número',
      'number.integer': 'El dia_semana debe ser un número entero',
      'number.min': 'El dia_semana debe ser entre 0 y 6 (0=Domingo, 6=Sábado)',
      'number.max': 'El dia_semana debe ser entre 0 y 6 (0=Domingo, 6=Sábado)'
    }),
  hora_inicio: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional()
    .messages({
      'string.pattern.base': 'La hora_inicio debe tener formato HH:mm:ss (ej: 09:00:00)'
    }),
  hora_fin: Joi.string().pattern(/^([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/).optional()
    .messages({
      'string.pattern.base': 'La hora_fin debe tener formato HH:mm:ss (ej: 18:00:00)'
    }),
  duracion_turno_minutos: Joi.number().integer().min(5).max(480).optional()
    .messages({
      'number.base': 'La duracion_turno_minutos debe ser un número',
      'number.integer': 'La duracion_turno_minutos debe ser un número entero',
      'number.min': 'La duracion_turno_minutos debe ser al menos 5 minutos',
      'number.max': 'La duracion_turno_minutos no puede exceder 480 minutos (8 horas)'
    }),
  activo: Joi.boolean().optional()
}).custom((value, helpers) => {
  // Validar que hora_fin sea posterior a hora_inicio si ambas están presentes
  if (value.hora_inicio && value.hora_fin) {
    const inicio = value.hora_inicio.split(':').map(Number);
    const fin = value.hora_fin.split(':').map(Number);
    const inicioMinutos = inicio[0] * 60 + inicio[1];
    const finMinutos = fin[0] * 60 + fin[1];
    
    if (finMinutos <= inicioMinutos) {
      return helpers.error('custom.hora_fin', {
        message: 'La hora_fin debe ser posterior a hora_inicio'
      });
    }
  }
  return value;
}).messages({
  'custom.hora_fin': 'La hora_fin debe ser posterior a hora_inicio'
});

const agendaParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const agendaQuerySchema = Joi.object({
  profesional_id: Joi.string().uuid().optional(),
  dia_semana: Joi.string().pattern(/^[0-6]$/).optional()
    .messages({
      'string.pattern.base': 'El dia_semana debe ser un número entre 0 y 6'
    }),
  activo: Joi.string().valid('true', 'false').optional()
});

// ============================================
// VALIDADORES PARA BLOQUES NO DISPONIBLES
// ============================================

const createBloqueSchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
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
  motivo: Joi.string().max(255).optional().allow(null, '')
    .messages({
      'string.max': 'El motivo no puede exceder 255 caracteres'
    })
});

const updateBloqueSchema = Joi.object({
  fecha_hora_inicio: Joi.date().iso().optional()
    .messages({
      'date.base': 'La fecha_hora_inicio debe ser una fecha válida',
      'date.format': 'La fecha_hora_inicio debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)'
    }),
  fecha_hora_fin: Joi.date().iso().optional()
    .when('fecha_hora_inicio', {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref('fecha_hora_inicio'))
        .messages({
          'date.greater': 'La fecha_hora_fin debe ser posterior a fecha_hora_inicio'
        }),
      otherwise: Joi.date()
    })
    .messages({
      'date.base': 'La fecha_hora_fin debe ser una fecha válida',
      'date.format': 'La fecha_hora_fin debe tener formato ISO (YYYY-MM-DDTHH:mm:ss)'
    }),
  motivo: Joi.string().max(255).optional().allow(null, '')
    .messages({
      'string.max': 'El motivo no puede exceder 255 caracteres'
    })
});

const bloqueParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const bloqueQuerySchema = Joi.object({
  profesional_id: Joi.string().uuid().optional(),
  fecha_inicio: Joi.date().iso().optional(),
  fecha_fin: Joi.date().iso().optional()
});

module.exports = {
  // Configuración de agenda
  createAgendaSchema,
  updateAgendaSchema,
  agendaParamsSchema,
  agendaQuerySchema,
  // Bloques no disponibles
  createBloqueSchema,
  updateBloqueSchema,
  bloqueParamsSchema,
  bloqueQuerySchema
};

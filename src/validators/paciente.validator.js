/**
 * PACIENTE.VALIDATOR.JS - Validadores de pacientes
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de pacientes.
 */

const Joi = require('joi');
const { validateDNI, validatePhone, validateEmail, validateDate } = require('../utils/validators');

const createPacienteSchema = Joi.object({
  dni: validateDNI().required().label('DNI')
    .messages({
      'any.required': 'El DNI es requerido',
      'string.empty': 'El DNI no puede estar vacío',
      'string.base': 'El DNI debe ser un texto',
      'any.invalid': 'El DNI no puede estar vacío'
    }),
  nombre: Joi.string().min(2).max(100).required().label('Nombre')
    .messages({
      'string.min': 'El nombre debe tener al menos 2 caracteres',
      'string.max': 'El nombre no puede exceder 100 caracteres',
      'any.required': 'El nombre es requerido',
      'string.empty': 'El nombre no puede estar vacío',
      'string.base': 'El nombre debe ser un texto'
    }),
  apellido: Joi.string().min(2).max(100).required().label('Apellido')
    .messages({
      'string.min': 'El apellido debe tener al menos 2 caracteres',
      'string.max': 'El apellido no puede exceder 100 caracteres',
      'any.required': 'El apellido es requerido',
      'string.empty': 'El apellido no puede estar vacío',
      'string.base': 'El apellido debe ser un texto'
    }),
  fecha_nacimiento: validateDate().optional().allow(null),
  telefono: validatePhone().required().label('Teléfono')
    .messages({
      'any.required': 'El teléfono es requerido',
      'string.empty': 'El teléfono no puede estar vacío',
      'string.base': 'El teléfono debe ser un texto'
    }),
  email: validateEmail().optional().allow(null, ''),
  direccion: Joi.string().max(500).optional().allow(null, ''),
  obra_social: Joi.string().max(100).optional().allow(null, ''),
  numero_afiliado: Joi.string().max(50).optional().allow(null, ''),
  contacto_emergencia_nombre: Joi.string().max(100).optional().allow(null, ''),
  contacto_emergencia_telefono: validatePhone().optional().allow(null, ''),
  activo: Joi.boolean().default(true)
});

const updatePacienteSchema = Joi.object({
  dni: validateDNI().optional(),
  nombre: Joi.string().min(2).max(100).optional(),
  apellido: Joi.string().min(2).max(100).optional(),
  fecha_nacimiento: validateDate().optional().allow(null),
  telefono: validatePhone().optional().allow(null, ''),
  email: validateEmail().optional().allow(null, ''),
  direccion: Joi.string().max(500).optional().allow(null, ''),
  obra_social: Joi.string().max(100).optional().allow(null, ''),
  numero_afiliado: Joi.string().max(50).optional().allow(null, ''),
  contacto_emergencia_nombre: Joi.string().max(100).optional().allow(null, ''),
  contacto_emergencia_telefono: validatePhone().optional().allow(null, ''),
  activo: Joi.boolean().optional()
});

const pacienteParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const searchPacienteSchema = Joi.object({
  q: Joi.string().min(2).required()
    .messages({
      'string.min': 'El término de búsqueda debe tener al menos 2 caracteres',
      'any.required': 'El término de búsqueda es requerido'
    })
});

const pacienteQuerySchema = Joi.object({
  activo: Joi.string().valid('true', 'false').optional(),
  obra_social: Joi.string().optional()
});

const byDniQuerySchema = Joi.object({
  dni: Joi.string().min(6).max(8).pattern(/^\d+$/).required()
    .messages({
      'string.pattern.base': 'El DNI debe contener solo números',
      'string.min': 'El DNI debe tener entre 6 y 8 dígitos',
      'string.max': 'El DNI debe tener entre 6 y 8 dígitos',
      'any.required': 'El DNI es requerido'
    })
});

const addAsignacionBodySchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    })
});

const asignacionParamsSchema = Joi.object({
  id: Joi.string().uuid().required(),
  profesionalId: Joi.string().uuid().required()
});

module.exports = {
  createPacienteSchema,
  updatePacienteSchema,
  pacienteParamsSchema,
  searchPacienteSchema,
  pacienteQuerySchema,
  byDniQuerySchema,
  addAsignacionBodySchema,
  asignacionParamsSchema
};

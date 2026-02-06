/**
 * PROFESIONAL.VALIDATOR.JS - Validadores de profesionales
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de profesionales médicos.
 */

const Joi = require('joi');

// Estados de pago permitidos según la BD
const ESTADOS_PAGO_PROFESIONAL = ['al_dia', 'pendiente', 'moroso'];
const TIPO_PERIODO_PAGO = ['mensual', 'quincenal', 'semanal', 'anual'];

const createProfesionalSchema = Joi.object({
  usuario_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El usuario_id debe ser un UUID válido',
      'any.required': 'El usuario_id es requerido'
    }),
  matricula: Joi.string().max(50).optional().allow(null, ''),
  especialidad: Joi.string().max(100).optional().allow(null, ''),
  estado_pago: Joi.string().valid(...ESTADOS_PAGO_PROFESIONAL).default('al_dia'),
  bloqueado: Joi.boolean().default(false),
  razon_bloqueo: Joi.string().optional().allow(null, ''),
  fecha_ultimo_pago: Joi.date().optional().allow(null),
  fecha_inicio_contrato: Joi.date().iso().optional().allow(null),
  monto_mensual: Joi.number().positive().optional().allow(null),
  tipo_periodo_pago: Joi.string().valid(...TIPO_PERIODO_PAGO).optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const updateProfesionalSchema = Joi.object({
  matricula: Joi.string().max(50).optional().allow(null, ''),
  especialidad: Joi.string().max(100).optional().allow(null, ''),
  estado_pago: Joi.string().valid(...ESTADOS_PAGO_PROFESIONAL).optional(),
  bloqueado: Joi.boolean().optional(),
  razon_bloqueo: Joi.string().optional().allow(null, ''),
  fecha_ultimo_pago: Joi.date().optional().allow(null),
  fecha_inicio_contrato: Joi.date().iso().optional().allow(null),
  monto_mensual: Joi.number().positive().optional().allow(null),
  tipo_periodo_pago: Joi.string().valid(...TIPO_PERIODO_PAGO).optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const blockProfesionalSchema = Joi.object({
  razon_bloqueo: Joi.string().optional().allow(null, '')
});

const profesionalParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const usuarioIdParamsSchema = Joi.object({
  usuarioId: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El usuarioId debe ser un UUID válido',
      'any.required': 'El usuarioId es requerido'
    })
});

const profesionalQuerySchema = Joi.object({
  activo: Joi.string().valid('true', 'false').optional(),
  bloqueado: Joi.string().valid('true', 'false').optional(),
  especialidad: Joi.string().optional(),
  estado_pago: Joi.string().valid(...ESTADOS_PAGO_PROFESIONAL).optional()
});

module.exports = {
  createProfesionalSchema,
  updateProfesionalSchema,
  blockProfesionalSchema,
  profesionalParamsSchema,
  usuarioIdParamsSchema,
  profesionalQuerySchema
};

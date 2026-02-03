/**
 * PAGO.VALIDATOR.JS - Validadores de pagos de profesionales
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de pagos de profesionales.
 */

const Joi = require('joi');
const { ESTADOS_PAGO } = require('../utils/constants');

const createPagoSchema = Joi.object({
  profesional_id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El profesional_id debe ser un UUID válido',
      'any.required': 'El profesional_id es requerido'
    }),
  periodo: Joi.date().required()
    .messages({
      'date.base': 'El periodo debe ser una fecha válida',
      'any.required': 'El periodo es requerido'
    }),
  monto: Joi.number().positive().required()
    .messages({
      'number.base': 'El monto debe ser un número',
      'number.positive': 'El monto debe ser positivo',
      'any.required': 'El monto es requerido'
    }),
  estado: Joi.string().valid(...Object.values(ESTADOS_PAGO)).default(ESTADOS_PAGO.PENDIENTE),
  metodo_pago: Joi.string().max(50).optional().allow(null, ''),
  comprobante_url: Joi.string().uri().optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const updatePagoSchema = Joi.object({
  monto: Joi.number().positive().optional(),
  estado: Joi.string().valid(...Object.values(ESTADOS_PAGO)).optional(),
  metodo_pago: Joi.string().max(50).optional().allow(null, ''),
  comprobante_url: Joi.string().uri().optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const markAsPaidSchema = Joi.object({
  fecha_pago: Joi.date().optional().default(() => new Date()),
  metodo_pago: Joi.string().max(50).optional().allow(null, ''),
  comprobante_url: Joi.string().uri().optional().allow(null, ''),
  observaciones: Joi.string().optional().allow(null, '')
});

const pagoParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
    .messages({
      'string.guid': 'El id debe ser un UUID válido',
      'any.required': 'El id es requerido'
    })
});

const pagoQuerySchema = Joi.object({
  profesional_id: Joi.string().uuid().optional(),
  estado: Joi.string().valid(...Object.values(ESTADOS_PAGO)).optional(),
  periodo_desde: Joi.date().optional(),
  periodo_hasta: Joi.date().optional()
});

module.exports = {
  createPagoSchema,
  updatePagoSchema,
  markAsPaidSchema,
  pagoParamsSchema,
  pagoQuerySchema
};

/**
 * USUARIO.VALIDATOR.JS - Validadores de usuarios
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * CRUD de usuarios.
 */

const Joi = require('joi');
const { validateEmail, validatePassword } = require('../utils/validators');
const { ROLES } = require('../utils/constants');

const createUsuarioSchema = Joi.object({
  email: validateEmail().required()
    .messages({ 'any.required': 'El email es obligatorio para crear un usuario' }),
  password: validatePassword().required(),
  nombre: Joi.string().optional(),
  apellido: Joi.string().optional(),
  telefono: Joi.string().optional(),
  rol: Joi.string().valid(...Object.values(ROLES)).required(),
  activo: Joi.boolean().default(true)
});

const updateUsuarioSchema = Joi.object({
  email: validateEmail().optional(),
  nombre: Joi.string().optional(),
  apellido: Joi.string().optional(),
  telefono: Joi.string().optional(),
  rol: Joi.string().valid(...Object.values(ROLES)).optional(),
  activo: Joi.boolean().optional()
});

const updatePasswordSchema = Joi.object({
  newPassword: validatePassword().required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Las contraseñas no coinciden'
    })
});

const usuarioParamsSchema = Joi.object({
  id: Joi.string().uuid().required()
});

const usuarioQuerySchema = Joi.object({
  rol: Joi.string().valid('administrador', 'profesional', 'secretaria').optional(),
  activo: Joi.string().valid('true', 'false').optional(),
  q: Joi.string().max(200).optional().allow(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

module.exports = {
  createUsuarioSchema,
  updateUsuarioSchema,
  updatePasswordSchema,
  usuarioParamsSchema,
  usuarioQuerySchema
};

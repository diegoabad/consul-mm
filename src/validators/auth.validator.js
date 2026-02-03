/**
 * AUTH.VALIDATOR.JS - Validadores de autenticación
 * 
 * Este archivo contiene esquemas de validación Joi para operaciones
 * de autenticación (login, registro, etc.).
 */

const Joi = require('joi');
const { validateEmail, validatePassword } = require('../utils/validators');
const { ROLES } = require('../utils/constants');

const loginSchema = Joi.object({
  email: validateEmail().required(),
  password: Joi.string().required()
});

const registerSchema = Joi.object({
  email: validateEmail().required(),
  password: validatePassword().required(),
  nombre: Joi.string().optional(),
  apellido: Joi.string().optional(),
  telefono: Joi.string().optional(),
  rol: Joi.string().valid(...Object.values(ROLES)).required()
});

const refreshTokenSchema = Joi.object({
  token: Joi.string().required()
});

const updatePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: validatePassword().required(),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
    .messages({
      'any.only': 'Las contraseñas no coinciden'
    })
});

module.exports = {
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  updatePasswordSchema
};

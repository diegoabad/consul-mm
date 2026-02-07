/**
 * VALIDATORS.JS - Validadores personalizados
 * 
 * Este archivo contiene validadores personalizados que pueden ser
 * reutilizados en diferentes partes de la aplicación.
 */

const Joi = require('joi');

/**
 * Validador de DNI (6-8 dígitos)
 */
const validateDNI = () => {
  return Joi.string().pattern(/^\d{6,8}$/).messages({
    'string.pattern.base': 'El DNI debe tener entre 6 y 8 dígitos',
    'string.empty': 'El DNI no puede estar vacío',
    'string.base': 'El DNI debe ser un texto'
  });
};

/**
 * Validador de teléfono: solo exige más de 5 dígitos (mínimo 6), sin validar formato.
 */
const validatePhone = () => {
  return Joi.string().custom((value, helpers) => {
    if (value == null || value === '') return value;
    const digits = String(value).replace(/\D/g, '');
    if (digits.length < 6) {
      return helpers.error('any.invalid');
    }
    return value;
  }, 'al menos 6 dígitos').messages({
    'any.invalid': 'El teléfono debe tener al menos 6 números',
    'string.empty': 'El teléfono no puede estar vacío',
    'string.base': 'El teléfono debe ser un texto'
  });
};

/**
 * Validador de fecha (no futura)
 */
const validateDate = () => {
  return Joi.date().max('now').iso().messages({
    'date.max': 'La fecha no puede ser futura',
    'date.format': 'La fecha debe tener un formato válido (YYYY-MM-DD)'
  });
};

/**
 * Validador de email
 */
const validateEmail = () => {
  return Joi.string().email().messages({
    'string.email': 'El email debe tener un formato válido',
    'string.empty': 'El email no puede estar vacío',
    'string.base': 'El email debe ser un texto'
  });
};

/**
 * Validador de password (mínimo 8 caracteres)
 */
const validatePassword = () => {
  return Joi.string().min(8).messages({
    'string.min': 'La contraseña debe tener al menos 8 caracteres',
    'string.empty': 'La contraseña no puede estar vacía',
    'string.base': 'La contraseña debe ser un texto'
  });
};

module.exports = {
  validateDNI,
  validatePhone,
  validateDate,
  validateEmail,
  validatePassword
};

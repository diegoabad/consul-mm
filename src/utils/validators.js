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
 * Fecha de nacimiento solo como texto YYYY-MM-DD.
 * No usar Joi.date(): en Node convierte a Date (UTC) y al cifrar con String(date)
 * o al leer en PDF con new Date() se desplaza un día en zonas como America/Argentina/Buenos_Aires.
 */
const validatePacienteFechaNacimiento = () => {
  return Joi.string()
    .allow(null, '')
    .custom((value, helpers) => {
      if (value === null || value === undefined || value === '') return value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return helpers.error('string.pattern.base');
      }
      const [ys, ms, ds] = value.split('-');
      const y = parseInt(ys, 10);
      const m = parseInt(ms, 10);
      const d = parseInt(ds, 10);
      const cal = new Date(y, m - 1, d);
      if (cal.getFullYear() !== y || cal.getMonth() !== m - 1 || cal.getDate() !== d) {
        return helpers.error('date.invalid');
      }
      const now = new Date();
      const todayY = now.getFullYear();
      const todayM = now.getMonth() + 1;
      const todayD = now.getDate();
      if (y > todayY || (y === todayY && m > todayM) || (y === todayY && m === todayM && d > todayD)) {
        return helpers.error('date.max');
      }
      return value;
    })
    .messages({
      'string.pattern.base': 'La fecha debe tener formato YYYY-MM-DD',
      'date.invalid': 'La fecha no es válida',
      'date.max': 'La fecha no puede ser futura'
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
  validatePacienteFechaNacimiento,
  validateEmail,
  validatePassword
};

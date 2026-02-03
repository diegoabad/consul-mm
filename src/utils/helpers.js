/**
 * HELPERS.JS - Funciones auxiliares
 * 
 * Este archivo contiene funciones auxiliares reutilizables en toda la aplicación.
 */

const { format, parseISO, isValid } = require('date-fns');
const { v4: uuidv4 } = require('uuid');

/**
 * Formatear fecha con date-fns
 */
const formatDate = (date, dateFormat = 'yyyy-MM-dd') => {
  if (!date) return null;
  try {
    const dateObj = date instanceof Date ? date : parseISO(date);
    if (!isValid(dateObj)) return null;
    return format(dateObj, dateFormat);
  } catch (error) {
    return null;
  }
};

/**
 * Parsear string a Date
 */
const parseDate = (dateString) => {
  if (!dateString) return null;
  try {
    return parseISO(dateString);
  } catch (error) {
    return null;
  }
};

/**
 * Generar UUID v4
 */
const generateUUID = () => {
  return uuidv4();
};

/**
 * Sanitizar string (remover caracteres peligrosos)
 */
const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[<>]/g, '') // Remover < y >
    .trim();
};

/**
 * Validar formato de email
 */
const validateEmail = (email) => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validar DNI argentino (7-8 dígitos)
 */
const validateDNI = (dni) => {
  if (!dni) return false;
  const dniStr = String(dni).trim();
  const dniRegex = /^\d{7,8}$/;
  return dniRegex.test(dniStr);
};

/**
 * Paginar array
 */
const paginate = (array, page = 1, limit = 10) => {
  const pageNum = Math.max(1, parseInt(page) || 1);
  const limitNum = Math.max(1, parseInt(limit) || 10);
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  
  return {
    data: array.slice(startIndex, endIndex),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: array.length,
      totalPages: Math.ceil(array.length / limitNum),
      hasNext: endIndex < array.length,
      hasPrev: pageNum > 1
    }
  };
};

/**
 * Construir respuesta estándar
 */
const buildResponse = (success, data = null, message = '', error = null) => {
  const response = {
    success,
    ...(data !== null && { data }),
    ...(message && { message }),
    ...(error && { error })
  };
  return response;
};

module.exports = {
  formatDate,
  parseDate,
  generateUUID,
  sanitizeString,
  validateEmail,
  validateDNI,
  paginate,
  buildResponse
};

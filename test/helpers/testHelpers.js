/**
 * TESTHELPERS.JS - Funciones auxiliares para tests
 * 
 * Este archivo contiene funciones auxiliares para los tests.
 */

const jwt = require('jsonwebtoken');
const { ROLES } = require('../../src/utils/constants');

/**
 * Generar token JWT para tests
 */
const generateToken = (userData = {}) => {
  const defaultUser = {
    id: 1,
    email: 'test@example.com',
    rol: ROLES.ADMINISTRADOR,
    ...userData
  };
  
  return jwt.sign(defaultUser, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

/**
 * Crear headers con token de autenticación
 */
const authHeaders = (token) => {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
};

/**
 * Crear usuario de prueba
 */
const createTestUser = (overrides = {}) => {
  return {
    email: 'test@example.com',
    password: 'password123',
    nombre: 'Test',
    apellido: 'User',
    telefono: '1234567890',
    rol: ROLES.ADMINISTRADOR,
    activo: true,
    ...overrides
  };
};

module.exports = {
  generateToken,
  authHeaders,
  createTestUser
};

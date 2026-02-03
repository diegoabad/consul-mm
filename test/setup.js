/**
 * SETUP.JS - Configuración global para tests
 * 
 * Este archivo configura el entorno de testing.
 */

// Cargar .env primero (si existe .env.test, lo usará, sino usa .env)
require('dotenv').config();

// Si existe .env.test, cargarlo también (sobrescribe .env)
try {
  require('dotenv').config({ path: '.env.test', override: false });
} catch (error) {
  // .env.test no existe, usar .env
}

// Configurar variables de entorno para tests si no existen
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_secret_key';
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1h';

// Verificar que las variables de BD estén configuradas
if (!process.env.DB_NAME) {
  console.warn('⚠️  DB_NAME no está configurado. Los tests pueden fallar.');
}

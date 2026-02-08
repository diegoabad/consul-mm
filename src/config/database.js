/**
 * DATABASE.JS - Configuración de PostgreSQL con pg
 * 
 * Este archivo configura el pool de conexiones de PostgreSQL usando
 * la librería pg (node-postgres).
 */

const { Pool } = require('pg');
require('dotenv').config();
const logger = require('../utils/logger');
const { getDbConfig } = require('./db-config');

// Validar que haya configuración (DATABASE_URL o DB_NAME)
if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
  logger.error('Configura DATABASE_URL o DB_NAME (y DB_HOST, DB_USER, DB_PASSWORD) en .env');
  throw new Error('Se requiere DATABASE_URL o variables DB_* en las variables de entorno');
}

const baseConfig = getDbConfig();
const pool = new Pool({
  ...baseConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000
});

// Event listeners del pool: forzar UTF-8 para evitar corrupción de acentos (ej. í -> \u0001)
pool.on('connect', (client) => {
  client.query("SET client_encoding TO 'UTF8'").catch((err) => {
    logger.warn('No se pudo establecer client_encoding UTF8:', err.message);
  });
  logger.info('Nueva conexión a la base de datos establecida');
});

pool.on('error', (err) => {
  logger.error('Error inesperado en el pool de conexiones:', {
    message: err.message,
    code: err.code,
    detail: err.detail
  });
  
  // Si es error de base de datos no encontrada, dar mensaje más claro
  if (err.code === '3D000') {
    const dbName = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).pathname.slice(1) : process.env.DB_NAME;
    logger.error(`La base de datos '${dbName}' no existe. Ejecuta: npm run setup-db (local) o npm run setup-remote (Render)`);
  }
});

/**
 * Función helper para ejecutar queries
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Query ejecutada', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Error ejecutando query:', { text, error: error.message });
    throw error;
  }
};

/**
 * Cerrar pool de conexiones
 */
const closePool = async () => {
  try {
    await pool.end();
    logger.info('Pool de conexiones cerrado correctamente');
  } catch (error) {
    logger.error('Error cerrando pool de conexiones:', error);
    throw error;
  }
};

module.exports = {
  pool,
  query,
  closePool
};

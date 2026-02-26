/**
 * Prueba todas las migraciones desde cero en una base de datos temporal.
 * Crea la DB temporal, aplica schema + todas las migraciones, luego borra la DB.
 * Útil para detectar si alguna migración falla o tiene dependencias incorrectas.
 *
 * Uso (desde la carpeta api):
 *   node scripts/test-migrations.js
 *   npm run test:migrations
 *
 * Requiere .env con DATABASE_URL o DB_* (misma conexión; usa base consultorio_migration_test).
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

const TEST_DB_NAME = 'consultorio_migration_test';

function getPostgresPool() {
  const cfg = getDbConfig();
  return new Pool({
    host: cfg.host,
    port: cfg.port,
    user: cfg.user,
    password: cfg.password,
    database: 'postgres',
    ssl: cfg.ssl,
  });
}

async function run() {
  const hadUrl = !!process.env.DATABASE_URL;
  const originalUrl = process.env.DATABASE_URL;
  const originalDbName = process.env.DB_NAME;

  try {
    if (hadUrl) {
      const url = new URL(originalUrl);
      url.pathname = '/' + TEST_DB_NAME;
      url.searchParams.set('sslmode', url.searchParams.get('sslmode') || '');
      process.env.DATABASE_URL = url.toString();
      delete process.env.DB_NAME;
    } else {
      process.env.DB_NAME = TEST_DB_NAME;
    }
    process.env.ADMIN_EMAIL = '';
    process.env.ADMIN_PASSWORD = '';
    delete process.env.SKIP_BOOTSTRAP;

    const postgresPool = getPostgresPool();
    try {
      await postgresPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
      console.log(`[test-migrations] Base temporal '${TEST_DB_NAME}' creada.`);
    } catch (e) {
      if (e.code === '42P04') {
        await postgresPool.query(`DROP DATABASE ${TEST_DB_NAME}`);
        await postgresPool.query(`CREATE DATABASE ${TEST_DB_NAME}`);
        console.log(`[test-migrations] Base temporal '${TEST_DB_NAME}' recreada.`);
      } else {
        throw e;
      }
    } finally {
      await postgresPool.end();
    }

    const { bootstrap } = require('../src/config/bootstrap-db');
    await bootstrap();
    console.log('[test-migrations] Bootstrap (schema + migraciones) OK.');

    const dropPool = getPostgresPool();
    try {
      await dropPool.query(`DROP DATABASE ${TEST_DB_NAME}`);
      console.log(`[test-migrations] Base temporal '${TEST_DB_NAME}' eliminada.`);
    } finally {
      await dropPool.end();
    }

    console.log('[test-migrations] Todas las migraciones pasaron correctamente.');
  } catch (err) {
    console.error('[test-migrations] Error:', err.message);
    if (err.detail) console.error('  Detalle:', err.detail);
    if (err.where) console.error('  Where:', err.where);
    try {
      const dropPool = getPostgresPool();
      await dropPool.query(`DROP DATABASE IF EXISTS ${TEST_DB_NAME}`);
      await dropPool.end();
      console.log(`[test-migrations] Base temporal '${TEST_DB_NAME}' eliminada tras error.`);
    } catch (dropErr) {
      console.error('[test-migrations] No se pudo borrar la base temporal:', dropErr.message);
    }
    process.exit(1);
  } finally {
    if (hadUrl) process.env.DATABASE_URL = originalUrl;
    else process.env.DB_NAME = originalDbName;
    process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
    process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
  }
}

run();

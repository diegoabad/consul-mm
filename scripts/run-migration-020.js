/**
 * Ejecuta la migración 020: agregar columna evolucion_anterior_id a evoluciones_clinicas.
 *
 * Ejecutar desde la carpeta api: node scripts/run-migration-020.js
 * Requiere .env con DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD (o DATABASE_URL).
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDbConfig } = require('../src/config/db-config');

const pool = new Pool(getDbConfig());

async function run() {
  const client = await pool.connect();
  try {
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'evoluciones_clinicas' AND column_name = 'evolucion_anterior_id'
    `);
    if (colCheck.rows.length > 0) {
      console.log('✅ La tabla evoluciones_clinicas ya tiene la columna evolucion_anterior_id. No hace falta ejecutar la migración.');
      return;
    }
    const migrationPath = path.join(__dirname, '../database/migrations/020_add_evolucion_anterior_id.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 020 aplicada: columna evolucion_anterior_id agregada a evoluciones_clinicas.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});

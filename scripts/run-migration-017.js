/**
 * Ejecuta la migración 017: agregar columna plan a pacientes.
 *
 * Ejecutar desde la carpeta api: node scripts/run-migration-017.js
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
      WHERE table_name = 'pacientes' AND column_name = 'plan'
    `);
    if (colCheck.rows.length > 0) {
      console.log('✅ La tabla pacientes ya tiene la columna plan. No hace falta ejecutar la migración.');
      return;
    }
    const migrationPath = path.join(__dirname, '../database/migrations/017_add_plan_pacientes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 017 aplicada: columna plan agregada a pacientes.');
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

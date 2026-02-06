/**
 * Ejecuta la migración 016: agregar usuario_id a archivos_paciente y hacer profesional_id nullable.
 * Permite que cualquier usuario (profesional, secretaria, administrador) pueda subir archivos.
 *
 * Ejecutar desde la carpeta api: node scripts/run-migration-016.js
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
      WHERE table_name = 'archivos_paciente' AND column_name IN ('usuario_id', 'profesional_id')
    `);
    const hasUsuarioId = colCheck.rows.some(r => r.column_name === 'usuario_id');
    if (hasUsuarioId) {
      console.log('✅ La tabla archivos_paciente ya tiene usuario_id. No hace falta ejecutar la migración.');
      return;
    }
    const migrationPath = path.join(__dirname, '../database/migrations/016_archivos_paciente_usuario_id.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 016 aplicada: archivos_paciente tiene usuario_id y profesional_id nullable.');
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

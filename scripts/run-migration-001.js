/**
 * Ejecuta la migración 001: cambiar notas_paciente de profesional_id a usuario_id.
 * Necesario para que el detalle del paciente cargue las notas sin error de base de datos.
 *
 * Ejecutar desde la carpeta api: node scripts/run-migration-001.js
 * Requiere .env con DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
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
      WHERE table_name = 'notas_paciente' AND column_name IN ('usuario_id', 'profesional_id')
    `);
    const hasUsuarioId = colCheck.rows.some(r => r.column_name === 'usuario_id');
    const hasProfesionalId = colCheck.rows.some(r => r.column_name === 'profesional_id');
    if (hasUsuarioId && !hasProfesionalId) {
      console.log('✅ La tabla notas_paciente ya tiene usuario_id. No hace falta ejecutar la migración.');
      return;
    }
    if (!hasProfesionalId) {
      console.log('✅ La tabla notas_paciente ya está en el esquema esperado.');
      return;
    }
    const migrationPath = path.join(__dirname, '../database/migrations/001_change_notas_to_usuario_id.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 001 aplicada: notas_paciente usa usuario_id.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    if (err.message && err.message.includes('usuario_id')) {
      console.log('\nSi la tabla ya tiene usuario_id (schema actual), no hace falta ejecutar esta migración.');
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

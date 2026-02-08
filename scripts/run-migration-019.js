/**
 * Ejecuta la migración 019: permitir dia_semana = 7 en configuracion_agenda (placeholder "sin días fijos").
 * Ejecutar desde la carpeta api: node scripts/run-migration-019.js
 * (Requiere .env con conexión a la base de datos)
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const { getDbConfig } = require('../src/config/db-config');
const { Pool } = require('pg');
const pool = new Pool(getDbConfig());

async function run() {
  const client = await pool.connect();
  try {
    const migrationPath = path.join(__dirname, '../database/migrations/019_configuracion_agenda_dia_semana_allow_7.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 019 aplicada: dia_semana permite 0-7 (7 = placeholder sin días fijos).');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

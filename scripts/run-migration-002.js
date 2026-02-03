/**
 * Ejecuta la migración 002: agregar estado 'ausente' a turnos.
 * Ejecutar: node scripts/run-migration-002.js
 * (Desde la carpeta api, con .env configurado)
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
    const migrationPath = path.join(__dirname, '../database/migrations/002_turnos_estado_ausente.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 002 aplicada: estado "ausente" agregado a turnos.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

/**
 * Ejecuta la migración 006: agregar fecha_inicio_contrato a profesionales.
 * Ejecutar: node scripts/run-migration-006.js
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
    const migrationPath = path.join(__dirname, '../database/migrations/006_add_fecha_inicio_contrato_profesionales.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 006 aplicada: columna fecha_inicio_contrato agregada a profesionales.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

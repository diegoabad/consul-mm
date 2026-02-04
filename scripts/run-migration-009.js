/**
 * Ejecuta la migración 009: vigencia en configuracion_agenda.
 * Ejecutar: node scripts/run-migration-009.js
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
    const migrationPath = path.join(__dirname, '../database/migrations/009_add_vigencia_configuracion_agenda.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 009 aplicada: vigencia_desde/vigencia_hasta en configuracion_agenda.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

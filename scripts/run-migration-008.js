/**
 * Ejecuta la migración 008: crear tabla excepciones_agenda.
 * Ejecutar: node scripts/run-migration-008.js
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
    const migrationPath = path.join(__dirname, '../database/migrations/008_create_excepciones_agenda.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    await client.query(sql);
    console.log('✅ Migración 008 aplicada: tabla excepciones_agenda creada.');
  } catch (err) {
    console.error('❌ Error ejecutando migración:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

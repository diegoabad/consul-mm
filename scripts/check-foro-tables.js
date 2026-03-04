/**
 * Verifica si las tablas del foro existen en la base de datos.
 * Uso: node scripts/check-foro-tables.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

async function check() {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  try {
    const tables = ['foro_tema', 'foro_post', 'permisos_usuario', 'usuarios'];
    for (const t of tables) {
      const r = await client.query(`
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = $1
      `, [t]);
      console.log(`${t}: ${r.rows.length ? 'EXISTE' : 'NO EXISTE'}`);
    }
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

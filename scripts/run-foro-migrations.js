/**
 * Ejecuta las migraciones del foro (030, 031 y 032) manualmente.
 * Útil cuando schema_migrations las marca como aplicadas pero las tablas no existen.
 *
 * Uso:
 *   node scripts/run-foro-migrations.js          # usa .env (local)
 *   DATABASE_URL=postgresql://... node scripts/run-foro-migrations.js  # base remota (Render, etc.)
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

async function run() {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  try {
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const files = ['030_foro_profesional.sql', '031_foro_post_parent_id.sql', '032_foro_post_indexes.sql'];
    for (const f of files) {
      const filePath = path.join(migrationsDir, f);
      if (!fs.existsSync(filePath)) {
        console.warn(`Archivo no encontrado: ${f}`);
        continue;
      }
      const sql = fs.readFileSync(filePath, 'utf8');
      await client.query(sql);
      console.log(`Aplicado: ${f}`);
    }
    console.log('Migraciones del foro aplicadas correctamente.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

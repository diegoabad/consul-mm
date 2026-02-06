/**
 * Borra todos los turnos y los datos de agendas (configuración, excepciones, bloques).
 * Ejecutar: node scripts/clear-agendas-turnos.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

async function clear() {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  try {
    await client.query('DELETE FROM turnos');
    const r1 = await client.query('SELECT COUNT(*) FROM turnos');
    console.log('Turnos borrados. Restantes:', r1.rows[0].count);

    await client.query('DELETE FROM configuracion_agenda');
    await client.query('DELETE FROM excepciones_agenda');
    await client.query('DELETE FROM bloques_no_disponibles');
    console.log('Agendas (configuración, excepciones, bloques) borradas.');
  } finally {
    client.release();
    await pool.end();
  }
}

clear().then(() => console.log('Listo.')).catch((e) => { console.error(e); process.exit(1); });

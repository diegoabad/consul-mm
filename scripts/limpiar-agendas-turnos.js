/**
 * Script para borrar todas las agendas, turnos y datos relacionados.
 * Útil para pruebas desde cero.
 *
 * Borra (en este orden por posibles FKs):
 *   1. Turnos (evoluciones_clinicas.turno_id queda NULL por ON DELETE SET NULL)
 *   2. Excepciones de agenda (fechas puntuales)
 *   3. Bloques no disponibles
 *   4. Configuración de agenda (incluye vigencia_desde / vigencia_hasta)
 *
 * Ejecutar desde la carpeta api: node scripts/limpiar-agendas-turnos.js
 * Requiere .env con la conexión a la base de datos.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

const pool = new Pool(getDbConfig());

async function run() {
  const client = await pool.connect();
  try {
    console.log('Eliminando datos de agendas, turnos y relacionados...\n');

    const { rowCount: turnos } = await client.query('DELETE FROM turnos');
    console.log(`  Turnos: ${turnos} fila(s) eliminada(s).`);

    const { rowCount: excepciones } = await client.query('DELETE FROM excepciones_agenda');
    console.log(`  Excepciones de agenda: ${excepciones} fila(s) eliminada(s).`);

    const { rowCount: bloques } = await client.query('DELETE FROM bloques_no_disponibles');
    console.log(`  Bloques no disponibles: ${bloques} fila(s) eliminada(s).`);

    const { rowCount: agendas } = await client.query('DELETE FROM configuracion_agenda');
    console.log(`  Configuración de agenda: ${agendas} fila(s) eliminada(s).`);

    console.log('\n✅ Listo. Podés crear agendas y turnos desde cero.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

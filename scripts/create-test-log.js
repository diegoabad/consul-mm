/**
 * CREATE-TEST-LOG.JS - Inserta un log de ejemplo para ver cómo se ve en la página de Logs
 *
 * Ejecutar desde la carpeta api: node scripts/create-test-log.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const logModel = require('../src/models/log.model');
const { closePool } = require('../src/config/database');

async function main() {
  try {
    await logModel.create({
      origen: 'back',
      mensaje: 'Log de prueba desde el backend — script create-test-log.js',
      pantalla: 'N/A',
      accion: 'script',
      ruta: '/api/logs',
      metodo: 'GET',
      rol: 'administrador',
    });
    console.log('✅ Log de origen "back" creado.');

    await logModel.create({
      origen: 'front',
      mensaje: 'Log de prueba desde el frontend (simulado)',
      pantalla: 'Logs',
      accion: 'ver_listado',
      ruta: '/logs',
      metodo: 'GET',
      rol: 'administrador',
    });
    console.log('✅ Log de origen "front" creado.');

    console.log('\nEntrá a la app → Logs para ver cómo se ven.');
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();

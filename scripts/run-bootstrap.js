/**
 * Ejecuta solo el bootstrap (schema + migraciones pendientes + admin).
 * Útil para aplicar migraciones sin levantar el servidor.
 *
 * Uso (desde la carpeta api):
 *   node scripts/run-bootstrap.js
 *   npm run migrate
 *
 * Requiere .env con DATABASE_URL o DB_* (o pasar variables por entorno).
 * No usa SKIP_BOOTSTRAP: siempre ejecuta el bootstrap.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { bootstrap } = require('../src/config/bootstrap-db');

bootstrap()
  .then(() => {
    console.log('Bootstrap finalizado.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Error en bootstrap:', err.message);
    process.exit(1);
  });

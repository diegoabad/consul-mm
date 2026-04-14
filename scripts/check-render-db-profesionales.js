/**
 * Uso: node scripts/check-render-db-profesionales.js
 * Comprueba columna 038 y findAll contra la DB de api/.env (p. ej. Render).
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { query } = require('../src/config/database');
const profesionalModel = require('../src/models/profesional.model');

(async () => {
  try {
    const col = await query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'profesionales'
       AND column_name = 'recordatorio_whatsapp_permitido_admin'`
    );
    console.log(
      'Columna recordatorio_whatsapp_permitido_admin:',
      col.rows.length ? 'EXISTE' : 'NO EXISTE (migración 038 pendiente → 500 en GET /profesionales)'
    );

    const list = await profesionalModel.findAll({ bloqueado: false });
    console.log('findAll({ bloqueado: false }) OK, filas:', list.length);
    process.exit(0);
  } catch (e) {
    console.error('ERROR:', e.message);
    process.exit(1);
  }
})();

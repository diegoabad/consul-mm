/**
 * Migración: descifrar dni, nombre y apellido en pacientes.
 * Convierte datos cifrados a texto plano para búsqueda rápida.
 *
 * IMPORTANTE - Ejecutar sin romper producción:
 * 1. Hacer backup de la base de datos antes de ejecutar
 * 2. Ejecutar en ventana de mantenimiento o con tráfico bajo
 * 3. El script usa transacciones por lote (batch) para minimizar bloqueos
 * 4. Es idempotente: si un registro ya está en texto plano, se omite
 *
 * Uso: node scripts/decrypt-migrate-pacientes.js
 * Requiere: .env con DATA_ENCRYPTION_KEY y DATABASE_URL/DB_*
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { pool, query, closePool } = require('../src/config/database');
const { decrypt, isEncryptionEnabled, ENCRYPTION_PREFIX } = require('../src/utils/encryption');
const logger = require('../src/utils/logger');

const BATCH_SIZE = 50;

function isEncrypted(value) {
  return value && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

/**
 * Ejecuta la migración de descifrado. No cierra el pool (para uso desde server.js).
 * @param {{ useLogger?: boolean }} opts - useLogger: true para usar logger en vez de console
 */
async function runDecryptMigrate(opts = {}) {
  const log = opts.useLogger ? logger.info.bind(logger) : console.log;
  const logErr = opts.useLogger ? logger.error.bind(logger) : console.error;
  if (!isEncryptionEnabled()) {
    log('DATA_ENCRYPTION_KEY no configurada. No hay datos cifrados que migrar.');
    return;
  }

  const countResult = await query(
    `SELECT COUNT(*)::int as total FROM pacientes
     WHERE dni LIKE $1 OR nombre LIKE $1 OR apellido LIKE $1`,
    [ENCRYPTION_PREFIX + '%']
  );
  const totalToMigrate = countResult.rows[0]?.total ?? 0;

  if (totalToMigrate === 0) {
    log('No hay pacientes con dni/nombre/apellido cifrados. Nada que hacer.');
    return;
  }

  log(`Encontrados ${totalToMigrate} pacientes con datos cifrados. Iniciando migración...`);
  log(`(Usando lotes de ${BATCH_SIZE} registros para minimizar bloqueos)`);

  let processed = 0;
  let updated = 0;
  let errors = 0;

  while (true) {
    const batch = await query(
      `SELECT id, dni, nombre, apellido FROM pacientes
       WHERE dni LIKE $1 OR nombre LIKE $1 OR apellido LIKE $1
       LIMIT $2`,
      [ENCRYPTION_PREFIX + '%', BATCH_SIZE]
    );

    if (batch.rows.length === 0) break;

    for (const row of batch.rows) {
      const client = await pool.connect();
      try {
        const plainDni = isEncrypted(row.dni) ? decrypt(row.dni) : row.dni;
        const plainNombre = isEncrypted(row.nombre) ? decrypt(row.nombre) : row.nombre;
        const plainApellido = isEncrypted(row.apellido) ? decrypt(row.apellido) : row.apellido;

        const needsUpdate = isEncrypted(row.dni) || isEncrypted(row.nombre) || isEncrypted(row.apellido);
        if (!needsUpdate) {
          processed++;
          client.release();
          continue;
        }

        await client.query(
          `UPDATE pacientes SET dni = $1, nombre = $2, apellido = $3 WHERE id = $4`,
          [plainDni ?? row.dni, plainNombre ?? row.nombre, plainApellido ?? row.apellido, row.id]
        );
        updated++;
      } catch (err) {
        logErr(`Error en paciente ${row.id}: ${err.message}`);
        errors++;
      } finally {
        client.release();
      }
      processed++;
    }
    if (!opts.useLogger) process.stdout.write(`\rProcesados: ${processed}/${totalToMigrate} | Actualizados: ${updated} | Errores: ${errors}`);
  }

  log('Migración decrypt-migrate-pacientes completada.');
  log(`  Pacientes procesados: ${processed}, actualizados: ${updated}${errors > 0 ? `, errores: ${errors}` : ''}`);
}

// CLI: ejecutar y cerrar pool
if (require.main === module) {
  runDecryptMigrate()
    .then(() => closePool())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

module.exports = { runDecryptMigrate };

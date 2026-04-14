/**
 * Migración: guardar en texto plano el campo `motivo` de turnos que aún están cifrados (prefijo encv1:).
 *
 * Ejecutar ANTES de confiar en que el API ya no descifra motivos al leer (o tras desplegar código que no llama decrypt sobre motivo).
 *
 * IMPORTANTE:
 * - Backup de la base de datos antes de ejecutar.
 * - Requiere la misma DATA_ENCRYPTION_KEY que se usó para cifrar.
 *
 * Uso:
 *   node scripts/migrate-decrypt-turnos-motivo.js           # aplica cambios
 *   node scripts/migrate-decrypt-turnos-motivo.js --dry-run # solo cuenta y muestra muestra
 *
 * Requiere: api/.env con DATA_ENCRYPTION_KEY y DATABASE_URL o DB_*
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/database');
const { decrypt, isEncryptionEnabled, ENCRYPTION_PREFIX } = require('../src/utils/encryption');

function isEncrypted(value) {
  return value != null && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (!isEncryptionEnabled()) {
    console.error('ERROR: DATA_ENCRYPTION_KEY no está definida o es demasiado corta. No se puede descifrar.');
    process.exit(1);
  }

  const prefixPattern = `${ENCRYPTION_PREFIX}%`;
  const countRes = await query(
    `SELECT COUNT(*)::int AS n FROM turnos WHERE motivo IS NOT NULL AND motivo LIKE $1`,
    [prefixPattern]
  );
  const total = countRes.rows[0]?.n ?? 0;

  console.log(`Turnos con motivo cifrado (encv1:): ${total}`);
  if (total === 0) {
    console.log('Nada que migrar.');
    await closePool();
    return;
  }

  if (dryRun) {
    const sample = await query(
      `SELECT id, LEFT(motivo, 40) AS motivo_preview FROM turnos WHERE motivo IS NOT NULL AND motivo LIKE $1 LIMIT 5`,
      [prefixPattern]
    );
    console.log('Muestra (id + inicio del valor):');
    console.table(sample.rows);
    console.log('Modo --dry-run: no se escribió la base. Quitá --dry-run para aplicar.');
    await closePool();
    return;
  }

  const res = await query(
    `SELECT id, motivo FROM turnos WHERE motivo IS NOT NULL AND motivo LIKE $1`,
    [prefixPattern]
  );

  let ok = 0;
  let fail = 0;

  for (const row of res.rows) {
    if (!isEncrypted(row.motivo)) continue;
    const plain = decrypt(row.motivo);
    if (isEncrypted(plain)) {
      console.error(`No se pudo descifrar motivo (clave incorrecta o dato corrupto): id=${row.id}`);
      fail++;
      continue;
    }
    await query(`UPDATE turnos SET motivo = $1 WHERE id = $2`, [plain, row.id]);
    ok++;
    if (ok % 100 === 0) {
      console.log(`  Procesados ${ok}/${res.rows.length}...`);
    }
  }

  console.log(`Listo. Actualizados: ${ok}. Fallidos: ${fail}.`);
  await closePool();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * Script para cifrar datos existentes en la base de datos.
 *
 * Cifra pacientes, evoluciones clínicas y notas que estén en texto plano.
 * Solo procesa registros que NO tienen el prefijo encv1: (ya cifrados).
 *
 * Uso: node scripts/migrate-encrypt-existing-data.js
 * Requiere: .env con DATA_ENCRYPTION_KEY (mín. 16 caracteres) y DATABASE_URL/DB_*
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/database');
const {
  encrypt,
  encryptPacienteRow,
  encryptArchivoRow,
  isEncryptionEnabled,
  PACIENTE_ENCRYPT_FIELDS,
  EVOLUCION_ENCRYPT_FIELDS,
  ARCHIVO_ENCRYPT_FIELDS,
  ENCRYPTION_PREFIX,
  ENCRYPTION_DETERMINISTIC_PREFIX,
} = require('../src/utils/encryption');

function isEncrypted(value) {
  return value && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

function needsEncryption(value) {
  if (value === null || value === undefined) return false;
  const str = String(value);
  return str !== '' && !isEncrypted(str);
}

async function migratePacientes() {
  const res = await query(
    `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
       direccion, obra_social, numero_afiliado, plan,
       contacto_emergencia_nombre, contacto_emergencia_telefono
     FROM pacientes`
  );

  let updated = 0;
  for (const row of res.rows) {
    const hasPlain = PACIENTE_ENCRYPT_FIELDS.some((f) => needsEncryption(row[f]));
    if (!hasPlain) continue;

    const enc = encryptPacienteRow(row);
    await query(
      `UPDATE pacientes SET
        dni = $1, nombre = $2, apellido = $3, fecha_nacimiento = $4, telefono = $5,
        email = $6, direccion = $7, obra_social = $8, numero_afiliado = $9, plan = $10,
        contacto_emergencia_nombre = $11, contacto_emergencia_telefono = $12
       WHERE id = $13`,
      [
        enc.dni, enc.nombre, enc.apellido, enc.fecha_nacimiento, enc.telefono,
        enc.email, enc.direccion, enc.obra_social, enc.numero_afiliado, enc.plan,
        enc.contacto_emergencia_nombre, enc.contacto_emergencia_telefono,
        row.id,
      ]
    );
    updated++;
  }
  return { total: res.rows.length, updated };
}

async function migrateEvoluciones() {
  const res = await query(
    `SELECT id, motivo_consulta, diagnostico, tratamiento, observaciones
     FROM evoluciones_clinicas`
  );

  let updated = 0;
  for (const row of res.rows) {
    const hasPlain = EVOLUCION_ENCRYPT_FIELDS.some((f) => needsEncryption(row[f]));
    if (!hasPlain) continue;

    const encMotivo = needsEncryption(row.motivo_consulta) ? encrypt(row.motivo_consulta) : row.motivo_consulta;
    const encDiag = needsEncryption(row.diagnostico) ? encrypt(row.diagnostico) : row.diagnostico;
    const encTrat = needsEncryption(row.tratamiento) ? encrypt(row.tratamiento) : row.tratamiento;
    const encObs = needsEncryption(row.observaciones) ? encrypt(row.observaciones) : row.observaciones;

    await query(
      `UPDATE evoluciones_clinicas SET
        motivo_consulta = $1, diagnostico = $2, tratamiento = $3, observaciones = $4
       WHERE id = $5`,
      [encMotivo, encDiag, encTrat, encObs, row.id]
    );
    updated++;
  }
  return { total: res.rows.length, updated };
}

async function migrateTurnos() {
  const res = await query(`SELECT id, motivo, razon_cancelacion FROM turnos`);
  let updated = 0;
  for (const row of res.rows) {
    const hasPlain = needsEncryption(row.motivo) || needsEncryption(row.razon_cancelacion);
    if (!hasPlain) continue;

    const encMotivo = needsEncryption(row.motivo) ? encrypt(row.motivo) : row.motivo;
    const encRazon = needsEncryption(row.razon_cancelacion) ? encrypt(row.razon_cancelacion) : row.razon_cancelacion;

    await query(
      `UPDATE turnos SET motivo = $1, razon_cancelacion = $2 WHERE id = $3`,
      [encMotivo, encRazon, row.id]
    );
    updated++;
  }
  return { total: res.rows.length, updated };
}

/**
 * Archivos NO se cifran (por decisión del cliente: permite backups y acceso directo).
 * Se omite la migración de archivos.
 */
async function migrateArchivos() {
  const res = await query(`SELECT COUNT(*)::int as total FROM archivos_paciente`);
  return { total: res.rows[0]?.total ?? 0, updated: 0 };
}

async function migrateNotas() {
  const res = await query(
    `SELECT id, contenido FROM notas_paciente`
  );

  let updated = 0;
  for (const row of res.rows) {
    if (!needsEncryption(row.contenido)) continue;

    const encContenido = encrypt(row.contenido);
    await query(
      `UPDATE notas_paciente SET contenido = $1 WHERE id = $2`,
      [encContenido, row.id]
    );
    updated++;
  }
  return { total: res.rows.length, updated };
}

async function main() {
  console.log('\n=== Migración: cifrar datos existentes ===\n');

  if (!isEncryptionEnabled()) {
    console.log('❌ DATA_ENCRYPTION_KEY no está configurada o tiene menos de 16 caracteres.');
    console.log('   Configurala en api/.env y volvé a ejecutar.\n');
    process.exit(1);
  }

  try {
    console.log('1. Pacientes...');
    const pac = await migratePacientes();
    console.log(`   ${pac.updated} de ${pac.total} actualizados\n`);

    console.log('2. Evoluciones clínicas...');
    const ev = await migrateEvoluciones();
    console.log(`   ${ev.updated} de ${ev.total} actualizados\n`);

    console.log('3. Turnos...');
    const turnos = await migrateTurnos();
    console.log(`   ${turnos.updated} de ${turnos.total} actualizados\n`);

    console.log('4. Archivos de paciente...');
    const archivos = await migrateArchivos();
    console.log(`   ${archivos.updated} de ${archivos.total} actualizados\n`);

    console.log('5. Notas de paciente...');
    const notas = await migrateNotas();
    console.log(`   ${notas.updated} de ${notas.total} actualizados\n`);

    const totalUpdated = pac.updated + ev.updated + turnos.updated + archivos.updated + notas.updated;
    console.log('=== Migración completada ===');
    console.log(`Total de registros cifrados: ${totalUpdated}\n`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();

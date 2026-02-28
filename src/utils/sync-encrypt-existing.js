/**
 * SYNC-ENCRYPT-EXISTING.JS - Cifrar datos existentes en texto plano al arrancar el backend
 *
 * Si DATA_ENCRYPTION_KEY está configurada, busca pacientes, evoluciones, notas y turnos
 * que tengan datos en texto plano (sin prefijo encv1:) y los cifra.
 *
 * Se ejecuta al arrancar el servidor, después del bootstrap.
 * No bloquea el arranque: se ejecuta en background y los errores se loguean.
 */

const { query } = require('../config/database');
const {
  encrypt,
  encryptPacienteRow,
  isEncryptionEnabled,
  PACIENTE_ENCRYPT_FIELDS,
  EVOLUCION_ENCRYPT_FIELDS,
  ENCRYPTION_PREFIX,
} = require('../utils/encryption');
const logger = require('./logger');

function isEncrypted(value) {
  return value && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

function needsEncryption(value) {
  if (value === null || value === undefined) return false;
  const str = String(value);
  return str !== '' && !isEncrypted(str);
}

async function syncPacientes() {
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

async function syncEvoluciones() {
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

async function syncNotas() {
  const res = await query(`SELECT id, contenido FROM notas_paciente`);
  let updated = 0;
  for (const row of res.rows) {
    if (!needsEncryption(row.contenido)) continue;
    const encContenido = encrypt(row.contenido);
    await query(`UPDATE notas_paciente SET contenido = $1 WHERE id = $2`, [encContenido, row.id]);
    updated++;
  }
  return { total: res.rows.length, updated };
}

// Los archivos NO se cifran (por decisión del cliente: permite backups y acceso directo).

async function syncTurnos() {
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
 * Sincroniza datos en texto plano cifrándolos.
 * Solo se ejecuta si DATA_ENCRYPTION_KEY está configurada.
 * @returns {Promise<{ pacientes: Object, evoluciones: Object, notas: Object, turnos: Object }>}
 */
async function syncEncryptExistingData() {
  if (!isEncryptionEnabled()) {
    return null;
  }

  const pac = await syncPacientes();
  const ev = await syncEvoluciones();
  const notas = await syncNotas();
  const turnos = await syncTurnos();

  const totalUpdated = pac.updated + ev.updated + notas.updated + turnos.updated;
  if (totalUpdated > 0) {
    logger.info('Sync encrypt: datos cifrados al arranque', {
      pacientes: pac.updated,
      evoluciones: ev.updated,
      notas: notas.updated,
      turnos: turnos.updated,
      total: totalUpdated,
    });
  } else {
    logger.info('Sync encrypt: verificación completada (todos los datos ya estaban cifrados o no hay datos sensibles).');
  }

  return { pacientes: pac, evoluciones: ev, notas, turnos };
}

module.exports = { syncEncryptExistingData };

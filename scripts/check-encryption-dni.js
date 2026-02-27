/**
 * Script para verificar si los datos del paciente con DNI 12345678
 * y sus evoluciones están encriptados en la base de datos.
 *
 * Uso: node scripts/check-encryption-dni.js
 * Requiere: .env con DATABASE_URL o DB_*
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { query, closePool } = require('../src/config/database');
const {
  encrypt,
  decrypt,
  decryptPacienteRow,
  decryptEvolucionRow,
  decryptTurnoRow,
  isEncryptionEnabled,
  ENCRYPTION_PREFIX,
} = require('../src/utils/encryption');

const TARGET_DNI = process.argv[2] || '12345678';

function isEncrypted(value) {
  return value && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

function truncate(str, maxLen = 80) {
  if (str == null) return str;
  const s = String(str);
  return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
}

async function main() {
  console.log('\n=== Verificación de encriptación para DNI', TARGET_DNI, '===\n');

  const encEnabled = isEncryptionEnabled();
  console.log('DATA_ENCRYPTION_KEY configurada:', encEnabled ? 'SÍ' : 'NO');
  if (!encEnabled) {
    console.log('  (Sin clave, los datos se guardan en texto plano)\n');
  } else {
    console.log('  (Con clave, los datos sensibles se cifran antes de guardar)\n');
  }

  // 1. Buscar paciente
  let pacienteRaw = null;
  if (encEnabled) {
    const allPacientes = await query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo
       FROM pacientes`
    );
    for (const row of allPacientes.rows) {
      const dec = decryptPacienteRow(row);
      if (dec.dni === TARGET_DNI) {
        pacienteRaw = row;
        break;
      }
    }
  } else {
    const res = await query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
        direccion, obra_social, numero_afiliado, plan, contacto_emergencia_nombre,
        contacto_emergencia_telefono, activo
       FROM pacientes WHERE dni = $1`,
      [TARGET_DNI]
    );
    pacienteRaw = res.rows[0] || null;
  }

  if (!pacienteRaw) {
    console.log('❌ No se encontró paciente con DNI', TARGET_DNI);
    console.log('   Creá uno desde la app o usá otro DNI existente.\n');
    process.exit(1);
  }

  const pacienteId = pacienteRaw.id;
  const pacienteDec = decryptPacienteRow(pacienteRaw);

  console.log('--- PACIENTE (id:', pacienteId, ') ---\n');

  const pacienteFields = ['dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'email', 'direccion', 'obra_social'];
  for (const f of pacienteFields) {
    const raw = pacienteRaw[f];
    const dec = pacienteDec[f];
    const enc = isEncrypted(raw);
    console.log(`  ${f}:`);
    console.log(`    En BD (raw):  ${enc ? truncate(raw, 100) : (raw ?? 'null')}`);
    console.log(`    ¿Encriptado?: ${enc ? 'SÍ (encv1:...)' : 'NO (texto plano)'}`);
    if (enc) {
      console.log(`    Descifrado:   ${dec ?? 'null'}`);
    }
    console.log('');
  }

  // 2. Evoluciones del paciente
  const evolucionesRes = await query(
    `SELECT e.id, e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
            e.fecha_consulta, p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni
     FROM evoluciones_clinicas e
     INNER JOIN pacientes p ON e.paciente_id = p.id
     WHERE e.paciente_id = $1
     ORDER BY e.fecha_consulta DESC
     LIMIT 5`,
    [pacienteId]
  );

  // 3. Turnos del paciente
  const turnosRes = await query(
    `SELECT t.id, t.motivo, t.razon_cancelacion, t.fecha_hora_inicio::text as fecha_hora_inicio, t.estado
     FROM turnos t
     WHERE t.paciente_id = $1
     ORDER BY t.fecha_hora_inicio DESC
     LIMIT 5`,
    [pacienteId]
  );

  console.log('--- TURNOS (primeras 5) ---\n');

  if (turnosRes.rows.length === 0) {
    console.log('  No hay turnos para este paciente.\n');
  } else {
    const turnoFields = ['motivo', 'razon_cancelacion'];
    for (let i = 0; i < turnosRes.rows.length; i++) {
      const row = turnosRes.rows[i];
      const dec = decryptTurnoRow(row);
      console.log(`  Turno ${i + 1} (id: ${row.id}, fecha: ${row.fecha_hora_inicio}, estado: ${row.estado})`);
      for (const f of turnoFields) {
        const raw = row[f];
        const enc = isEncrypted(raw);
        console.log(`    ${f}:`);
        console.log(`      En BD (raw):  ${enc ? truncate(raw, 100) : (raw ? truncate(raw, 80) : 'null')}`);
        console.log(`      ¿Encriptado?: ${enc ? 'SÍ' : 'NO'}`);
        if (enc && dec[f]) {
          console.log(`      Descifrado:   ${truncate(dec[f], 80)}`);
        }
        console.log('');
      }
      console.log('  ---');
    }
  }

  console.log('--- EVOLUCIONES CLÍNICAS (primeras 5) ---\n');

  if (evolucionesRes.rows.length === 0) {
    console.log('  No hay evoluciones para este paciente.\n');
  } else {
    for (let i = 0; i < evolucionesRes.rows.length; i++) {
      const row = evolucionesRes.rows[i];
      const dec = decryptEvolucionRow(row);
      console.log(`  Evolución ${i + 1} (id: ${row.id}, fecha: ${row.fecha_consulta})`);
      const evFields = ['motivo_consulta', 'diagnostico', 'tratamiento', 'observaciones'];
      for (const f of evFields) {
        const raw = row[f];
        const enc = isEncrypted(raw);
        console.log(`    ${f}:`);
        console.log(`      En BD (raw):  ${enc ? truncate(raw, 100) : (raw ? truncate(raw, 80) : 'null')}`);
        console.log(`      ¿Encriptado?: ${enc ? 'SÍ' : 'NO'}`);
        if (enc && dec[f]) {
          console.log(`      Descifrado:   ${truncate(dec[f], 80)}`);
        }
        console.log('');
      }
      console.log('  ---');
    }
  }

  // Demo: cómo se ve un valor encriptado vs descifrado (si hay clave)
  if (encEnabled) {
    console.log('\n--- DEMO: Formato encriptado vs descifrado ---\n');
    const ejDni = encrypt('12345678');
    const ejTexto = encrypt('Paciente refiere dolor de cabeza. Diagnóstico: Migraña.');
    console.log('  Ejemplo DNI encriptado en BD:');
    console.log('    ', truncate(ejDni, 120));
    console.log('    Descifrado:', decrypt(ejDni));
    console.log('');
    console.log('  Ejemplo texto evolución encriptado en BD:');
    console.log('    ', truncate(ejTexto, 120));
    console.log('    Descifrado:', truncate(decrypt(ejTexto), 60) + '...');
    console.log('');
  }

  console.log('\n=== Resumen ===');
  const pacienteEncCount = pacienteFields.filter((f) => isEncrypted(pacienteRaw[f])).length;
  const evRows = evolucionesRes.rows;
  const evEncCount = evRows.reduce((acc, r) => {
    return acc + ['motivo_consulta', 'diagnostico', 'tratamiento', 'observaciones'].filter((f) => isEncrypted(r[f])).length;
  }, 0);
  const turnoRows = turnosRes.rows;
  const turnoEncCount = turnoRows.reduce((acc, r) => {
    return acc + ['motivo', 'razon_cancelacion'].filter((f) => isEncrypted(r[f])).length;
  }, 0);
  console.log(`  Paciente: ${pacienteEncCount} campos encriptados de ${pacienteFields.length} sensibles`);
  console.log(`  Turnos: ${turnoEncCount} campos encriptados en ${turnoRows.length} turnos`);
  console.log(`  Evoluciones: ${evEncCount} campos encriptados en ${evRows.length} evoluciones`);
  console.log('');

  await closePool();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});

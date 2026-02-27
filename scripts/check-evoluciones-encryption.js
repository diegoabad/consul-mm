/**
 * CHECK-EVOLUCIONES-ENCRYPTION.JS - Verifica si las evoluciones y datos del paciente
 * con DNI 12345678 están encriptados. Muestra datos crudos (BD) vs descifrados.
 *
 * Ejecutar desde la carpeta api: node scripts/check-evoluciones-encryption.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { query, closePool } = require('../src/config/database');
const { isEncryptionEnabled, decrypt } = require('../src/utils/encryption');
const evolucionModel = require('../src/models/evolucion.model');
const pacienteModel = require('../src/models/paciente.model');

const ENCRYPTION_PREFIX = 'encv1:';

function isEncrypted(value) {
  return value && typeof value === 'string' && value.startsWith(ENCRYPTION_PREFIX);
}

function preview(value, maxLen = 80) {
  if (value == null) return '(null)';
  const s = String(value);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen) + '...';
}

async function main() {
  try {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Verificación de encriptación - Paciente DNI 12345678');
    console.log('  (Datos personales + Evoluciones clínicas)');
    console.log('═══════════════════════════════════════════════════════════════\n');

    const encryptionOn = isEncryptionEnabled();
    console.log('🔐 Estado de encriptación:');
    console.log(`   DATA_ENCRYPTION_KEY definida: ${encryptionOn ? 'SÍ' : 'NO'}`);
    console.log(`   Los datos ${encryptionOn ? 'se cifran' : 'se guardan en claro'} al crear/actualizar.\n`);

    // Buscar paciente por DNI (el modelo maneja búsqueda con/sin encriptación)
    const paciente = await pacienteModel.findByDni('12345678');
    if (!paciente) {
      console.log('❌ No se encontró ningún paciente con DNI 12345678.');
      console.log('   Verificá que exista en la base de datos.\n');
      await closePool();
      process.exit(1);
    }

    // Obtener datos crudos del paciente desde la BD
    const rawPacienteResult = await query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, email,
              direccion, obra_social, numero_afiliado, plan,
              contacto_emergencia_nombre, contacto_emergencia_telefono
       FROM pacientes WHERE id = $1`,
      [paciente.id]
    );
    const rawPaciente = rawPacienteResult.rows[0];

    console.log('👤 Paciente encontrado (ID: ' + paciente.id + ')\n');
    console.log('───────────────────────────────────────────────────────────────');
    console.log('  DATOS PERSONALES - Cómo están en la BD (crudo) vs descifrados');
    console.log('───────────────────────────────────────────────────────────────\n');

    const pacienteFields = [
      'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'email',
      'direccion', 'obra_social', 'numero_afiliado', 'plan',
      'contacto_emergencia_nombre', 'contacto_emergencia_telefono'
    ];
    for (const f of pacienteFields) {
      const rawVal = rawPaciente?.[f];
      const enc = isEncrypted(rawVal);
      const decVal = rawVal != null ? decrypt(rawVal) : null;
      console.log(`  ${f}:`);
      console.log(`    En BD (crudo): ${enc ? 'ENCRIPTADO (encv1:...)' : 'TEXTO PLANO'}`);
      console.log(`    Preview crudo: ${preview(rawVal, 60)}`);
      if (enc && encryptionOn) {
        console.log(`    Descifrado: ${preview(decVal)}`);
      }
      console.log('');
    }

    console.log('───────────────────────────────────────────────────────────────');
    console.log('  DATOS PERSONALES - Tal como los ve la app (modelo descifra)');
    console.log('───────────────────────────────────────────────────────────────\n');
    console.log(`   DNI: ${paciente.dni}`);
    console.log(`   Nombre: ${paciente.nombre} ${paciente.apellido}`);
    console.log(`   Teléfono: ${paciente.telefono || '(vacío)'}`);
    console.log(`   Email: ${paciente.email || '(vacío)'}`);
    console.log(`   Dirección: ${paciente.direccion || '(vacío)'}`);
    console.log(`   Obra social: ${paciente.obra_social || '(vacío)'}\n`);

    console.log('───────────────────────────────────────────────────────────────');
    console.log('  EVOLUCIONES CLÍNICAS - Cómo están en la BD (crudo) vs descifradas');
    console.log('───────────────────────────────────────────────────────────────\n');

    // Obtener evoluciones CRUDAS (sin pasar por decrypt del modelo)
    const rawResult = await query(
      `SELECT e.id, e.paciente_id, e.fecha_consulta,
              e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
              e.fecha_creacion
       FROM evoluciones_clinicas e
       WHERE e.paciente_id = $1
       ORDER BY e.fecha_consulta DESC`,
      [paciente.id]
    );
    const rawRows = rawResult.rows;

    if (rawRows.length === 0) {
      console.log('📋 No hay evoluciones clínicas para este paciente.\n');
      await closePool();
      return;
    }

    console.log(`📋 Evoluciones encontradas: ${rawRows.length}\n`);

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      console.log('───────────────────────────────────────────────────────────────');
      console.log(`Evolución ${i + 1} | ID: ${row.id}`);
      console.log(`Fecha consulta: ${row.fecha_consulta}`);
      console.log('');

      const fields = [
        { name: 'motivo_consulta', value: row.motivo_consulta },
        { name: 'diagnostico', value: row.diagnostico },
        { name: 'tratamiento', value: row.tratamiento },
        { name: 'observaciones', value: row.observaciones },
      ];

      for (const f of fields) {
        const enc = isEncrypted(f.value);
        console.log(`  ${f.name}:`);
        console.log(`    En BD (crudo): ${enc ? 'ENCRIPTADO (encv1:...)' : 'TEXTO PLANO'}`);
        console.log(`    Preview: ${preview(f.value)}`);
        if (enc && encryptionOn) {
          try {
            const dec = decrypt(f.value);
            console.log(`    Descifrado: ${preview(dec)}`);
          } catch (e) {
            console.log(`    Descifrado: ERROR - ${e.message}`);
          }
        }
        console.log('');
      }
    }

    // También mostrar datos descifrados vía modelo (como los vería la app)
    console.log('───────────────────────────────────────────────────────────────');
    console.log('📖 Datos tal como los ve la aplicación (modelo descifra):');
    console.log('───────────────────────────────────────────────────────────────\n');

    const evoluciones = await evolucionModel.findAll({ paciente_id: paciente.id });
    for (let i = 0; i < evoluciones.length; i++) {
      const e = evoluciones[i];
      console.log(`Evolución ${i + 1} (${e.fecha_consulta}):`);
      console.log(`  motivo_consulta: ${preview(e.motivo_consulta)}`);
      console.log(`  diagnostico: ${preview(e.diagnostico)}`);
      console.log(`  tratamiento: ${preview(e.tratamiento)}`);
      console.log(`  observaciones: ${preview(e.observaciones)}`);
      console.log('');
    }

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  Fin del reporte');
    console.log('═══════════════════════════════════════════════════════════════\n');
  } catch (err) {
    console.error('Error:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  } finally {
    await closePool();
  }
}

main();

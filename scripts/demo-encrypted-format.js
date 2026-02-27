/**
 * DEMO: Muestra cómo se ven los datos cuando están encriptados.
 * Ejecutar: DATA_ENCRYPTION_KEY="clave_de_prueba_16chars" node scripts/demo-encrypted-format.js
 *
 * Si no pasás la clave, usa una temporal solo para mostrar el formato.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { encrypt, decrypt, ENCRYPTION_PREFIX } = require('../src/utils/encryption');

// Usar clave de .env o una temporal para la demo (mínimo 16 caracteres)
const key = process.env.DATA_ENCRYPTION_KEY || 'demo_clave_16chars';
process.env.DATA_ENCRYPTION_KEY = key;

function truncate(str, max = 100) {
  if (!str) return str;
  const s = String(str);
  return s.length > max ? s.slice(0, max) + '...' : s;
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('  DEMO: Cómo se ven los datos ENCRIPTADOS en la base de datos');
console.log('═══════════════════════════════════════════════════════════════\n');

console.log('Prefijo que identifica datos cifrados:', ENCRYPTION_PREFIX);
console.log('Formato en BD: prefijo + base64(iv + authTag + ciphertext)\n');

// Ejemplos con datos del paciente DNI 12345678
const ejemplos = [
  { label: 'DNI', valor: '12345678' },
  { label: 'Nombre', valor: 'diego3' },
  { label: 'Apellido', valor: 'abad3' },
  { label: 'Email', valor: 'diegoabad.2289@gmail.com' },
  { label: 'Observación evolución', valor: 'un capo' },
  { label: 'Texto largo (evolución)', valor: 'Paciente refiere dolor de cabeza. Diagnóstico: Migraña común. Tratamiento: Ibuprofeno 400mg cada 8hs.' },
];

console.log('───────────────────────────────────────────────────────────────');
console.log('  Ejemplo: Datos del paciente DNI 12345678');
console.log('───────────────────────────────────────────────────────────────\n');

for (const { label, valor } of ejemplos) {
  const enc = encrypt(valor);
  const dec = decrypt(enc);
  console.log(`${label}:`);
  console.log(`  Original:     "${valor}"`);
  console.log(`  En BD:       ${truncate(enc, 90)}`);
  console.log(`  Descifrado:  "${dec}"`);
  console.log('');
}

console.log('───────────────────────────────────────────────────────────────');
console.log('  Resumen');
console.log('───────────────────────────────────────────────────────────────');
console.log('  • Sin DATA_ENCRYPTION_KEY: los datos se guardan en texto plano.');
console.log('  • Con DATA_ENCRYPTION_KEY: se guardan con prefijo encv1: + base64.');
console.log('  • Al leer, el modelo descifra automáticamente.');
console.log('  • Los datos existentes (creados sin clave) siguen en texto plano.');
console.log('  • Para cifrar datos existentes, hay que ejecutar una migración.\n');

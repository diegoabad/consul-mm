/**
 * DIAGNOSTICO-EMAIL.JS - Verifica variables de email y conexión SMTP
 *
 * Ejecutar desde la carpeta api: node scripts/diagnostico-email.js
 */

const path = require('path');

// Cargar .env desde la carpeta api (independiente del directorio desde donde se ejecute)
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

console.log('--- Diagnóstico de email ---\n');

const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASSWORD;
const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
const port = process.env.EMAIL_PORT || '587';

console.log('Variables de entorno:');
console.log('  EMAIL_USER:', user || '(NO DEFINIDO)');
console.log('  EMAIL_PASSWORD:', pass ? `${pass.length} caracteres` : '(NO DEFINIDO)');
console.log('  EMAIL_HOST:', host);
console.log('  EMAIL_PORT:', port);
console.log('');

if (!user || !pass) {
  console.log('❌ Faltan EMAIL_USER o EMAIL_PASSWORD en el archivo .env');
  console.log('   Asegurate de tener un archivo .env en la carpeta api con esas variables.');
  process.exit(1);
}

async function probarConexion() {
  const { transporter, verifyConnection } = require('../src/config/email');

  console.log('Probando conexión con Gmail (máx 15 segundos)...\n');

  try {
    await Promise.race([
      transporter.verify(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: no hubo respuesta del servidor en 15 segundos')), 15000)
      ),
    ]);
    console.log('✅ Conexión SMTP correcta. El envío de emails debería funcionar.');
  } catch (err) {
    console.log('❌ Error al conectar:');
    console.log('   ', err.message);
    if (err.code) console.log('   Código:', err.code);
    if (err.response) console.log('   Respuesta:', err.response);
    console.log('');
    console.log('Posibles causas:');
    console.log('  - Contraseña de aplicación incorrecta (generala de nuevo en Google → Seguridad → Contraseñas de aplicaciones)');
    console.log('  - Firewall o antivirus bloqueando el puerto 587');
    console.log('  - Cuenta Gmail con verificación en 2 pasos desactivada (necesaria para contraseñas de aplicación)');
    process.exit(1);
  }
}

probarConexion();

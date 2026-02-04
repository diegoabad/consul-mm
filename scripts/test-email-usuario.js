/**
 * TEST-EMAIL-USUARIO.JS - Envía un email de prueba "Usuario creado" a diegoabad.2289@gmail.com
 *
 * Ejecutar desde la raíz del api: node scripts/test-email-usuario.js
 */

const path = require('path');
const fs = require('fs');

// Cargar .env desde la carpeta api
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const emailService = require('../src/services/email.service');

const DESTINO = 'diegoabad.2289@gmail.com';

const datosUsuario = {
  LOGO_URL: process.env.LOGO_URL || 'https://placehold.co/200x50/059669/ffffff?text=Consultorio+Cogniare',
  LOGIN_URL: process.env.LOGIN_URL || 'https://localhost:5173',
  nombre: 'Diego',
  email: 'diegoabad.2289@gmail.com',
  password: 'ContraseñaTemporal123',
};

async function enviarTestUsuario() {
  const templatePath = path.join(__dirname, '..', 'templates', 'usuarios', 'usuario-creado.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  Object.entries(datosUsuario).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  try {
    await emailService.sendEmail({
      to: DESTINO,
      subject: 'Se te creó un usuario - Consultorio',
      text: `Se te creó un usuario. Email: ${datosUsuario.email}, Contraseña: ${datosUsuario.password}. Después de ingresar podés cambiar la contraseña desde tu perfil.`,
      html,
    });
    console.log('✅ Email de usuario creado enviado a', DESTINO);
  } catch (err) {
    console.error('❌ Error enviando email:', err.message);
    if (err.response) console.error('Respuesta:', err.response);
    process.exit(1);
  }
}

enviarTestUsuario();

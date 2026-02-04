/**
 * TEST-EMAIL-TURNO.JS - Envía un email de prueba "Turno asignado" a diegoabad.2289@gmail.com
 *
 * Ejecutar desde la raíz del api: node scripts/test-email-turno.js
 */

const path = require('path');
const fs = require('fs');

// Cargar .env desde la carpeta api
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const emailService = require('../src/services/email.service');

const DESTINO = 'diegoabad.2289@gmail.com';

const datosTurno = {
  paciente_nombre: 'María',
  fecha: '15 de febrero de 2026',
  hora: '10:30',
  profesional_nombre: 'Dr. Juan Pérez',
  profesional_especialidad: 'Clínica médica',
  direccion: process.env.EMAIL_DIRECCION || 'Calle Ejemplo 123, Localidad',
  whatsapp: process.env.EMAIL_WHATSAPP || '11 1234-5678',
  telefono: process.env.EMAIL_TELEFONO || '11 1234-5678',
};

async function enviarTestTurno() {
  const templatePath = path.join(__dirname, '..', 'templates', 'turnos', 'turno-asignado.html');
  let html = fs.readFileSync(templatePath, 'utf8');

  Object.entries(datosTurno).forEach(([key, value]) => {
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), value);
  });

  try {
    await emailService.sendEmail({
      to: DESTINO,
      subject: 'Se te asignó un nuevo turno',
      text: `Se te asignó un turno el día ${datosTurno.fecha} a las ${datosTurno.hora}. Profesional: ${datosTurno.profesional_nombre} (${datosTurno.profesional_especialidad}). En caso de no poder asistir, avisar con 24 horas de anticipación.`,
      html,
    });
    console.log('✅ Email de turno asignado enviado a', DESTINO);
  } catch (err) {
    console.error('❌ Error enviando email:', err.message);
    if (err.response) console.error('Respuesta:', err.response);
    process.exit(1);
  }
}

enviarTestTurno();

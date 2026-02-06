/**
 * TEST-RESEND.JS - Envía email de prueba "Turno asignado" usando solo Resend (sin Nodemailer)
 *
 * Requiere en .env: RESEND_API_KEY (y opcional RESEND_FROM).
 * Para pruebas sin dominio verificado: RESEND_FROM="Consultorio <onboarding@resend.dev>"
 *
 * Ejecutar desde la carpeta api: node scripts/test-resend.js
 */

const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { Resend } = require('resend');

const DESTINO = process.env.TEST_EMAIL_TO || 'diegoabad.2289@gmail.com';
const apiKey = process.env.RESEND_API_KEY;
const from = process.env.RESEND_FROM || 'Consultorio <onboarding@resend.dev>';

// Datos de ejemplo para la plantilla turno-asignado.html
const datosTurno = {
  paciente_nombre: 'María',
  fecha: '15 de febrero de 2026',
  hora: '10:30',
  profesional_nombre: 'Dr. Juan Pérez',
  profesional_especialidad: 'Clínica médica',
  direccion: process.env.EMAIL_DIRECCION || 'Calle y número, Localidad',
  whatsapp: process.env.EMAIL_WHATSAPP || '11 1234-5678',
  telefono: process.env.EMAIL_TELEFONO || '11 1234-5678',
};

function renderTemplate(templatePath, vars) {
  let html = fs.readFileSync(templatePath, 'utf8');
  Object.entries(vars).forEach(([key, value]) => {
    const safe = value == null ? '' : String(value);
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), safe);
  });
  return html;
}

async function enviarTestResend() {
  if (!apiKey) {
    console.error('❌ Falta RESEND_API_KEY en el .env');
    process.exit(1);
  }

  const templatePath = path.join(__dirname, '..', 'templates', 'turnos', 'turno-asignado.html');
  const html = renderTemplate(templatePath, datosTurno);
  const pacienteNombre = datosTurno.paciente_nombre;
  const text = `Hola ${pacienteNombre}, se te asignó un turno el ${datosTurno.fecha} a las ${datosTurno.hora}. Profesional: ${datosTurno.profesional_nombre} (${datosTurno.profesional_especialidad}). En caso de no poder asistir, avisar con 24 horas de anticipación.`;

  const resend = new Resend(apiKey);

  try {
    const { data, error } = await resend.emails.send({
      from,
      to: DESTINO,
      subject: 'Se te asignó un nuevo turno',
      html,
      text,
    });

    if (error) {
      console.error('❌ Error Resend:', error.message);
      if (error.message && error.message.includes('domain')) {
        console.log('\n💡 Para pruebas sin dominio verificado, poné en .env: RESEND_FROM="Consultorio <onboarding@resend.dev>"');
      }
      process.exit(1);
    }

    console.log('✅ Email "Turno asignado" enviado a', DESTINO);
    console.log('   Id:', data?.id || '(sin id)');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

enviarTestResend();

/**
 * EMAIL.SERVICE.JS - Servicio de envío de emails
 *
 * Usa Resend si RESEND_API_KEY está definida (gratis 3000/mes).
 * Si no, usa Nodemailer con SMTP (Gmail, Brevo, etc.).
 */

const path = require('path');
const fs = require('fs');
const { transporter, defaultEmailOptions } = require('../config/email');
const logger = require('../utils/logger');

const TEMPLATES_DIR = path.join(__dirname, '..', '..', 'templates');

/**
 * Cargar plantilla HTML y reemplazar variables {{key}}
 * @param {string} templateName - Ruta relativa a templates (ej. 'turnos/turno-asignado.html')
 * @param {Object} vars - Objeto clave-valor para reemplazar
 * @returns {string} HTML renderizado
 */
const renderTemplate = (templateName, vars = {}) => {
  const templatePath = path.join(TEMPLATES_DIR, templateName);
  let html = fs.readFileSync(templatePath, 'utf8');
  Object.entries(vars).forEach(([key, value]) => {
    const safe = value == null ? '' : String(value);
    html = html.replace(new RegExp(`{{${key}}}`, 'g'), safe);
  });
  return html;
};

const useResend = Boolean(process.env.RESEND_API_KEY);
let resendClient = null;
if (useResend) {
  const { Resend } = require('resend');
  resendClient = new Resend(process.env.RESEND_API_KEY);
}

/**
 * Enviar email genérico
 * @param {Object} options - Opciones del email: to, subject, text, html
 * @returns {Promise<Object>} Información del email enviado
 */
// Remitente permitido por Resend sin verificar dominio (solo para pruebas)
const RESEND_FROM_DEFAULT = 'Consultorio <onboarding@resend.dev>';

const sendEmail = async (options) => {
  const html = options.html || options.text;

  try {
    if (useResend && resendClient) {
      // Resend solo permite enviar desde onboarding@resend.dev o dominios verificados en resend.com/domains
      const from = process.env.RESEND_FROM || RESEND_FROM_DEFAULT;
      const { data, error } = await resendClient.emails.send({
        from: typeof from === 'string' ? from : RESEND_FROM_DEFAULT,
        to: options.to,
        subject: options.subject,
        html: html || undefined,
        text: options.text || undefined,
      });
      if (error) {
        logger.error('Error enviando email (Resend):', error);
        throw new Error(error.message || 'Error al enviar email');
      }
      logger.info(`Email enviado exitosamente a ${options.to} (Resend):`, { id: data?.id });
      return data;
    }

    const mailOptions = {
      from: defaultEmailOptions.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: html || options.text,
    };
    const info = await transporter.sendMail(mailOptions);
    logger.info(`Email enviado exitosamente a ${options.to}:`, { messageId: info.messageId });
    return info;
  } catch (error) {
    logger.error('Error enviando email:', error);
    throw error;
  }
};

/**
 * Enviar email de confirmación/asignación de turno (plantilla turno-asignado.html)
 * @param {Object} turnoData - Turno con paciente_nombre, paciente_apellido, fecha_hora_inicio, profesional_nombre, especialidad, etc.
 * @param {string} pacienteEmail - Email del paciente
 * @returns {Promise<Object>} Información del email enviado
 */
const sendTurnoConfirmation = async (turnoData, pacienteEmail) => {
  const fechaInicio = turnoData.fecha_hora_inicio ? new Date(turnoData.fecha_hora_inicio) : null;
  const fechaStr = fechaInicio ? fechaInicio.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const horaStr = fechaInicio ? fechaInicio.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';
  const pacienteNombre = [turnoData.paciente_nombre, turnoData.paciente_apellido].filter(Boolean).join(' ') || 'Paciente';
  const html = renderTemplate('turnos/turno-asignado.html', {
    paciente_nombre: pacienteNombre,
    fecha: fechaStr,
    hora: horaStr,
    profesional_nombre: turnoData.profesional_nombre && turnoData.profesional_apellido
      ? `${turnoData.profesional_nombre} ${turnoData.profesional_apellido}`.trim()
      : (turnoData.profesional_nombre || 'N/A'),
    profesional_especialidad: turnoData.especialidad || 'N/A',
    direccion: process.env.EMAIL_DIRECCION || 'Consultorio',
    whatsapp: process.env.EMAIL_WHATSAPP || '-',
    telefono: process.env.EMAIL_TELEFONO || '-'
  });
  return await sendEmail({
    to: pacienteEmail,
    subject: 'Se te asignó un nuevo turno',
    text: `Hola ${pacienteNombre}, se te asignó un turno el ${fechaStr} a las ${horaStr}. Profesional: ${turnoData.profesional_nombre || 'N/A'}. Consultorio Cogniare.`,
    html
  });
};

/**
 * Enviar email de recordatorio de turno
 * @param {Object} turnoData - Datos del turno
 * @param {string} pacienteEmail - Email del paciente
 * @returns {Promise<Object>} Información del email enviado
 */
const sendTurnoReminder = async (turnoData, pacienteEmail) => {
  const subject = 'Recordatorio de Turno';
  const text = `
    Hola,
    
    Te recordamos que tienes un turno:
    
    Fecha: ${turnoData.fecha_hora}
    Profesional: ${turnoData.profesional_nombre || 'N/A'}
    
    Te esperamos.
    
    Saludos,
    Consultorio Médico
  `;
  
  return await sendEmail({
    to: pacienteEmail,
    subject,
    text
  });
};

/**
 * Enviar email de cancelación de turno
 * @param {Object} turnoData - Datos del turno (fecha_hora_inicio, profesional_nombre, etc.)
 * @param {string} pacienteEmail - Email del paciente
 * @param {string} motivo - Motivo de la cancelación
 * @returns {Promise<Object>} Información del email enviado
 */
const sendTurnoCancellation = async (turnoData, pacienteEmail, motivo) => {
  const fechaInicio = turnoData.fecha_hora_inicio ? new Date(turnoData.fecha_hora_inicio) : null;
  const fechaStr = fechaInicio ? fechaInicio.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const profNombre = turnoData.profesional_nombre && turnoData.profesional_apellido
    ? `${turnoData.profesional_nombre} ${turnoData.profesional_apellido}`.trim()
    : (turnoData.profesional_nombre || 'N/A');
  const subject = 'Cancelación de Turno';
  const text = `
    Hola,

    Tu turno ha sido cancelado:

    Fecha: ${fechaStr}
    Profesional: ${profNombre}
    Motivo: ${motivo || 'No especificado'}

    Podés agendar un nuevo turno cuando lo desees.

    Saludos,
    Consultorio Cogniare
  `;
  return await sendEmail({
    to: pacienteEmail,
    subject,
    text
  });
};

/**
 * Enviar email de bienvenida (plantilla usuario-creado.html)
 * @param {Object} usuarioData - { nombre, apellido?, email, password }
 * @param {string} email - Email del usuario
 * @returns {Promise<Object>} Información del email enviado
 */
const sendWelcomeEmail = async (usuarioData, email) => {
  const nombre = [usuarioData.nombre, usuarioData.apellido].filter(Boolean).join(' ') || 'Usuario';
  const loginUrl = process.env.LOGIN_URL || process.env.CORS_ORIGIN || 'https://localhost:5173';
  const html = renderTemplate('usuarios/usuario-creado.html', {
    LOGO_URL: process.env.LOGO_URL || 'https://placehold.co/200x50/059669/ffffff?text=Consultorio+Cogniare',
    nombre,
    email: usuarioData.email || email,
    password: usuarioData.password || '(la que elegiste)',
    LOGIN_URL: loginUrl
  });
  return await sendEmail({
    to: email,
    subject: 'Se te creó un usuario - Consultorio Cogniare',
    text: `Hola ${nombre}, se te creó un usuario. Podés acceder con tu email y contraseña en: ${loginUrl}. Consultorio Cogniare.`,
    html
  });
};

module.exports = {
  sendEmail,
  sendTurnoConfirmation,
  sendTurnoReminder,
  sendTurnoCancellation,
  sendWelcomeEmail
};

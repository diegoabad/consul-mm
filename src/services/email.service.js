/**
 * EMAIL.SERVICE.JS - Servicio de envío de emails con Nodemailer
 * 
 * Este servicio maneja el envío de emails usando Nodemailer.
 */

const { transporter, defaultEmailOptions } = require('../config/email');
const logger = require('../utils/logger');

/**
 * Enviar email genérico
 * @param {Object} options - Opciones del email: to, subject, text, html
 * @returns {Promise<Object>} Información del email enviado
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: defaultEmailOptions.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html || options.text
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
 * Enviar email de confirmación de turno
 * @param {Object} turnoData - Datos del turno
 * @param {string} pacienteEmail - Email del paciente
 * @returns {Promise<Object>} Información del email enviado
 */
const sendTurnoConfirmation = async (turnoData, pacienteEmail) => {
  const subject = 'Confirmación de Turno';
  const text = `
    Hola,
    
    Tu turno ha sido confirmado:
    
    Fecha: ${turnoData.fecha_hora}
    Profesional: ${turnoData.profesional_nombre || 'N/A'}
    
    Por favor, confirma tu asistencia.
    
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
 * @param {Object} turnoData - Datos del turno
 * @param {string} pacienteEmail - Email del paciente
 * @param {string} motivo - Motivo de la cancelación
 * @returns {Promise<Object>} Información del email enviado
 */
const sendTurnoCancellation = async (turnoData, pacienteEmail, motivo) => {
  const subject = 'Cancelación de Turno';
  const text = `
    Hola,
    
    Tu turno ha sido cancelado:
    
    Fecha: ${turnoData.fecha_hora}
    Profesional: ${turnoData.profesional_nombre || 'N/A'}
    Motivo: ${motivo || 'No especificado'}
    
    Puedes agendar un nuevo turno cuando lo desees.
    
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
 * Enviar email de bienvenida
 * @param {Object} usuarioData - Datos del usuario
 * @param {string} email - Email del usuario
 * @returns {Promise<Object>} Información del email enviado
 */
const sendWelcomeEmail = async (usuarioData, email) => {
  const subject = 'Bienvenido al Consultorio Médico';
  const text = `
    Hola ${usuarioData.nombre || 'Usuario'},
    
    Bienvenido al sistema del Consultorio Médico.
    
    Tu cuenta ha sido creada exitosamente.
    
    Saludos,
    Consultorio Médico
  `;
  
  return await sendEmail({
    to: email,
    subject,
    text
  });
};

module.exports = {
  sendEmail,
  sendTurnoConfirmation,
  sendTurnoReminder,
  sendTurnoCancellation,
  sendWelcomeEmail
};

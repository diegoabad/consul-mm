/**
 * EMAIL.JS - Configuración de Nodemailer
 * 
 * Este archivo configura el servicio de envío de emails usando Nodemailer.
 */

const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

// Aceptar certificados no verificados (evita "self-signed certificate in certificate chain").
// Si en producción querés verificación estricta, agregá en .env: EMAIL_TLS_REJECT_UNAUTHORIZED=true
const rejectUnauthorized = process.env.EMAIL_TLS_REJECT_UNAUTHORIZED === 'true';

// Configuración del transporter desde variables de entorno
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: process.env.EMAIL_SECURE === 'true', // true para 465, false para otros puertos
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  },
  tls: {
    rejectUnauthorized
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000
});

// Opciones por defecto para emails
const defaultEmailOptions = {
  from: process.env.EMAIL_FROM || process.env.EMAIL_USER || 'noreply@consultorio.com'
};

/**
 * Verificar conexión SMTP
 * @returns {Promise<boolean>} True si la conexión es exitosa
 */
const verifyConnection = async () => {
  try {
    await transporter.verify();
    logger.info('Servidor de email verificado correctamente');
    return true;
  } catch (error) {
    logger.error('Error verificando servidor de email:', error);
    return false;
  }
};

module.exports = {
  transporter,
  verifyConnection,
  defaultEmailOptions
};

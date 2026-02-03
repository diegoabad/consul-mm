/**
 * NOTIFICACIONES.CONTROLLER.JS - Controlador de notificaciones
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con notificaciones del sistema.
 */

const notificacionModel = require('../models/notificacion.model');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar notificaciones con filtros
 */
const getAll = async (req, res, next) => {
  try {
    const { destinatario_email, tipo, estado, relacionado_tipo, relacionado_id } = req.query;
    const filters = {};
    
    if (destinatario_email) filters.destinatario_email = destinatario_email;
    if (tipo) filters.tipo = tipo;
    if (estado) filters.estado = estado;
    if (relacionado_tipo) filters.relacionado_tipo = relacionado_tipo;
    if (relacionado_id) filters.relacionado_id = relacionado_id;
    
    const notificaciones = await notificacionModel.findAll(filters);
    
    res.json(buildResponse(true, notificaciones, 'Notificaciones obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAll notificaciones:', error);
    next(error);
  }
};

/**
 * Obtener notificación por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notificacion = await notificacionModel.findById(id);
    
    if (!notificacion) {
      return res.status(404).json(buildResponse(false, null, 'Notificación no encontrada'));
    }
    
    res.json(buildResponse(true, notificacion, 'Notificación obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getById notificación:', error);
    next(error);
  }
};

/**
 * Obtener notificaciones por email del destinatario
 */
const getByDestinatario = async (req, res, next) => {
  try {
    const { email } = req.params;
    
    // Validar formato de email básico
    if (!email || !email.includes('@')) {
      return res.status(400).json(buildResponse(false, null, 'Email inválido'));
    }
    
    const notificaciones = await notificacionModel.findByDestinatario(email);
    
    res.json(buildResponse(true, notificaciones, 'Notificaciones del destinatario obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByDestinatario notificaciones:', error);
    next(error);
  }
};

/**
 * Obtener notificaciones pendientes
 */
const getPending = async (req, res, next) => {
  try {
    const notificaciones = await notificacionModel.getPending();
    
    res.json(buildResponse(true, notificaciones, 'Notificaciones pendientes obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getPending notificaciones:', error);
    next(error);
  }
};

/**
 * Crear nueva notificación
 */
const create = async (req, res, next) => {
  try {
    const { destinatario_email, asunto, contenido, tipo, relacionado_tipo, relacionado_id } = req.body;
    
    const notificacion = await notificacionModel.create({
      destinatario_email,
      asunto,
      contenido,
      tipo,
      relacionado_tipo,
      relacionado_id
    });
    
    res.status(201).json(buildResponse(true, notificacion, 'Notificación creada exitosamente'));
  } catch (error) {
    logger.error('Error en create notificación:', error);
    next(error);
  }
};

/**
 * Enviar notificación por email
 */
const send = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que la notificación existe
    const notificacion = await notificacionModel.findById(id);
    if (!notificacion) {
      return res.status(404).json(buildResponse(false, null, 'Notificación no encontrada'));
    }
    
    // Si ya está enviada, retornar error
    if (notificacion.estado === 'enviado') {
      return res.status(400).json(buildResponse(false, null, 'La notificación ya fue enviada'));
    }
    
    // Intentar enviar el email
    try {
      await emailService.sendEmail({
        to: notificacion.destinatario_email,
        subject: notificacion.asunto,
        text: notificacion.contenido
      });
      
      // Marcar como enviada
      const fechaEnvio = new Date();
      const notificacionActualizada = await notificacionModel.markAsSent(id, fechaEnvio);
      
      res.json(buildResponse(true, notificacionActualizada, 'Notificación enviada exitosamente'));
    } catch (emailError) {
      // Marcar como fallida
      const errorMensaje = emailError.message || 'Error desconocido al enviar email';
      await notificacionModel.markAsFailed(id, errorMensaje);
      
      logger.error('Error enviando email:', emailError);
      return res.status(500).json(buildResponse(false, null, `Error al enviar email: ${errorMensaje}`));
    }
  } catch (error) {
    logger.error('Error en send notificación:', error);
    next(error);
  }
};

/**
 * Actualizar notificación
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { asunto, contenido, tipo, estado, error_mensaje } = req.body;
    
    // Verificar que la notificación existe
    const notificacionExistente = await notificacionModel.findById(id);
    if (!notificacionExistente) {
      return res.status(404).json(buildResponse(false, null, 'Notificación no encontrada'));
    }
    
    // No permitir actualizar si ya fue enviada
    if (notificacionExistente.estado === 'enviado') {
      return res.status(400).json(buildResponse(false, null, 'No se puede actualizar una notificación ya enviada'));
    }
    
    const notificacion = await notificacionModel.update(id, {
      asunto,
      contenido,
      tipo,
      estado,
      error_mensaje
    });
    
    res.json(buildResponse(true, notificacion, 'Notificación actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update notificación:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByDestinatario,
  getPending,
  create,
  send,
  update
};

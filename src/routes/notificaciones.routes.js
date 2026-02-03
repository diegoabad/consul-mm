/**
 * NOTIFICACIONES.ROUTES.JS - Rutas de notificaciones
 * 
 * Este archivo define todas las rutas relacionadas con notificaciones.
 */

const express = require('express');
const router = express.Router();
const notificacionesController = require('../controllers/notificaciones.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createNotificacionSchema,
  updateNotificacionSchema,
  notificacionParamsSchema,
  notificacionQuerySchema
} = require('../validators/notificacion.validator');

// Rutas específicas deben ir antes de las genéricas

// GET /notificaciones/pending - Notificaciones pendientes
router.get(
  '/pending',
  authenticate,
  requirePermission('notificaciones.leer'),
  validateQuery(notificacionQuerySchema),
  notificacionesController.getPending
);

// GET /notificaciones/destinatario/:email - Notificaciones de un destinatario
router.get(
  '/destinatario/:email',
  authenticate,
  requirePermission('notificaciones.leer'),
  notificacionesController.getByDestinatario
);

// GET /notificaciones/:id - Obtener notificación por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('notificaciones.leer'),
  validateParams(notificacionParamsSchema),
  notificacionesController.getById
);

// GET /notificaciones - Listar notificaciones con filtros
router.get(
  '/',
  authenticate,
  requirePermission('notificaciones.leer'),
  validateQuery(notificacionQuerySchema),
  notificacionesController.getAll
);

// POST /notificaciones - Crear notificación
router.post(
  '/',
  authenticate,
  requirePermission('notificaciones.crear'),
  validateBody(createNotificacionSchema),
  notificacionesController.create
);

// PUT /notificaciones/:id - Actualizar notificación
router.put(
  '/:id',
  authenticate,
  requirePermission('notificaciones.crear'),
  validateParams(notificacionParamsSchema),
  validateBody(updateNotificacionSchema),
  notificacionesController.update
);

// POST /notificaciones/:id/send - Enviar notificación
router.post(
  '/:id/send',
  authenticate,
  requirePermission('notificaciones.enviar'),
  validateParams(notificacionParamsSchema),
  notificacionesController.send
);

module.exports = router;

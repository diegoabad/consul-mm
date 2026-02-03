/**
 * PROFESIONALES.ROUTES.JS - Rutas de profesionales
 * 
 * Este archivo define todas las rutas relacionadas con profesionales médicos.
 */

const express = require('express');
const router = express.Router();
const profesionalesController = require('../controllers/profesionales.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createProfesionalSchema,
  updateProfesionalSchema,
  blockProfesionalSchema,
  profesionalParamsSchema,
  usuarioIdParamsSchema,
  profesionalQuerySchema
} = require('../validators/profesional.validator');

// GET / - Listar profesionales
router.get(
  '/',
  authenticate,
  requirePermission('profesionales.leer'),
  validateQuery(profesionalQuerySchema),
  profesionalesController.getAll
);

// GET /blocked - Obtener profesionales bloqueados
router.get(
  '/blocked',
  authenticate,
  requirePermission('profesionales.leer'),
  profesionalesController.getBlocked
);

// GET /by-user/:usuarioId - Obtener profesional por usuario_id
router.get(
  '/by-user/:usuarioId',
  authenticate,
  requirePermission('profesionales.leer'),
  validateParams(usuarioIdParamsSchema),
  profesionalesController.getByUserId
);

// GET /:id - Obtener profesional por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('profesionales.leer'),
  validateParams(profesionalParamsSchema),
  profesionalesController.getById
);

// POST / - Crear profesional
router.post(
  '/',
  authenticate,
  requirePermission('profesionales.crear'),
  validateBody(createProfesionalSchema),
  profesionalesController.create
);

// PUT /:id - Actualizar profesional
router.put(
  '/:id',
  authenticate,
  requirePermission('profesionales.actualizar'),
  validateParams(profesionalParamsSchema),
  validateBody(updateProfesionalSchema),
  profesionalesController.update
);

// DELETE /:id - Eliminar profesional
router.delete(
  '/:id',
  authenticate,
  requirePermission('profesionales.eliminar'),
  validateParams(profesionalParamsSchema),
  profesionalesController.delete
);

// PATCH /:id/block - Bloquear profesional
router.patch(
  '/:id/block',
  authenticate,
  requirePermission('profesionales.bloquear'),
  validateParams(profesionalParamsSchema),
  validateBody(blockProfesionalSchema),
  profesionalesController.block
);

// PATCH /:id/unblock - Desbloquear profesional
router.patch(
  '/:id/unblock',
  authenticate,
  requirePermission('profesionales.desbloquear'),
  validateParams(profesionalParamsSchema),
  profesionalesController.unblock
);

module.exports = router;

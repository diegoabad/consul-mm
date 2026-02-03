/**
 * PAGOS.ROUTES.JS - Rutas de pagos de profesionales
 * 
 * Este archivo define todas las rutas relacionadas con pagos.
 */

const express = require('express');
const router = express.Router();
const pagosController = require('../controllers/pagos.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createPagoSchema,
  updatePagoSchema,
  markAsPaidSchema,
  pagoParamsSchema,
  pagoQuerySchema
} = require('../validators/pago.validator');

// Rutas específicas deben ir antes de las genéricas

// GET /pagos/pending - Pagos pendientes
router.get(
  '/pending',
  authenticate,
  requirePermission('pagos.leer'),
  validateQuery(pagoQuerySchema),
  pagosController.getPending
);

// GET /pagos/overdue - Pagos vencidos
router.get(
  '/overdue',
  authenticate,
  requirePermission('pagos.leer'),
  validateQuery(pagoQuerySchema),
  pagosController.getOverdue
);

// GET /pagos/profesional/:id - Pagos de un profesional
router.get(
  '/profesional/:id',
  authenticate,
  requirePermission('pagos.leer'),
  validateParams(pagoParamsSchema),
  pagosController.getByProfesional
);

// GET /pagos/:id - Obtener pago por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('pagos.leer'),
  validateParams(pagoParamsSchema),
  pagosController.getById
);

// GET /pagos - Listar pagos con filtros
router.get(
  '/',
  authenticate,
  requirePermission('pagos.leer'),
  validateQuery(pagoQuerySchema),
  pagosController.getAll
);

// POST /pagos - Crear pago
router.post(
  '/',
  authenticate,
  requirePermission('pagos.crear'),
  validateBody(createPagoSchema),
  pagosController.create
);

// PUT /pagos/:id - Actualizar pago
router.put(
  '/:id',
  authenticate,
  requirePermission('pagos.actualizar'),
  validateParams(pagoParamsSchema),
  validateBody(updatePagoSchema),
  pagosController.update
);

// PATCH /pagos/:id/pay - Marcar como pagado
router.patch(
  '/:id/pay',
  authenticate,
  requirePermission('pagos.marcar_pagado'),
  validateParams(pagoParamsSchema),
  validateBody(markAsPaidSchema),
  pagosController.markAsPaid
);

// DELETE /pagos/:id - Eliminar pago
router.delete(
  '/:id',
  authenticate,
  requirePermission('pagos.actualizar'),
  validateParams(pagoParamsSchema),
  pagosController.deletePago
);

module.exports = router;

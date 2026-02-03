/**
 * NOTAS.ROUTES.JS - Rutas de notas de paciente
 * 
 * Este archivo define todas las rutas relacionadas con notas de paciente.
 */

const express = require('express');
const router = express.Router();
const notasController = require('../controllers/notas.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createNotaSchema,
  updateNotaSchema,
  notaParamsSchema,
  notaQuerySchema
} = require('../validators/nota.validator');

// GET / - Listar notas
router.get(
  '/',
  authenticate,
  requirePermission('notas.leer'),
  validateQuery(notaQuerySchema),
  notasController.getAll
);

// GET /paciente/:id - Notas de un paciente
router.get(
  '/paciente/:id',
  authenticate,
  requirePermission('notas.leer'),
  validateParams(notaParamsSchema),
  notasController.getByPaciente
);

// GET /usuario/:id - Notas de un usuario
router.get(
  '/usuario/:id',
  authenticate,
  requirePermission('notas.leer'),
  validateParams(notaParamsSchema),
  notasController.getByUsuario
);

// GET /:id - Obtener nota por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('notas.leer'),
  validateParams(notaParamsSchema),
  notasController.getById
);

// POST / - Crear nota
router.post(
  '/',
  authenticate,
  requirePermission('notas.crear'),
  validateBody(createNotaSchema),
  notasController.create
);

// PUT /:id - Actualizar nota
router.put(
  '/:id',
  authenticate,
  requirePermission('notas.actualizar'),
  validateParams(notaParamsSchema),
  validateBody(updateNotaSchema),
  notasController.update
);

// DELETE /:id - Eliminar nota
router.delete(
  '/:id',
  authenticate,
  requirePermission('notas.eliminar'),
  validateParams(notaParamsSchema),
  notasController.delete
);

module.exports = router;

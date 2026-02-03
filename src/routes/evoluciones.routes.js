/**
 * EVOLUCIONES.ROUTES.JS - Rutas de evoluciones clínicas
 * 
 * Este archivo define todas las rutas relacionadas con evoluciones clínicas.
 */

const express = require('express');
const router = express.Router();
const evolucionesController = require('../controllers/evoluciones.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createEvolucionSchema,
  updateEvolucionSchema,
  evolucionParamsSchema,
  evolucionQuerySchema
} = require('../validators/evolucion.validator');

// GET / - Listar evoluciones clínicas
router.get(
  '/',
  authenticate,
  requirePermission('evoluciones.leer'),
  validateQuery(evolucionQuerySchema),
  evolucionesController.getAll
);

// GET /paciente/:id - Evoluciones de un paciente
router.get(
  '/paciente/:id',
  authenticate,
  requirePermission('evoluciones.leer'),
  validateParams(evolucionParamsSchema),
  validateQuery(evolucionQuerySchema),
  evolucionesController.getByPaciente
);

// GET /profesional/:id - Evoluciones de un profesional
router.get(
  '/profesional/:id',
  authenticate,
  requirePermission('evoluciones.leer'),
  validateParams(evolucionParamsSchema),
  validateQuery(evolucionQuerySchema),
  evolucionesController.getByProfesional
);

// GET /turno/:id - Evoluciones de un turno
router.get(
  '/turno/:id',
  authenticate,
  requirePermission('evoluciones.leer'),
  validateParams(evolucionParamsSchema),
  evolucionesController.getByTurno
);

// GET /:id - Obtener evolución por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('evoluciones.leer'),
  validateParams(evolucionParamsSchema),
  evolucionesController.getById
);

// POST / - Crear evolución clínica
router.post(
  '/',
  authenticate,
  requirePermission('evoluciones.crear'),
  validateBody(createEvolucionSchema),
  evolucionesController.create
);

// PUT /:id - Actualizar evolución clínica
router.put(
  '/:id',
  authenticate,
  requirePermission('evoluciones.actualizar'),
  validateParams(evolucionParamsSchema),
  validateBody(updateEvolucionSchema),
  evolucionesController.update
);

// DELETE /:id - Eliminar evolución clínica
router.delete(
  '/:id',
  authenticate,
  requirePermission('evoluciones.eliminar'),
  validateParams(evolucionParamsSchema),
  evolucionesController.delete
);

module.exports = router;

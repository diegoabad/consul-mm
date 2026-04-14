/**
 * TURNOS.ROUTES.JS - Rutas de turnos médicos
 * 
 * Este archivo define todas las rutas relacionadas con turnos.
 */

const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createTurnoSchema,
  updateTurnoSchema,
  cancelTurnoSchema,
  turnoParamsSchema,
  turnoQuerySchema,
  availabilitySchema,
  previewRecurrenciaSchema,
  createRecurrenciaSchema,
  deleteTurnoQuerySchema,
  validarSlotsBatchSchema
} = require('../validators/turno.validator');

// GET / - Listar turnos
router.get(
  '/',
  authenticate,
  requirePermission('turnos.leer'),
  validateQuery(turnoQuerySchema),
  turnosController.getAll
);

// GET /availability - Verificar disponibilidad
router.get(
  '/availability',
  authenticate,
  requirePermission('turnos.leer'),
  validateQuery(availabilitySchema),
  turnosController.checkAvailability
);

// GET /profesional/:id - Turnos de un profesional
router.get(
  '/profesional/:id',
  authenticate,
  requirePermission('turnos.leer'),
  validateParams(turnoParamsSchema),
  validateQuery(turnoQuerySchema),
  turnosController.getByProfesional
);

// GET /paciente/:id - Turnos de un paciente
router.get(
  '/paciente/:id',
  authenticate,
  requirePermission('turnos.leer'),
  validateParams(turnoParamsSchema),
  validateQuery(turnoQuerySchema),
  turnosController.getByPaciente
);

// GET /:id - Obtener turno por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('turnos.leer'),
  validateParams(turnoParamsSchema),
  turnosController.getById
);

// POST / - Crear turno
router.post(
  '/',
  authenticate,
  requirePermission('turnos.crear'),
  validateBody(createTurnoSchema),
  turnosController.create
);

// POST /recurrencia/preview — preview de ocurrencias (sin persistir)
router.post(
  '/recurrencia/preview',
  authenticate,
  requirePermission('turnos.crear'),
  validateBody(previewRecurrenciaSchema),
  turnosController.previewRecurrencia
);

// POST /slots/validar-batch — revalidar uno o más intervalos (vista previa al cambiar fecha/hora)
router.post(
  '/slots/validar-batch',
  authenticate,
  requirePermission('turnos.crear'),
  validateBody(validarSlotsBatchSchema),
  turnosController.validarSlotsBatch
);

// POST /recurrencia — crear serie + turnos
router.post(
  '/recurrencia',
  authenticate,
  requirePermission('turnos.crear'),
  validateBody(createRecurrenciaSchema),
  turnosController.createRecurrencia
);

// PUT /:id - Actualizar turno
router.put(
  '/:id',
  authenticate,
  requirePermission('turnos.actualizar'),
  validateParams(turnoParamsSchema),
  validateBody(updateTurnoSchema),
  turnosController.update
);

// PATCH /:id/cancel - Cancelar turno
router.patch(
  '/:id/cancel',
  authenticate,
  requirePermission('turnos.cancelar'),
  validateParams(turnoParamsSchema),
  validateBody(cancelTurnoSchema),
  turnosController.cancel
);

// PATCH /:id/confirm - Confirmar turno
router.patch(
  '/:id/confirm',
  authenticate,
  requirePermission('turnos.confirmar'),
  validateParams(turnoParamsSchema),
  turnosController.confirm
);

// PATCH /:id/complete - Completar turno
router.patch(
  '/:id/complete',
  authenticate,
  requirePermission('turnos.completar'),
  validateParams(turnoParamsSchema),
  turnosController.complete
);

// DELETE /:id - Eliminar turno
router.delete(
  '/:id',
  authenticate,
  requirePermission('turnos.eliminar'),
  validateParams(turnoParamsSchema),
  validateQuery(deleteTurnoQuerySchema),
  turnosController.delete
);

module.exports = router;

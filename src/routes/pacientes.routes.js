/**
 * PACIENTES.ROUTES.JS - Rutas de pacientes
 * 
 * Este archivo define todas las rutas relacionadas con pacientes.
 */

const express = require('express');
const router = express.Router();
const pacientesController = require('../controllers/pacientes.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createPacienteSchema,
  updatePacienteSchema,
  pacienteParamsSchema,
  searchPacienteSchema,
  pacienteQuerySchema,
  byDniQuerySchema,
  addAsignacionBodySchema,
  asignacionParamsSchema
} = require('../validators/paciente.validator');

// GET / - Listar pacientes
router.get(
  '/',
  authenticate,
  requirePermission('pacientes.leer'),
  validateQuery(pacienteQuerySchema),
  pacientesController.getAll
);

// GET /search - Buscar pacientes
router.get(
  '/search',
  authenticate,
  requirePermission('pacientes.buscar'),
  validateQuery(searchPacienteSchema),
  pacientesController.search
);

// GET /by-dni - Obtener paciente por DNI (debe ir antes de /:id)
router.get(
  '/by-dni',
  authenticate,
  requirePermission('pacientes.leer'),
  validateQuery(byDniQuerySchema),
  pacientesController.getByDni
);

// GET /:id/asignaciones - Listar profesionales asignados al paciente
router.get(
  '/:id/asignaciones',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(pacienteParamsSchema),
  pacientesController.listAsignaciones
);

// POST /:id/asignaciones - Asignar profesional al paciente
router.post(
  '/:id/asignaciones',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(pacienteParamsSchema),
  validateBody(addAsignacionBodySchema),
  pacientesController.addAsignacion
);

// DELETE /:id/asignaciones/:profesionalId - Quitar asignación
router.delete(
  '/:id/asignaciones/:profesionalId',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(asignacionParamsSchema),
  pacientesController.removeAsignacion
);

// GET /:id - Obtener paciente por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('pacientes.leer'),
  validateParams(pacienteParamsSchema),
  pacientesController.getById
);

// POST / - Crear paciente
router.post(
  '/',
  authenticate,
  requirePermission('pacientes.crear'),
  validateBody(createPacienteSchema),
  pacientesController.create
);

// PUT /:id - Actualizar paciente
router.put(
  '/:id',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(pacienteParamsSchema),
  validateBody(updatePacienteSchema),
  pacientesController.update
);

// DELETE /:id - Eliminar paciente
router.delete(
  '/:id',
  authenticate,
  requirePermission('pacientes.eliminar'),
  validateParams(pacienteParamsSchema),
  pacientesController.delete
);

// PATCH /:id/activate - Activar paciente
router.patch(
  '/:id/activate',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(pacienteParamsSchema),
  pacientesController.activate
);

// PATCH /:id/deactivate - Desactivar paciente
router.patch(
  '/:id/deactivate',
  authenticate,
  requirePermission('pacientes.actualizar'),
  validateParams(pacienteParamsSchema),
  pacientesController.deactivate
);

module.exports = router;

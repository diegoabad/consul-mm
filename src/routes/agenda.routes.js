/**
 * AGENDA.ROUTES.JS - Rutas de agenda
 * 
 * Este archivo define todas las rutas relacionadas con configuración de agenda
 * y bloques no disponibles.
 */

const express = require('express');
const router = express.Router();
const agendaController = require('../controllers/agenda.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const {
  createAgendaSchema,
  updateAgendaSchema,
  agendaParamsSchema,
  agendaQuerySchema,
  guardarHorariosSemanaSchema,
  createBloqueSchema,
  updateBloqueSchema,
  bloqueParamsSchema,
  bloqueQuerySchema,
  createExcepcionSchema,
  updateExcepcionSchema,
  excepcionParamsSchema,
  excepcionQuerySchema
} = require('../validators/agenda.validator');

// ============================================
// RUTAS PARA CONFIGURACIÓN DE AGENDA
// ============================================

// GET / - Listar configuraciones de agenda
router.get(
  '/',
  authenticate,
  requirePermission('agenda.leer'),
  validateQuery(agendaQuerySchema),
  agendaController.getAllAgenda
);

// GET /profesional/:id - Configuraciones de agenda de un profesional
router.get(
  '/profesional/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(agendaParamsSchema),
  validateQuery(agendaQuerySchema),
  agendaController.getAgendaByProfesional
);

// PUT /profesional/:id/horarios-semana - Guardar horarios de la semana (cierra periodo vigente y crea nuevos)
router.put(
  '/profesional/:id/horarios-semana',
  authenticate,
  requirePermission('agenda.crear'),
  validateParams(agendaParamsSchema),
  validateBody(guardarHorariosSemanaSchema),
  agendaController.guardarHorariosSemana
);

// ============================================
// RUTAS PARA BLOQUES NO DISPONIBLES (ANTES DE /:id)
// ============================================

// GET /bloques - Listar bloques no disponibles
router.get(
  '/bloques',
  authenticate,
  requirePermission('agenda.leer'),
  validateQuery(bloqueQuerySchema),
  agendaController.getAllBloques
);

// GET /bloques/profesional/:id - Bloques no disponibles de un profesional
router.get(
  '/bloques/profesional/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(bloqueParamsSchema),
  validateQuery(bloqueQuerySchema),
  agendaController.getBloquesByProfesional
);

// GET /bloques/:id - Obtener bloque no disponible por ID
router.get(
  '/bloques/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(bloqueParamsSchema),
  agendaController.getBloqueById
);

// POST /bloques - Crear bloque no disponible
router.post(
  '/bloques',
  authenticate,
  requirePermission('agenda.bloques.crear'),
  validateBody(createBloqueSchema),
  agendaController.createBloque
);

// PUT /bloques/:id - Actualizar bloque no disponible
router.put(
  '/bloques/:id',
  authenticate,
  requirePermission('agenda.bloques.crear'),
  validateParams(bloqueParamsSchema),
  validateBody(updateBloqueSchema),
  agendaController.updateBloque
);

// DELETE /bloques/:id - Eliminar bloque no disponible
router.delete(
  '/bloques/:id',
  authenticate,
  requirePermission('agenda.bloques.eliminar'),
  validateParams(bloqueParamsSchema),
  agendaController.deleteBloque
);

// ============================================
// RUTAS PARA EXCEPCIONES DE AGENDA (ANTES de /:id)
// ============================================

// GET /excepciones - Listar excepciones con filtros
router.get(
  '/excepciones',
  authenticate,
  requirePermission('agenda.leer'),
  validateQuery(excepcionQuerySchema),
  agendaController.getAllExcepciones
);

// GET /excepciones/profesional/:id - Excepciones de un profesional
router.get(
  '/excepciones/profesional/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(excepcionParamsSchema),
  validateQuery(excepcionQuerySchema),
  agendaController.getExcepcionesByProfesional
);

// GET /excepciones/:id - Obtener excepción por ID
router.get(
  '/excepciones/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(excepcionParamsSchema),
  agendaController.getExcepcionById
);

// POST /excepciones - Crear excepción
router.post(
  '/excepciones',
  authenticate,
  requirePermission('agenda.excepciones.crear'),
  validateBody(createExcepcionSchema),
  agendaController.createExcepcion
);

// PUT /excepciones/:id - Actualizar excepción
router.put(
  '/excepciones/:id',
  authenticate,
  requirePermission('agenda.excepciones.actualizar'),
  validateParams(excepcionParamsSchema),
  validateBody(updateExcepcionSchema),
  agendaController.updateExcepcion
);

// DELETE /excepciones/:id - Eliminar excepción
router.delete(
  '/excepciones/:id',
  authenticate,
  requirePermission('agenda.excepciones.eliminar'),
  validateParams(excepcionParamsSchema),
  agendaController.deleteExcepcion
);

// GET /:id - Obtener configuración de agenda por ID (DESPUÉS de /bloques)
router.get(
  '/:id',
  authenticate,
  requirePermission('agenda.leer'),
  validateParams(agendaParamsSchema),
  agendaController.getAgendaById
);

// POST / - Crear configuración de agenda
router.post(
  '/',
  authenticate,
  requirePermission('agenda.crear'),
  validateBody(createAgendaSchema),
  agendaController.createAgenda
);

// PUT /:id - Actualizar configuración de agenda
router.put(
  '/:id',
  authenticate,
  requirePermission('agenda.actualizar'),
  validateParams(agendaParamsSchema),
  validateBody(updateAgendaSchema),
  agendaController.updateAgenda
);

// DELETE /:id - Eliminar configuración de agenda
router.delete(
  '/:id',
  authenticate,
  requirePermission('agenda.eliminar'),
  validateParams(agendaParamsSchema),
  agendaController.deleteAgenda
);

// PATCH /:id/activate - Activar configuración de agenda
router.patch(
  '/:id/activate',
  authenticate,
  requirePermission('agenda.actualizar'),
  validateParams(agendaParamsSchema),
  agendaController.activateAgenda
);

// PATCH /:id/deactivate - Desactivar configuración de agenda
router.patch(
  '/:id/deactivate',
  authenticate,
  requirePermission('agenda.actualizar'),
  validateParams(agendaParamsSchema),
  agendaController.deactivateAgenda
);

module.exports = router;

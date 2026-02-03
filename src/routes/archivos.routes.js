/**
 * ARCHIVOS.ROUTES.JS - Rutas de archivos
 * 
 * Este archivo define todas las rutas relacionadas con archivos de paciente.
 */

const express = require('express');
const router = express.Router();
const archivosController = require('../controllers/archivos.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validate.middleware');
const { uploadSingle, handleMulterError } = require('../middlewares/upload.middleware');
const {
  createArchivoSchema,
  updateArchivoSchema,
  archivoParamsSchema,
  archivoQuerySchema
} = require('../validators/archivo.validator');

// GET / - Listar archivos
router.get(
  '/',
  authenticate,
  requirePermission('archivos.leer'),
  validateQuery(archivoQuerySchema),
  archivosController.getAll
);

// GET /paciente/:id - Archivos de un paciente
router.get(
  '/paciente/:id',
  authenticate,
  requirePermission('archivos.leer'),
  validateParams(archivoParamsSchema),
  archivosController.getByPaciente
);

// GET /:id/download - Descargar archivo (ANTES de /:id para evitar conflictos)
router.get(
  '/:id/download',
  authenticate,
  requirePermission('archivos.descargar'),
  validateParams(archivoParamsSchema),
  archivosController.download
);

// GET /:id - Obtener archivo por ID
router.get(
  '/:id',
  authenticate,
  requirePermission('archivos.leer'),
  validateParams(archivoParamsSchema),
  archivosController.getById
);

// POST / - Subir archivo
router.post(
  '/',
  authenticate,
  requirePermission('archivos.subir'),
  uploadSingle('archivo'),
  handleMulterError,
  validateBody(createArchivoSchema),
  archivosController.upload
);

// PUT /:id - Actualizar metadatos de archivo
router.put(
  '/:id',
  authenticate,
  requirePermission('archivos.leer'), // Usar leer para actualizar metadatos
  validateParams(archivoParamsSchema),
  validateBody(updateArchivoSchema),
  archivosController.update
);

// DELETE /:id - Eliminar archivo
router.delete(
  '/:id',
  authenticate,
  requirePermission('archivos.eliminar'),
  validateParams(archivoParamsSchema),
  archivosController.delete
);

module.exports = router;

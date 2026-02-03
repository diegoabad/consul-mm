/**
 * USUARIOS.ROUTES.JS - Rutas de usuarios
 * 
 * Este archivo define todas las rutas relacionadas con usuarios.
 */

const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { validateBody, validateParams } = require('../middlewares/validate.middleware');
const {
  createUsuarioSchema,
  updateUsuarioSchema,
  updatePasswordSchema,
  usuarioParamsSchema
} = require('../validators/usuario.validator');

// GET / - Listar usuarios
router.get('/', authenticate, requirePermission('usuarios.leer'), usuariosController.getAll);

// GET /:id - Obtener usuario
router.get('/:id', authenticate, requirePermission('usuarios.leer'), validateParams(usuarioParamsSchema), usuariosController.getById);

// POST / - Crear usuario
router.post('/', authenticate, requirePermission('usuarios.crear'), validateBody(createUsuarioSchema), usuariosController.create);

// PUT /:id - Actualizar usuario
router.put('/:id', authenticate, requirePermission('usuarios.actualizar'), validateParams(usuarioParamsSchema), validateBody(updateUsuarioSchema), usuariosController.update);

// DELETE /:id - Eliminar usuario
router.delete('/:id', authenticate, requirePermission('usuarios.eliminar'), validateParams(usuarioParamsSchema), usuariosController.delete);

// PATCH /:id/activate - Activar usuario
router.patch('/:id/activate', authenticate, requirePermission('usuarios.activar'), validateParams(usuarioParamsSchema), usuariosController.activate);

// PATCH /:id/deactivate - Desactivar usuario
router.patch('/:id/deactivate', authenticate, requirePermission('usuarios.desactivar'), validateParams(usuarioParamsSchema), usuariosController.deactivate);

// PATCH /:id/password - Actualizar password
router.patch('/:id/password', authenticate, validateParams(usuarioParamsSchema), validateBody(updatePasswordSchema), usuariosController.updatePassword);

module.exports = router;

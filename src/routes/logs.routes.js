/**
 * LOGS.ROUTES.JS - Rutas de logs de errores
 * POST = crear (opcional auth para asociar usuario); GET = listar (solo admin).
 */

const express = require('express');
const router = express.Router();
const logsController = require('../controllers/logs.controller');
const { authenticate, optionalAuth } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permissions.middleware');

// POST / - Crear log (frontend o interno). Auth opcional para identificar usuario.
router.post('/', optionalAuth, logsController.create);

// GET / - Listar logs con filtros (solo administrador)
router.get('/', authenticate, requireRole('administrador'), logsController.list);

// DELETE / - Borrar todos los logs (solo administrador)
router.delete('/', authenticate, requireRole('administrador'), logsController.deleteAll);
// DELETE /:id - Borrar un log por id (solo administrador)
router.delete('/:id', authenticate, requireRole('administrador'), logsController.deleteOne);

module.exports = router;

const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { list, enviarManual } = require('../controllers/recordatorios.controller');

// GET  /api/recordatorios             → listado con filtros (solo admin)
router.get('/', authenticate, requirePermission('usuarios.leer'), list);

// POST /api/recordatorios/turno/:id/enviar → envío manual (solo admin)
router.post('/turno/:id/enviar', authenticate, requirePermission('usuarios.leer'), enviarManual);

module.exports = router;

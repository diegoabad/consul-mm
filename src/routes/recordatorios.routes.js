const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permissions.middleware');
const { list, enviarManual } = require('../controllers/recordatorios.controller');

// Misma regla que GET /api/logs: solo administrador (evita 403 si hay permisos personalizados raros en usuarios.leer)
// GET  /api/recordatorios             → listado con filtros
router.get('/', authenticate, requireRole('administrador'), list);

// POST /api/recordatorios/turno/:id/enviar → envío manual
router.post('/turno/:id/enviar', authenticate, requireRole('administrador'), enviarManual);

module.exports = router;

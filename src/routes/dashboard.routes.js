const express = require('express');
const router = express.Router();
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const { getStats } = require('../controllers/dashboard.controller');

// GET /api/dashboard/stats  → solo administradores
router.get('/stats', authenticate, requirePermission('usuarios.leer'), getStats);

module.exports = router;

const express = require('express');
const router = express.Router();
const obraSocialController = require('../controllers/obra-social.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET / - Obtener todas las obras sociales
router.get('/', obraSocialController.getAll);

// GET /:id - Obtener obra social por ID
router.get('/:id', obraSocialController.getById);

// POST / - Crear nueva obra social (requiere permiso)
router.post('/', requirePermission('obras_sociales.crear'), obraSocialController.create);

// PUT /:id - Actualizar obra social (requiere permiso)
router.put('/:id', requirePermission('obras_sociales.actualizar'), obraSocialController.update);

// DELETE /:id - Eliminar obra social (borrado permanente, requiere permiso)
router.delete('/:id', requirePermission('obras_sociales.eliminar'), obraSocialController.delete);

module.exports = router;

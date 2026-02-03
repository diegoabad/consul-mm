const express = require('express');
const router = express.Router();
const especialidadController = require('../controllers/especialidad.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');

// Todas las rutas requieren autenticación
router.use(authenticate);

// GET / - Obtener todas las especialidades
router.get('/', especialidadController.getAll);

// GET /:id - Obtener especialidad por ID
router.get('/:id', especialidadController.getById);

// POST / - Crear nueva especialidad (requiere permiso)
router.post('/', requirePermission('especialidades.crear'), especialidadController.create);

// PUT /:id - Actualizar especialidad (requiere permiso)
router.put('/:id', requirePermission('especialidades.actualizar'), especialidadController.update);

// DELETE /:id - Eliminar especialidad (borrado permanente, requiere permiso)
router.delete('/:id', requirePermission('especialidades.eliminar'), especialidadController.delete);

module.exports = router;

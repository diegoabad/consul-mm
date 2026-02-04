/**
 * AUTH.ROUTES.JS - Rutas de autenticación
 * 
 * Este archivo define todas las rutas relacionadas con autenticación.
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const { requireRole } = require('../middlewares/permissions.middleware');
const { validateBody } = require('../middlewares/validate.middleware');
const { loginSchema, registerSchema, updateProfileSchema, updateMyPasswordSchema } = require('../validators/auth.validator');
const { ROLES } = require('../utils/constants');

// POST /login - Login de usuario
router.post('/login', validateBody(loginSchema), authController.login);

// POST /register - Registrar usuario (solo admin)
router.post('/register', authenticate, requireRole(ROLES.ADMINISTRADOR), validateBody(registerSchema), authController.register);

// GET /profile - Obtener perfil del usuario autenticado
router.get('/profile', authenticate, authController.getProfile);

// PATCH /profile - Actualizar perfil propio (nombre, apellido, email, telefono)
router.patch('/profile', authenticate, validateBody(updateProfileSchema), authController.updateProfile);

// PATCH /profile/password - Cambiar contraseña del usuario autenticado
router.patch('/profile/password', authenticate, validateBody(updateMyPasswordSchema), authController.updateMyPassword);

module.exports = router;

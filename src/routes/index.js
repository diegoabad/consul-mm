/**
 * INDEX.JS - Centraliza todas las rutas
 * 
 * Este archivo centraliza todas las rutas de la API y las monta
 * en la aplicación Express.
 */

const express = require('express');
const router = express.Router();

// Importar rutas
const authRoutes = require('./auth.routes');
const usuariosRoutes = require('./usuarios.routes');
const profesionalesRoutes = require('./profesionales.routes');
const pacientesRoutes = require('./pacientes.routes');
const turnosRoutes = require('./turnos.routes');
const agendaRoutes = require('./agenda.routes');
const evolucionesRoutes = require('./evoluciones.routes');
const archivosRoutes = require('./archivos.routes');
const notasRoutes = require('./notas.routes');
const pagosRoutes = require('./pagos.routes');
const notificacionesRoutes = require('./notificaciones.routes');
const especialidadesRoutes = require('./especialidades.routes');
const obrasSocialesRoutes = require('./obras-sociales.routes');
const logsRoutes = require('./logs.routes');

// Health check
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString()
  });
});

// Montar rutas
router.use('/auth', authRoutes);
router.use('/usuarios', usuariosRoutes);
router.use('/profesionales', profesionalesRoutes);
router.use('/pacientes', pacientesRoutes);
router.use('/turnos', turnosRoutes);
router.use('/agenda', agendaRoutes);
router.use('/evoluciones', evolucionesRoutes);
router.use('/archivos', archivosRoutes);
router.use('/notas', notasRoutes);
router.use('/pagos', pagosRoutes);
router.use('/notificaciones', notificacionesRoutes);
router.use('/especialidades', especialidadesRoutes);
router.use('/obras-sociales', obrasSocialesRoutes);
router.use('/logs', logsRoutes);

module.exports = router;

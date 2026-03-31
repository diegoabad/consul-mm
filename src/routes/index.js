/**
 * INDEX.JS - Centraliza todas las rutas
 * 
 * Este archivo centraliza todas las rutas de la API y las monta
 * en la aplicación Express.
 */

const express = require('express');
const router = express.Router();
const { getMigrationsStatus } = require('../config/bootstrap-db');
const { authenticate } = require('../middlewares/auth.middleware');
const { requirePermission } = require('../middlewares/permissions.middleware');
const recordatorioService = require('../services/recordatorio.service');
const turnoModel = require('../models/turno.model');

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
const whatsappRoutes = require('./whatsapp.routes');
const dashboardRoutes = require('./dashboard.routes');
const recordatoriosRoutes = require('./recordatorios.routes');
const foroRoutes = require('./foro.routes');

// Health check (incluye estado de migraciones: si hay pendientes, se aplican al arrancar el servidor)
router.get('/health', async (req, res) => {
  let migrationsStatus = null;
  let foroTables = null;
  try {
    const status = await getMigrationsStatus();
    migrationsStatus = {
      upToDate: status.upToDate,
      pendingCount: status.pending.length,
      pending: status.pending.length > 0 ? status.pending : undefined
    };
    // En desarrollo: verificar si existen las tablas del foro
    if (process.env.NODE_ENV !== 'production') {
      const { pool } = require('../config/database');
      const r = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('foro_tema', 'foro_post')
      `);
      foroTables = { exist: r.rows.length === 2, tables: r.rows.map((x) => x.table_name) };
    }
  } catch (err) {
    migrationsStatus = { error: err.message };
  }
  res.json({
    success: true,
    message: 'API funcionando correctamente',
    timestamp: new Date().toISOString(),
    migrations: migrationsStatus,
    ...(foroTables && { foroTables })
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
router.use('/webhooks/whatsapp', whatsappRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/recordatorios', recordatoriosRoutes);
router.use('/foro', foroRoutes);

// Rutas públicas de confirmación/cancelación de turno
// GET /api/webhooks/turno/:id/confirmar|cancelar — enlace CTA en plantilla
// POST /api/webhooks/twilio — Twilio (ButtonPayload turno_confirmar:<uuid> / turno_cancelar:<uuid>)
const { confirmarPorUrl, cancelarPorUrl, twilioWebhook } = require('../controllers/whatsapp.controller');
router.get('/webhooks/turno/:id/confirmar', confirmarPorUrl);
router.get('/webhooks/turno/:id/cancelar', cancelarPorUrl);
router.post('/webhooks/twilio', twilioWebhook);

// ─── Endpoint de prueba (solo admin/dev) ───────────────────────────────────────
// POST /api/test/recordatorios/disparar  → corre el job de recordatorios ahora
router.post(
  '/test/recordatorios/disparar',
  authenticate,
  requirePermission('profesionales.actualizar'), // solo admin
  async (_req, res) => {
    const antes = await turnoModel.findParaRecordatorio();
    await recordatorioService.procesarRecordatorios();
    res.json({
      success: true,
      message: `Job ejecutado. Turnos encontrados para recordatorio: ${antes.length}`,
      turnos: antes.map((t) => ({
        id: t.id,
        paciente: `${t.paciente_nombre} ${t.paciente_apellido}`,
        fecha: t.fecha_hora_inicio,
        intentos: t.recordatorio_intentos,
      })),
    });
  }
);

module.exports = router;

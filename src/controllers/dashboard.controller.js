/**
 * DASHBOARD.CONTROLLER.JS
 *
 * Devuelve todas las métricas del dashboard en una sola query SQL agregada,
 * evitando cargar tablas completas al frontend.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * GET /api/dashboard/stats
 * Devuelve los contadores y totales que muestra el AdminDashboard.
 * Solo accesible para administradores (controlado en la ruta).
 */
async function getStats(_req, res) {
  try {
    const result = await query(`
      SELECT
        (
          SELECT COUNT(*)::int FROM pacientes
        ) AS total_pacientes,

        (
          SELECT COUNT(*)::int
          FROM profesionales p
          INNER JOIN usuarios u ON p.usuario_id = u.id
          WHERE u.activo = true
        ) AS total_profesionales,

        (
          SELECT COUNT(*)::int
          FROM turnos
          WHERE fecha_hora_inicio >= date_trunc('month', NOW())
            AND fecha_hora_inicio <  date_trunc('month', NOW()) + INTERVAL '1 month'
        ) AS turnos_este_mes,

        (
          SELECT COUNT(*)::int
          FROM profesionales
          WHERE fecha_inicio_contrato IS NOT NULL
            AND monto_mensual IS NOT NULL
            AND monto_mensual::numeric > 0
        ) AS con_contrato,

        (
          SELECT COUNT(*)::int
          FROM pagos_profesionales
          WHERE estado = 'pagado'
        ) AS pagos_pagados_count,

        (
          SELECT COALESCE(SUM(monto::numeric), 0)
          FROM pagos_profesionales
          WHERE estado = 'pagado'
        ) AS pagos_pagados_total
    `);

    const row = result.rows[0];

    return res.json(
      buildResponse(true, {
        totalPacientes: row.total_pacientes,
        totalProfesionales: row.total_profesionales,
        turnosEsteMes: row.turnos_este_mes,
        conContrato: row.con_contrato,
        pagosPagadosCount: row.pagos_pagados_count,
        pagosPagadosTotal: parseFloat(row.pagos_pagados_total),
      })
    );
  } catch (err) {
    logger.error('Error en dashboard.getStats:', err.message);
    return res.status(500).json(buildResponse(false, null, 'Error al obtener estadísticas del dashboard'));
  }
}

module.exports = { getStats };

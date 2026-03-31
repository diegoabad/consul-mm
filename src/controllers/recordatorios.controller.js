/**
 * RECORDATORIOS.CONTROLLER.JS
 *
 * Listado de turnos con su estado de recordatorio WhatsApp
 * y envío manual de recordatorio individual.
 */

const { query } = require('../config/database');
const turnoModel = require('../models/turno.model');
const { enviarRecordatorioTurno } = require('../services/whatsapp.service');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * GET /api/recordatorios
 * Filtros: profesional_id, fecha_desde, fecha_hasta, estado, page, limit
 */
async function list(req, res) {
  try {
    const {
      profesional_id,
      fecha_turno_desde,
      fecha_turno_hasta,
      fecha_programado_desde,
      fecha_programado_hasta,
      fecha_ultimo_envio_desde,
      fecha_ultimo_envio_hasta,
      estado,
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const offset = (pageNum - 1) * limitNum;

    // Rango por defecto para fecha del turno: -7 días a +60 días desde hoy
    const desdeT = fecha_turno_desde || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const hastaT = fecha_turno_hasta || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const params = [];
    let paramIdx = 1;
    let whereExtra = '';

    if (profesional_id) {
      whereExtra += ` AND t.profesional_id = $${paramIdx++}`;
      params.push(profesional_id);
    }

    // Filtro por fecha de último envío
    if (fecha_ultimo_envio_desde) {
      whereExtra += ` AND t.recordatorio_enviado_at >= $${paramIdx++}::date`;
      params.push(fecha_ultimo_envio_desde);
    }
    if (fecha_ultimo_envio_hasta) {
      whereExtra += ` AND t.recordatorio_enviado_at < ($${paramIdx++}::date + INTERVAL '1 day')`;
      params.push(fecha_ultimo_envio_hasta);
    }

    // Filtro por fecha programada del recordatorio (fecha_turno - horas_antes)
    if (fecha_programado_desde) {
      whereExtra += ` AND (t.fecha_hora_inicio - (COALESCE(p.recordatorio_horas_antes, 24)::text || ' hours')::interval) >= $${paramIdx++}::date`;
      params.push(fecha_programado_desde);
    }
    if (fecha_programado_hasta) {
      whereExtra += ` AND (t.fecha_hora_inicio - (COALESCE(p.recordatorio_horas_antes, 24)::text || ' hours')::interval) < ($${paramIdx++}::date + INTERVAL '1 day')`;
      params.push(fecha_programado_hasta);
    }

    // Filtro por estado usando CASE en SQL
    // Orden: enviado > sin_numero > fallido > anulado (notif desactivadas) > pendiente
    const estadoCaseSQL = `
      CASE
        WHEN t.recordatorio_enviado = true THEN 'enviado'
        WHEN pac.whatsapp IS NULL AND pac.telefono IS NULL THEN 'sin_numero'
        WHEN t.recordatorio_intentos >= 3 THEN 'fallido'
        WHEN p.recordatorio_activo = false THEN 'anulado'
        WHEN pac.notificaciones_activas = false THEN 'anulado'
        ELSE 'pendiente'
      END
    `;

    if (estado && estado !== 'todos') {
      if (estado === 'enviado') {
        whereExtra += ` AND t.recordatorio_enviado = true`;
      } else if (estado === 'fallido') {
        whereExtra += ` AND t.recordatorio_enviado = false AND t.recordatorio_intentos >= 3`;
      } else if (estado === 'pendiente') {
        // Pendiente real: no enviado, no fallido, tiene número, y ambas notificaciones activas
        whereExtra += ` AND t.recordatorio_enviado = false AND t.recordatorio_intentos < 3
          AND (pac.whatsapp IS NOT NULL OR pac.telefono IS NOT NULL)
          AND p.recordatorio_activo = true AND pac.notificaciones_activas = true`;
      } else if (estado === 'sin_numero') {
        whereExtra += ` AND pac.whatsapp IS NULL AND pac.telefono IS NULL`;
      } else if (estado === 'anulado') {
        whereExtra += ` AND t.recordatorio_enviado = false
          AND (p.recordatorio_activo = false OR pac.notificaciones_activas = false)`;
      }
    }

    const baseSQL = `
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE (
        (t.deleted_at IS NULL AND t.estado NOT IN ('CANCELADO'))
        OR (t.deleted_at IS NOT NULL AND t.recordatorio_enviado = true)
      )
        AND t.fecha_hora_inicio >= $${paramIdx}::date
        AND t.fecha_hora_inicio < ($${paramIdx + 1}::date + INTERVAL '1 day')
        ${whereExtra}
    `;
    params.push(desdeT, hastaT);
    paramIdx += 2;

    const countResult = await query(
      `SELECT COUNT(*)::int AS total ${baseSQL}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataParams = [...params, limitNum, offset];
    const dataSQL = `
      SELECT
        t.id,
        t.fecha_hora_inicio::text AS fecha_hora_inicio,
        t.estado AS estado_turno,
        t.recordatorio_enviado,
        t.recordatorio_enviado_at::text AS recordatorio_enviado_at,
        t.recordatorio_intentos,
        t.recordatorio_ultimo_error,
        p.recordatorio_activo,
        p.recordatorio_horas_antes,
        (t.fecha_hora_inicio - (COALESCE(p.recordatorio_horas_antes, 24)::text || ' hours')::interval)::text AS recordatorio_programado_at,
        u_prof.nombre  AS profesional_nombre,
        u_prof.apellido AS profesional_apellido,
        p.id AS profesional_id,
        pac.nombre   AS paciente_nombre,
        pac.apellido AS paciente_apellido,
        pac.whatsapp AS paciente_whatsapp,
        pac.telefono AS paciente_telefono,
        pac.notificaciones_activas AS paciente_notificaciones_activas,
        (${estadoCaseSQL}) AS estado_recordatorio,
        (t.deleted_at IS NOT NULL) AS turno_eliminado
      ${baseSQL}
      ORDER BY t.fecha_hora_inicio ASC
      LIMIT $${paramIdx++} OFFSET $${paramIdx}
    `;

    const dataResult = await query(dataSQL, dataParams);
    const totalPages = Math.ceil(total / limitNum);

    const recordatorios = dataResult.rows.map((row) => ({
      ...row,
      paciente_nombre:      decrypt(row.paciente_nombre),
      paciente_apellido:    decrypt(row.paciente_apellido),
      paciente_whatsapp:    row.paciente_whatsapp ? decrypt(row.paciente_whatsapp) : null,
      paciente_telefono:    row.paciente_telefono ? decrypt(row.paciente_telefono) : null,
      profesional_nombre:               decrypt(row.profesional_nombre),
      profesional_apellido:             decrypt(row.profesional_apellido),
      turno_eliminado:                  Boolean(row.turno_eliminado),
      paciente_notificaciones_activas:  Boolean(row.paciente_notificaciones_activas),
    }));

    return res.json(
      buildResponse(true, {
        recordatorios,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      })
    );
  } catch (err) {
    logger.error('Error en recordatorios.list:', err.message);
    return res.status(500).json(buildResponse(false, null, 'Error al obtener recordatorios'));
  }
}

/**
 * POST /api/recordatorios/turno/:id/enviar
 * Envía el recordatorio de un turno en forma manual.
 */
async function enviarManual(req, res) {
  const { id } = req.params;
  try {
    // Buscar el turno completo con datos de paciente y profesional (incluye campos de recordatorio)
    const turno = await turnoModel.findParaRecordatorioById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }

    if (turno.paciente_notificaciones_activas === false) {
      return res.status(422).json(buildResponse(false, null, 'El paciente tiene las notificaciones WhatsApp desactivadas'));
    }

    const resultado = await enviarRecordatorioTurno(turno);
    if (!resultado) {
      if (turno.recordatorio_activo === false) {
        return res.status(422).json(
          buildResponse(false, null, 'No se pudo enviar: el profesional tiene los recordatorios WhatsApp desactivados')
        );
      }
      return res.status(422).json(
        buildResponse(
          false,
          null,
          'No se pudo enviar: el paciente no tiene número WhatsApp o tiene las notificaciones desactivadas'
        )
      );
    }
    await turnoModel.marcarRecordatorioEnviado(id);

    logger.info(`Recordatorio manual enviado para turno ${id}`);
    return res.json(buildResponse(true, null, 'Recordatorio enviado correctamente'));
  } catch (err) {
    const errorMsg = err?.message || String(err);
    logger.error(`Error al enviar recordatorio manual para turno ${id}: ${errorMsg}`);
    // Registrar intento fallido
    try {
      await turnoModel.marcarRecordatorioFallido(id, `[manual] ${errorMsg}`);
    } catch (_) { /* no propagar */ }
    return res.status(500).json(buildResponse(false, null, `Error al enviar: ${errorMsg}`));
  }
}

module.exports = { list, enviarManual };

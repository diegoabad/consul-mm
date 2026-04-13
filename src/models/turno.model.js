/**
 * TURNO.MODEL.JS - Modelo de turnos médicos
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con turnos médicos.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { ESTADOS_TURNO } = require('../utils/constants');
const { encrypt, decryptTurnoRow, decryptTurnoRows } = require('../utils/encryption');

/** Devuelve fecha/hora como texto UTC "YYYY-MM-DD HH:mm:ss" para guardar en TIMESTAMP sin TZ */
function dateToUTCString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  const date = d instanceof Date ? d : new Date(d);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/** Convierte valor de timestamp (string "YYYY-MM-DD HH:mm:ss" o Date) a ISO UTC para el cliente */
function toISOUTC(val) {
  if (val == null) return val;
  const s = typeof val === 'string' ? val.trim() : '';
  if (s && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(s) && !s.endsWith('Z') && !s.includes('+')) {
    const t = s.replace(' ', 'T');
    return (t.length <= 19 ? t + '.000' : t) + 'Z';
  }
  return new Date(val).toISOString();
}

/**
 * Buscar todos los turnos con filtros opcionales
 * @param {Object} filters - Filtros: profesional_id, paciente_id, estado, fecha_inicio, fecha_fin
 * @returns {Promise<Array>} Lista de turnos
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
        t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp, pac.email as paciente_email
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.deleted_at IS NULL
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.profesional_id) {
      sql += ` AND t.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.paciente_id) {
      sql += ` AND t.paciente_id = $${paramIndex++}`;
      params.push(filters.paciente_id);
    }
    
    if (filters.estado) {
      sql += ` AND t.estado = $${paramIndex++}`;
      params.push(filters.estado);
    }
    
    // Rango por día: columna sin TZ se interpreta como UTC; comparar como timestamptz.
    if (filters.fecha_inicio && filters.fecha_fin) {
      sql += ` AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') >= $${paramIndex++}::timestamptz AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') <= $${paramIndex++}::timestamptz`;
      params.push(filters.fecha_inicio, filters.fecha_fin);
    } else if (filters.fecha_inicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    } else if (filters.fecha_fin) {
      sql += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(filters.fecha_fin);
    }
    
    sql += ' ORDER BY t.fecha_hora_inicio ASC';
    
    const result = await query(sql, params);
    const rows = result.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
    return decryptTurnoRows(rows);
  } catch (error) {
    logger.error('Error en findAll turnos:', error);
    throw error;
  }
};

/**
 * Listar turnos con paginación (mismos filtros que findAll)
 * Para historial de paciente: orden DESC (más recientes primero)
 * @param {Object} filters - profesional_id, paciente_id, estado, fecha_inicio, fecha_fin, page, limit
 * @returns {Promise<{ rows: Array, total: number }>}
 */
const findAllPaginated = async (filters = {}) => {
  try {
    const { page = 1, limit = 10 } = filters;
    const offset = (Math.max(1, page) - 1) * Math.min(100, Math.max(1, limit));
    const limitVal = Math.min(100, Math.max(1, limit));

    let where = ' WHERE t.deleted_at IS NULL';
    const params = [];
    let paramIndex = 1;

    if (filters.profesional_id) {
      where += ` AND t.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    if (filters.paciente_id) {
      where += ` AND t.paciente_id = $${paramIndex++}`;
      params.push(filters.paciente_id);
    }
    if (filters.estado) {
      if (filters.estado === 'activos') {
        where += ` AND t.estado IN ('${ESTADOS_TURNO.PENDIENTE}', '${ESTADOS_TURNO.CONFIRMADO}', '${ESTADOS_TURNO.COMPLETADO}', '${ESTADOS_TURNO.AUSENTE}')`;
      } else {
        where += ` AND t.estado = $${paramIndex++}`;
        params.push(filters.estado);
      }
    }
    // Mismo criterio que findAll: la columna es TIMESTAMP sin TZ con componentes UTC (ver dateToUTCString / toISOUTC).
    if (filters.fecha_inicio && filters.fecha_fin) {
      where += ` AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') >= $${paramIndex++}::timestamptz AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') <= $${paramIndex++}::timestamptz`;
      params.push(filters.fecha_inicio, filters.fecha_fin);
    } else if (filters.fecha_inicio) {
      where += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    } else if (filters.fecha_fin) {
      where += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(filters.fecha_fin);
    }

    const fromClause = `
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      ${where}
    `;
    const countResult = await query(
      `SELECT COUNT(*)::int as total FROM turnos t ${where}`,
      params
    );
    const total = countResult.rows[0]?.total ?? 0;

    const dataParams = [...params, limitVal, offset];
    const dataSql = `
      SELECT 
        t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
        t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp, pac.email as paciente_email
      ${fromClause}
      ORDER BY (t.fecha_hora_inicio AT TIME ZONE 'UTC') DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    const dataResult = await query(dataSql, dataParams);
    const rows = dataResult.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
    return { rows: decryptTurnoRows(rows), total };
  } catch (error) {
    logger.error('Error en findAllPaginated turnos:', error);
    throw error;
  }
};

/**
 * Buscar turno por ID
 * @param {string} id - UUID del turno
 * @returns {Promise<Object|null>} Turno encontrado o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
        t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp, pac.email as paciente_email
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    const row = result.rows[0] || null;
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return null;
  } catch (error) {
    logger.error('Error en findById turno:', error);
    throw error;
  }
};

/**
 * Buscar turnos de un profesional en un rango de fechas
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaInicio - Fecha de inicio
 * @param {Date} fechaFin - Fecha de fin
 * @returns {Promise<Array>} Lista de turnos
 */
const findByProfesional = async (profesionalId, fechaInicio = null, fechaFin = null) => {
  try {
    let sql = `
      SELECT 
        t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
        t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp
      FROM turnos t
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.profesional_id = $1 AND t.deleted_at IS NULL
    `;
    const params = [profesionalId];
    let paramIndex = 2;

    if (fechaInicio && fechaFin) {
      sql += ` AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') >= $${paramIndex++}::timestamptz AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') <= $${paramIndex++}::timestamptz`;
      params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(fechaInicio);
    } else if (fechaFin) {
      sql += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(fechaFin);
    }

    sql += ' ORDER BY t.fecha_hora_inicio ASC';

    const result = await query(sql, params);
    const rows = result.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
    return decryptTurnoRows(rows);
  } catch (error) {
    logger.error('Error en findByProfesional turnos:', error);
    throw error;
  }
};

/**
 * Buscar turnos de un paciente
 * @param {string} pacienteId - UUID del paciente
 * @param {Date} fechaInicio - Fecha de inicio (opcional)
 * @param {Date} fechaFin - Fecha de fin (opcional)
 * @returns {Promise<Array>} Lista de turnos
 */
const findByPaciente = async (pacienteId, fechaInicio = null, fechaFin = null) => {
  try {
    let sql = `
      SELECT 
        t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
        t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      WHERE t.paciente_id = $1 AND t.deleted_at IS NULL
    `;
    const params = [pacienteId];
    let paramIndex = 2;

    if (fechaInicio && fechaFin) {
      sql += ` AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') >= $${paramIndex++}::timestamptz AND (t.fecha_hora_inicio AT TIME ZONE 'UTC') <= $${paramIndex++}::timestamptz`;
      params.push(fechaInicio, fechaFin);
    } else if (fechaInicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(fechaInicio);
    } else if (fechaFin) {
      sql += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(fechaFin);
    }

    sql += ` ORDER BY (t.fecha_hora_inicio AT TIME ZONE 'UTC') ASC`;

    const result = await query(sql, params);
    const rows = result.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
    return decryptTurnoRows(rows);
  } catch (error) {
    logger.error('Error en findByPaciente turnos:', error);
    throw error;
  }
};

/**
 * Verificar disponibilidad de un horario
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaHoraInicio - Fecha y hora de inicio
 * @param {Date} fechaHoraFin - Fecha y hora de fin
 * @param {string} excludeTurnoId - ID de turno a excluir (para actualizaciones)
 * @returns {Promise<boolean>} true si está disponible
 */
const checkAvailability = async (profesionalId, fechaHoraInicio, fechaHoraFin, excludeTurnoId = null) => {
  try {
    // Columnas TIMESTAMP sin TZ guardan componentes UTC (dateToUTCString). Comparar en UTC como en findAll.
    // Solape estándar: existStart < newFin AND existFin > newIni (mismos instantes que parámetros timestamptz).
    let sql = `
      SELECT COUNT(*) as count
      FROM turnos
      WHERE profesional_id = $1
        AND deleted_at IS NULL
        AND estado NOT IN ($2, $3)
        AND (fecha_hora_inicio AT TIME ZONE 'UTC') < $4::timestamptz
        AND (fecha_hora_fin AT TIME ZONE 'UTC') > $5::timestamptz
    `;
    const params = [
      profesionalId,
      ESTADOS_TURNO.CANCELADO,
      ESTADOS_TURNO.COMPLETADO,
      fechaHoraFin,
      fechaHoraInicio
    ];
    
    if (excludeTurnoId) {
      sql += ` AND id != $${params.length + 1}`;
      params.push(excludeTurnoId);
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count) === 0;
  } catch (error) {
    logger.error('Error en checkAvailability turno:', error);
    throw error;
  }
};

/**
 * Verificar si el mismo paciente ya tiene un turno que solapa con el horario dado (misma agenda/profesional).
 * Se usa para impedir doble turno del mismo paciente en el mismo horario.
 * @returns {Promise<boolean>} true si ya tiene un turno en ese horario
 */
const hasPacienteOverlap = async (profesionalId, pacienteId, fechaHoraInicio, fechaHoraFin) => {
  try {
    const result = await query(
      `SELECT COUNT(*) as count
       FROM turnos
       WHERE profesional_id = $1 AND paciente_id = $2
         AND deleted_at IS NULL
         AND estado NOT IN ($3, $4)
         AND (fecha_hora_inicio AT TIME ZONE 'UTC') < $5::timestamptz
         AND (fecha_hora_fin AT TIME ZONE 'UTC') > $6::timestamptz`,
      [
        profesionalId,
        pacienteId,
        ESTADOS_TURNO.CANCELADO,
        ESTADOS_TURNO.COMPLETADO,
        fechaHoraFin,
        fechaHoraInicio
      ]
    );
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error en hasPacienteOverlap turno:', error);
    throw error;
  }
};

/**
 * Turnos activos del profesional que podrían solapar cualquier intervalo dentro de [minInicio, maxFin].
 * Superset seguro para validar muchos slots en una sola lectura (luego se filtra en memoria).
 */
const findActiveInWindowForProfesional = async (profesionalId, minInicio, maxFin) => {
  try {
    const result = await query(
      `SELECT id, paciente_id, fecha_hora_inicio, fecha_hora_fin, estado
       FROM turnos
       WHERE profesional_id = $1
         AND deleted_at IS NULL
         AND estado NOT IN ($2, $3)
         AND (fecha_hora_inicio AT TIME ZONE 'UTC') < $4::timestamptz
         AND (fecha_hora_fin AT TIME ZONE 'UTC') > $5::timestamptz`,
      [profesionalId, ESTADOS_TURNO.CANCELADO, ESTADOS_TURNO.COMPLETADO, maxFin, minInicio]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findActiveInWindowForProfesional turno:', error);
    throw error;
  }
};

/**
 * Crear nuevo turno
 * @param {Object} turnoData - Datos del turno
 * @returns {Promise<Object>} Turno creado
 */
const create = async (turnoData) => {
  try {
    const {
      profesional_id,
      paciente_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      estado = ESTADOS_TURNO.PENDIENTE,
      sobreturno = false,
      motivo
    } = turnoData;
    const inicioStr = fecha_hora_inicio instanceof Date ? dateToUTCString(fecha_hora_inicio) : dateToUTCString(new Date(fecha_hora_inicio));
    const finStr = fecha_hora_fin instanceof Date ? dateToUTCString(fecha_hora_fin) : dateToUTCString(new Date(fecha_hora_fin));
    const encMotivo = encrypt(motivo || null);

    const { serie_id = null, serie_secuencia = null } = turnoData;

    const result = await query(
      `INSERT INTO turnos (
        profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
        estado, sobreturno, motivo, serie_id, serie_secuencia
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                estado, sobreturno, motivo, cancelado_por, razon_cancelacion,
                fecha_creacion, fecha_actualizacion, serie_id, serie_secuencia`,
      [
        profesional_id, paciente_id, inicioStr, finStr,
        estado, Boolean(sobreturno), encMotivo,
        serie_id || null,
        serie_secuencia != null ? serie_secuencia : null
      ]
    );
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return row;
  } catch (error) {
    logger.error('Error en create turno:', error);
    throw error;
  }
};

/**
 * Actualizar turno
 * @param {string} id - UUID del turno
 * @param {Object} turnoData - Datos a actualizar
 * @returns {Promise<Object>} Turno actualizado
 */
const update = async (id, turnoData) => {
  try {
    const updates = [];
    const params = [];
    let paramIndex = 1;
    
    const allowedFields = [
      'fecha_hora_inicio', 'fecha_hora_fin', 'estado', 'motivo'
    ];

    let fechaCambiada = false;
    
    for (const field of allowedFields) {
      if (turnoData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        const val = turnoData[field];
        if (field === 'fecha_hora_inicio' || field === 'fecha_hora_fin') {
          params.push(val instanceof Date ? dateToUTCString(val) : dateToUTCString(new Date(val)));
          if (field === 'fecha_hora_inicio') fechaCambiada = true;
        } else if (field === 'motivo') {
          params.push(encrypt(val ?? null));
        } else {
          params.push(val);
        }
      }
    }

    // Si se reprogramó la fecha, resetear el recordatorio para que vuelva a enviarse
    if (fechaCambiada) {
      updates.push(`recordatorio_enviado = false`);
      updates.push(`recordatorio_enviado_at = NULL`);
    }
    
    if (updates.length === 0) {
      // Si no hay cambios, retornar el turno actual
      return await findById(id);
    }
    
    params.push(id);
    
    const sql = `
      UPDATE turnos 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                estado, sobreturno, motivo, cancelado_por, razon_cancelacion,
                fecha_creacion, fecha_actualizacion
    `;
    
    const result = await query(sql, params);
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return row;
  } catch (error) {
    logger.error('Error en update turno:', error);
    throw error;
  }
};

/**
 * Cancelar turno
 * @param {string} id - UUID del turno
 * @param {string} razon - Razón de cancelación
 * @param {string} canceladoPor - UUID del usuario que cancela
 * @returns {Promise<Object>} Turno actualizado
 */
const cancel = async (id, razon, canceladoPor = null) => {
  try {
    const encRazon = encrypt(razon || null);
    const result = await query(
      `UPDATE turnos 
       SET estado = $1, razon_cancelacion = $2, cancelado_por = $3
       WHERE id = $4
       RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                 estado, motivo, cancelado_por, razon_cancelacion,
                 fecha_creacion, fecha_actualizacion`,
      [ESTADOS_TURNO.CANCELADO, encRazon, canceladoPor || null, id]
    );
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return row;
  } catch (error) {
    logger.error('Error en cancel turno:', error);
    throw error;
  }
};

/**
 * Confirmar turno
 * @param {string} id - UUID del turno
 * @returns {Promise<Object>} Turno actualizado
 */
const confirm = async (id) => {
  try {
    const result = await query(
      `UPDATE turnos 
       SET estado = $1
       WHERE id = $2
       RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                 estado, motivo, cancelado_por, razon_cancelacion,
                 fecha_creacion, fecha_actualizacion`,
      [ESTADOS_TURNO.CONFIRMADO, id]
    );
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return row;
  } catch (error) {
    logger.error('Error en confirm turno:', error);
    throw error;
  }
};

/**
 * Completar turno
 * @param {string} id - UUID del turno
 * @returns {Promise<Object>} Turno actualizado
 */
const complete = async (id) => {
  try {
    const result = await query(
      `UPDATE turnos 
       SET estado = $1
       WHERE id = $2
       RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                 estado, motivo, cancelado_por, razon_cancelacion,
                 fecha_creacion, fecha_actualizacion`,
      [ESTADOS_TURNO.COMPLETADO, id]
    );
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
      return decryptTurnoRow(row);
    }
    return row;
  } catch (error) {
    logger.error('Error en complete turno:', error);
    throw error;
  }
};

/**
 * Eliminar turno (soft delete: marca deleted_at en lugar de borrar físicamente)
 * @param {string} id - UUID del turno
 * @returns {Promise<Object|null>} Turno marcado como eliminado o null
 */
const deleteById = async (id, client = null) => {
  try {
    const q = client ? client.query.bind(client) : query;
    const result = await q(
      'UPDATE turnos SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en delete turno:', error);
    throw error;
  }
};

/**
 * Soft-delete de turnos de una serie con inicio >= desdeInicio (misma columna TIMESTAMP UTC que el resto).
 */
const softDeleteSerieDesde = async (serieId, desdeInicio, client = null) => {
  try {
    const q = client ? client.query.bind(client) : query;
    const desdeStr =
      desdeInicio instanceof Date ? dateToUTCString(desdeInicio) : dateToUTCString(new Date(desdeInicio));
    const result = await q(
      `UPDATE turnos SET deleted_at = NOW()
       WHERE serie_id = $1 AND deleted_at IS NULL AND fecha_hora_inicio >= $2::timestamp`,
      [serieId, desdeStr]
    );
    return result.rowCount;
  } catch (error) {
    logger.error('Error en softDeleteSerieDesde:', error);
    throw error;
  }
};

const createWithClient = async (client, turnoData) => {
  const {
    profesional_id,
    paciente_id,
    fecha_hora_inicio,
    fecha_hora_fin,
    estado = ESTADOS_TURNO.PENDIENTE,
    sobreturno = false,
    motivo,
    serie_id = null,
    serie_secuencia = null
  } = turnoData;
  const inicioStr = fecha_hora_inicio instanceof Date ? dateToUTCString(fecha_hora_inicio) : dateToUTCString(new Date(fecha_hora_inicio));
  const finStr = fecha_hora_fin instanceof Date ? dateToUTCString(fecha_hora_fin) : dateToUTCString(new Date(fecha_hora_fin));
  const encMotivo = encrypt(motivo || null);
  const q = client.query.bind(client);
  const result = await q(
    `INSERT INTO turnos (
      profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
      estado, sobreturno, motivo, serie_id, serie_secuencia
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
              estado, sobreturno, motivo, serie_id, serie_secuencia`,
    [
      profesional_id, paciente_id, inicioStr, finStr,
      estado, Boolean(sobreturno), encMotivo,
      serie_id || null,
      serie_secuencia != null ? serie_secuencia : null
    ]
  );
  const row = result.rows[0];
  if (row) {
    row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
    row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
    return decryptTurnoRow(row);
  }
  return row;
};

/**
 * Insertar varios turnos en una sola sentencia (misma transacción).
 * @param {import('pg').PoolClient} client
 * @param {Array<Object>} rows - Mismos campos que createWithClient
 * @returns {Promise<Array<Object>>} Filas RETURNING en el mismo orden que `rows`
 */
const createManyWithClient = async (client, rows) => {
  if (!rows.length) return [];
  const q = client.query.bind(client);
  const placeholders = [];
  const params = [];
  let n = 1;
  for (const turnoData of rows) {
    const {
      profesional_id,
      paciente_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      estado = ESTADOS_TURNO.PENDIENTE,
      sobreturno = false,
      motivo,
      serie_id = null,
      serie_secuencia = null
    } = turnoData;
    const inicioStr =
      fecha_hora_inicio instanceof Date ? dateToUTCString(fecha_hora_inicio) : dateToUTCString(new Date(fecha_hora_inicio));
    const finStr =
      fecha_hora_fin instanceof Date ? dateToUTCString(fecha_hora_fin) : dateToUTCString(new Date(fecha_hora_fin));
    const encMotivo = encrypt(motivo || null);
    placeholders.push(
      `($${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++}, $${n++})`
    );
    params.push(
      profesional_id,
      paciente_id,
      inicioStr,
      finStr,
      estado,
      Boolean(sobreturno),
      encMotivo,
      serie_id || null,
      serie_secuencia != null ? serie_secuencia : null
    );
  }
  const result = await q(
    `INSERT INTO turnos (
      profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
      estado, sobreturno, motivo, serie_id, serie_secuencia
    )
    VALUES ${placeholders.join(', ')}
    RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
              estado, sobreturno, motivo, serie_id, serie_secuencia`,
    params
  );
  return result.rows.map((row) => {
    row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
    row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
    return decryptTurnoRow(row);
  });
};

/**
 * Mismo resultado enriquecido que findById, para varios IDs, preservando el orden del array.
 * @param {string[]} ids
 * @param {import('pg').PoolClient|null} client - opcional (misma conexión que la transacción)
 */
const findByIdsInOrder = async (ids, client = null) => {
  if (!ids?.length) return [];
  const q = client ? client.query.bind(client) : query;
  const result = await q(
    `SELECT 
      t.id, t.profesional_id, t.paciente_id, t.fecha_hora_inicio::text as fecha_hora_inicio, t.fecha_hora_fin::text as fecha_hora_fin,
      t.estado, t.sobreturno, t.motivo, t.cancelado_por, t.razon_cancelacion,
      t.fecha_creacion, t.fecha_actualizacion, t.serie_id, t.serie_secuencia,
      p.matricula, p.especialidad as profesional_especialidad,
      u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
      pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp, pac.email as paciente_email
    FROM turnos t
    INNER JOIN profesionales p ON t.profesional_id = p.id
    INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
    INNER JOIN pacientes pac ON t.paciente_id = pac.id
    WHERE t.id = ANY($1::uuid[]) AND t.deleted_at IS NULL
    ORDER BY array_position($1::uuid[], t.id)`,
    [ids]
  );
  const rows = result.rows.map((r) => ({
    ...r,
    fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
    fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
  }));
  return decryptTurnoRows(rows);
};

/**
 * Buscar turnos que necesitan recordatorio WhatsApp.
 * Devuelve turnos confirmados/pendientes cuya fecha de inicio está dentro del rango
 * [ahora + (horas_antes - margen), ahora + (horas_antes + margen)] para cada profesional
 * que tenga recordatorio_activo = true, y que aún no hayan recibido el recordatorio.
 * Se usa una consulta dinámica para contemplar distintos horas_antes por profesional.
 * @returns {Promise<Array>}
 */
const findParaRecordatorio = async () => {
  try {
    const sql = `
      SELECT
        t.id, t.profesional_id, t.paciente_id,
        t.fecha_hora_inicio::text as fecha_hora_inicio,
        t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.motivo,
        p.especialidad as profesional_especialidad,
        p.recordatorio_horas_antes,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido,
        pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp,
        pac.notificaciones_activas as paciente_notificaciones_activas
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.deleted_at IS NULL
        AND p.recordatorio_activo = true
        AND p.recordatorio_whatsapp_permitido_admin = true
        AND t.recordatorio_enviado = false
        AND t.recordatorio_intentos < 3
        AND t.estado IN ('pendiente', 'confirmado')
        AND pac.notificaciones_activas = true
        AND t.fecha_hora_inicio > NOW()
        AND t.fecha_hora_inicio <= NOW() + (p.recordatorio_horas_antes || ' hours')::interval + interval '30 minutes'
        AND t.fecha_hora_inicio > NOW() + (p.recordatorio_horas_antes || ' hours')::interval - interval '30 minutes'
      ORDER BY t.fecha_hora_inicio ASC
    `;
    const result = await query(sql);
    return decryptTurnoRows(result.rows);
  } catch (error) {
    logger.error('Error en findParaRecordatorio:', error);
    throw error;
  }
};

/**
 * Buscar un turno por ID con todos los datos necesarios para enviar recordatorio.
 * Usado para el envío manual desde el panel.
 * @param {string} id - UUID del turno
 */
const findParaRecordatorioById = async (id) => {
  try {
    const result = await query(
      `SELECT
        t.id, t.profesional_id, t.paciente_id,
        t.fecha_hora_inicio::text as fecha_hora_inicio,
        t.fecha_hora_fin::text as fecha_hora_fin,
        t.estado, t.motivo,
        p.especialidad as profesional_especialidad,
        p.recordatorio_activo, p.recordatorio_horas_antes,
        p.recordatorio_whatsapp_permitido_admin,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido,
        pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp,
        pac.notificaciones_activas as paciente_notificaciones_activas
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.id = $1 AND t.deleted_at IS NULL`,
      [id]
    );
    return result.rows[0] ? decryptTurnoRow(result.rows[0]) : null;
  } catch (error) {
    logger.error('Error en findParaRecordatorioById:', error);
    throw error;
  }
};

/**
 * Marcar turno como recordatorio enviado exitosamente
 * @param {string} id - UUID del turno
 */
const marcarRecordatorioEnviado = async (id) => {
  try {
    const result = await query(
      `UPDATE turnos
       SET recordatorio_enviado = true, recordatorio_enviado_at = NOW(),
           recordatorio_intentos = recordatorio_intentos + 1, recordatorio_ultimo_error = NULL
       WHERE id = $1 RETURNING id`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en marcarRecordatorioEnviado:', error);
    throw error;
  }
};

/**
 * Registrar intento fallido de envío de recordatorio
 * @param {string} id - UUID del turno
 * @param {string} errorMsg - Mensaje de error
 */
const marcarRecordatorioFallido = async (id, errorMsg) => {
  try {
    const result = await query(
      `UPDATE turnos
       SET recordatorio_intentos = recordatorio_intentos + 1,
           recordatorio_ultimo_error = $1
       WHERE id = $2 RETURNING id, recordatorio_intentos`,
      [String(errorMsg).slice(0, 500), id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en marcarRecordatorioFallido:', error);
    throw error;
  }
};

/**
 * Buscar los próximos turnos con recordatorio enviado para todos los pacientes (para el webhook).
 * Devuelve los turnos próximos con recordatorio_enviado=true y estado pendiente/confirmado,
 * para luego filtrar por teléfono en memoria (los teléfonos están cifrados en DB).
 * @returns {Promise<Array>}
 */
const findProximosConRecordatorio = async () => {
  try {
    const sql = `
      SELECT
        t.id, t.profesional_id, t.paciente_id,
        t.fecha_hora_inicio::text as fecha_hora_inicio,
        t.estado,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido,
        pac.telefono as paciente_telefono, pac.whatsapp as paciente_whatsapp
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.deleted_at IS NULL
        AND t.recordatorio_enviado = true
        AND t.estado IN ('pendiente', 'confirmado')
        AND t.fecha_hora_inicio > NOW()
      ORDER BY t.fecha_hora_inicio ASC
    `;
    const result = await query(sql);
    return decryptTurnoRows(result.rows);
  } catch (error) {
    logger.error('Error en findProximosConRecordatorio:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findAllPaginated,
  findById,
  findByProfesional,
  findByPaciente,
  checkAvailability,
  hasPacienteOverlap,
  findActiveInWindowForProfesional,
  create,
  update,
  cancel,
  confirm,
  complete,
  deleteById,
  softDeleteSerieDesde,
  createWithClient,
  createManyWithClient,
  findByIdsInOrder,
  findParaRecordatorio,
  findParaRecordatorioById,
  marcarRecordatorioEnviado,
  marcarRecordatorioFallido,
  findProximosConRecordatorio,
};

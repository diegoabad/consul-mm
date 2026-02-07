/**
 * TURNO.MODEL.JS - Modelo de turnos médicos
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con turnos médicos.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');
const { ESTADOS_TURNO } = require('../utils/constants');

/** Devuelve fecha/hora como texto UTC "YYYY-MM-DD HH:mm:ss" para guardar en TIMESTAMP sin TZ */
function dateToUTCString(d) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

/** Convierte valor de timestamp (string "YYYY-MM-DD HH:mm:ss" en UTC o Date) a ISO UTC para el cliente */
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
        t.fecha_creacion, t.fecha_actualizacion,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.email as paciente_email
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE 1=1
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
    
    if (filters.fecha_inicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    }
    
    if (filters.fecha_fin) {
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
    return rows;
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

    let where = ' WHERE 1=1';
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
      where += ` AND t.estado = $${paramIndex++}`;
      params.push(filters.estado);
    }
    if (filters.fecha_inicio) {
      where += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    }
    if (filters.fecha_fin) {
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
        t.fecha_creacion, t.fecha_actualizacion,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.email as paciente_email
      ${fromClause}
      ORDER BY t.fecha_hora_inicio DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    const dataResult = await query(dataSql, dataParams);
    const rows = dataResult.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
    return { rows, total };
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
        t.fecha_creacion, t.fecha_actualizacion,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido, u_prof.email as profesional_email,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono, pac.email as paciente_email
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.id = $1`,
      [id]
    );
    const row = result.rows[0] || null;
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
    }
    return row;
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
        t.fecha_creacion, t.fecha_actualizacion,
        pac.nombre as paciente_nombre, pac.apellido as paciente_apellido, pac.dni as paciente_dni, pac.telefono as paciente_telefono
      FROM turnos t
      INNER JOIN pacientes pac ON t.paciente_id = pac.id
      WHERE t.profesional_id = $1
    `;
    const params = [profesionalId];
    let paramIndex = 2;
    
    if (fechaInicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      sql += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    sql += ' ORDER BY t.fecha_hora_inicio ASC';
    
    const result = await query(sql, params);
    return result.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
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
        t.fecha_creacion, t.fecha_actualizacion,
        p.matricula, p.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido
      FROM turnos t
      INNER JOIN profesionales p ON t.profesional_id = p.id
      INNER JOIN usuarios u_prof ON p.usuario_id = u_prof.id
      WHERE t.paciente_id = $1
    `;
    const params = [pacienteId];
    let paramIndex = 2;
    
    if (fechaInicio) {
      sql += ` AND t.fecha_hora_inicio >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      sql += ` AND t.fecha_hora_inicio <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    sql += ' ORDER BY t.fecha_hora_inicio DESC';
    
    const result = await query(sql, params);
    return result.rows.map((r) => ({
      ...r,
      fecha_hora_inicio: toISOUTC(r.fecha_hora_inicio),
      fecha_hora_fin: toISOUTC(r.fecha_hora_fin)
    }));
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
    let sql = `
      SELECT COUNT(*) as count
      FROM turnos
      WHERE profesional_id = $1
        AND estado NOT IN ($2, $3)
        AND (
          (fecha_hora_inicio < $4 AND fecha_hora_fin > $5) OR
          (fecha_hora_inicio >= $5 AND fecha_hora_inicio < $4) OR
          (fecha_hora_fin > $5 AND fecha_hora_fin <= $4)
        )
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
         AND estado NOT IN ($3, $4)
         AND (
           (fecha_hora_inicio < $5 AND fecha_hora_fin > $6) OR
           (fecha_hora_inicio >= $6 AND fecha_hora_inicio < $5) OR
           (fecha_hora_fin > $6 AND fecha_hora_fin <= $5)
         )`,
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
    // Guardar siempre en UTC como "YYYY-MM-DD HH:mm:ss" para no depender de la zona del servidor
    const inicioStr = fecha_hora_inicio instanceof Date ? dateToUTCString(fecha_hora_inicio) : fecha_hora_inicio;
    const finStr = fecha_hora_fin instanceof Date ? dateToUTCString(fecha_hora_fin) : fecha_hora_fin;

    const result = await query(
      `INSERT INTO turnos (
        profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
        estado, sobreturno, motivo
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, profesional_id, paciente_id, fecha_hora_inicio::text as fecha_hora_inicio, fecha_hora_fin::text as fecha_hora_fin,
                estado, sobreturno, motivo, cancelado_por, razon_cancelacion,
                fecha_creacion, fecha_actualizacion`,
      [
        profesional_id, paciente_id, inicioStr, finStr,
        estado, Boolean(sobreturno), motivo || null
      ]
    );
    const row = result.rows[0];
    if (row) {
      row.fecha_hora_inicio = toISOUTC(row.fecha_hora_inicio);
      row.fecha_hora_fin = toISOUTC(row.fecha_hora_fin);
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
    
    for (const field of allowedFields) {
      if (turnoData[field] !== undefined) {
        updates.push(`${field} = $${paramIndex++}`);
        params.push(turnoData[field]);
      }
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
    const result = await query(
      `UPDATE turnos 
       SET estado = $1, razon_cancelacion = $2, cancelado_por = $3
       WHERE id = $4
       RETURNING id, profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
                 estado, motivo, cancelado_por, razon_cancelacion,
                 fecha_creacion, fecha_actualizacion`,
      [ESTADOS_TURNO.CANCELADO, razon || null, canceladoPor || null, id]
    );
    return result.rows[0];
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
       RETURNING id, profesional_id, paciente_id, fecha_hora_inicio, fecha_hora_fin,
                 estado, motivo, cancelado_por, razon_cancelacion,
                 fecha_creacion, fecha_actualizacion`,
      [ESTADOS_TURNO.CONFIRMADO, id]
    );
    return result.rows[0];
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
    }
    return row;
  } catch (error) {
    logger.error('Error en complete turno:', error);
    throw error;
  }
};

/**
 * Eliminar turno (hard delete)
 * @param {string} id - UUID del turno
 * @returns {Promise<Object|null>} Turno eliminado o null
 */
const deleteById = async (id) => {
  try {
    const result = await query(
      'DELETE FROM turnos WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en delete turno:', error);
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
  create,
  update,
  cancel,
  confirm,
  complete,
  deleteById
};

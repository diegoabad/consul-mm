/**
 * EVOLUCION.MODEL.JS - Modelo de evoluciones clínicas
 * 
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con evoluciones clínicas de pacientes.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las evoluciones clínicas con filtros opcionales
 * @param {Object} filters - Filtros: paciente_id, profesional_id, turno_id, fecha_inicio, fecha_fin
 * @returns {Promise<Array>} Lista de evoluciones clínicas
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        e.id, e.paciente_id, e.profesional_id, e.turno_id, e.evolucion_anterior_id, e.fecha_consulta,
        e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
        e.fecha_creacion, e.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        prof.matricula, prof.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        t.fecha_hora_inicio as turno_fecha_inicio, t.estado as turno_estado,
        e_ant.fecha_consulta as evolucion_anterior_fecha
      FROM evoluciones_clinicas e
      INNER JOIN pacientes p ON e.paciente_id = p.id
      INNER JOIN profesionales prof ON e.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      LEFT JOIN turnos t ON e.turno_id = t.id
      LEFT JOIN evoluciones_clinicas e_ant ON e.evolucion_anterior_id = e_ant.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.paciente_id) {
      sql += ` AND e.paciente_id = $${paramIndex++}`;
      params.push(filters.paciente_id);
    }
    
    if (filters.profesional_id) {
      sql += ` AND e.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.turno_id) {
      sql += ` AND e.turno_id = $${paramIndex++}`;
      params.push(filters.turno_id);
    }
    
    if (filters.fecha_inicio) {
      sql += ` AND e.fecha_consulta >= $${paramIndex++}`;
      params.push(filters.fecha_inicio);
    }
    
    if (filters.fecha_fin) {
      sql += ` AND e.fecha_consulta <= $${paramIndex++}`;
      params.push(filters.fecha_fin);
    }
    
    sql += ' ORDER BY e.fecha_consulta DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll evoluciones_clinicas:', error);
    throw error;
  }
};

/**
 * Buscar evolución clínica por ID
 * @param {string} id - UUID de la evolución
 * @returns {Promise<Object|null>} Evolución encontrada o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        e.id, e.paciente_id, e.profesional_id, e.turno_id, e.evolucion_anterior_id, e.fecha_consulta,
        e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
        e.fecha_creacion, e.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        prof.matricula, prof.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        t.fecha_hora_inicio as turno_fecha_inicio, t.estado as turno_estado,
        e_ant.fecha_consulta as evolucion_anterior_fecha
      FROM evoluciones_clinicas e
      INNER JOIN pacientes p ON e.paciente_id = p.id
      INNER JOIN profesionales prof ON e.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      LEFT JOIN turnos t ON e.turno_id = t.id
      LEFT JOIN evoluciones_clinicas e_ant ON e.evolucion_anterior_id = e_ant.id
      WHERE e.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById evolucion:', error);
    throw error;
  }
};

/**
 * Buscar evoluciones clínicas por paciente_id
 * @param {string} pacienteId - UUID del paciente
 * @param {Date} fechaInicio - Fecha de inicio para filtrar (opcional)
 * @param {Date} fechaFin - Fecha de fin para filtrar (opcional)
 * @returns {Promise<Array>} Lista de evoluciones del paciente
 */
const findByPaciente = async (pacienteId, fechaInicio = null, fechaFin = null) => {
  try {
    let sql = `
      SELECT 
        e.id, e.paciente_id, e.profesional_id, e.turno_id, e.evolucion_anterior_id, e.fecha_consulta,
        e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
        e.fecha_creacion, e.fecha_actualizacion,
        prof.matricula, prof.especialidad as profesional_especialidad,
        u_prof.nombre as profesional_nombre, u_prof.apellido as profesional_apellido,
        e_ant.fecha_consulta as evolucion_anterior_fecha
      FROM evoluciones_clinicas e
      INNER JOIN profesionales prof ON e.profesional_id = prof.id
      INNER JOIN usuarios u_prof ON prof.usuario_id = u_prof.id
      LEFT JOIN evoluciones_clinicas e_ant ON e.evolucion_anterior_id = e_ant.id
      WHERE e.paciente_id = $1
    `;
    const params = [pacienteId];
    let paramIndex = 2;
    
    if (fechaInicio) {
      sql += ` AND e.fecha_consulta >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      sql += ` AND e.fecha_consulta <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    sql += ' ORDER BY e.fecha_consulta DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findByPaciente evolucion:', error);
    throw error;
  }
};

/**
 * Buscar evoluciones clínicas por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaInicio - Fecha de inicio para filtrar (opcional)
 * @param {Date} fechaFin - Fecha de fin para filtrar (opcional)
 * @returns {Promise<Array>} Lista de evoluciones del profesional
 */
const findByProfesional = async (profesionalId, fechaInicio = null, fechaFin = null) => {
  try {
    let sql = `
      SELECT 
        e.id, e.paciente_id, e.profesional_id, e.turno_id, e.evolucion_anterior_id, e.fecha_consulta,
        e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
        e.fecha_creacion, e.fecha_actualizacion,
        p.nombre as paciente_nombre, p.apellido as paciente_apellido, p.dni as paciente_dni,
        e_ant.fecha_consulta as evolucion_anterior_fecha
      FROM evoluciones_clinicas e
      INNER JOIN pacientes p ON e.paciente_id = p.id
      LEFT JOIN evoluciones_clinicas e_ant ON e.evolucion_anterior_id = e_ant.id
      WHERE e.profesional_id = $1
    `;
    const params = [profesionalId];
    let paramIndex = 2;
    
    if (fechaInicio) {
      sql += ` AND e.fecha_consulta >= $${paramIndex++}`;
      params.push(fechaInicio);
    }
    
    if (fechaFin) {
      sql += ` AND e.fecha_consulta <= $${paramIndex++}`;
      params.push(fechaFin);
    }
    
    sql += ' ORDER BY e.fecha_consulta DESC';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional evolucion:', error);
    throw error;
  }
};

/**
 * Buscar evoluciones clínicas por turno_id
 * @param {string} turnoId - UUID del turno
 * @returns {Promise<Array>} Lista de evoluciones del turno
 */
const findByTurno = async (turnoId) => {
  try {
    const result = await query(
      `SELECT 
        e.id, e.paciente_id, e.profesional_id, e.turno_id, e.evolucion_anterior_id, e.fecha_consulta,
        e.motivo_consulta, e.diagnostico, e.tratamiento, e.observaciones,
        e.fecha_creacion, e.fecha_actualizacion,
        e_ant.fecha_consulta as evolucion_anterior_fecha
      FROM evoluciones_clinicas e
      LEFT JOIN evoluciones_clinicas e_ant ON e.evolucion_anterior_id = e_ant.id
      WHERE e.turno_id = $1
      ORDER BY e.fecha_consulta DESC`,
      [turnoId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error en findByTurno evolucion:', error);
    throw error;
  }
};

/**
 * Crear nueva evolución clínica
 * @param {Object} evolucionData - Datos de la evolución
 * @returns {Promise<Object>} Evolución creada
 */
const create = async (evolucionData) => {
  try {
    const {
      paciente_id,
      profesional_id,
      turno_id = null,
      evolucion_anterior_id = null,
      fecha_consulta,
      motivo_consulta = null,
      diagnostico = null,
      tratamiento = null,
      observaciones = null
    } = evolucionData;
    
    const result = await query(
      `INSERT INTO evoluciones_clinicas 
        (paciente_id, profesional_id, turno_id, evolucion_anterior_id, fecha_consulta, motivo_consulta, diagnostico, tratamiento, observaciones)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [paciente_id, profesional_id, turno_id, evolucion_anterior_id, fecha_consulta, motivo_consulta, diagnostico, tratamiento, observaciones]
    );
    
    return result.rows[0];
  } catch (error) {
    logger.error('Error en create evolucion:', error);
    throw error;
  }
};

/**
 * Actualizar evolución clínica
 * @param {string} id - UUID de la evolución
 * @param {Object} evolucionData - Datos a actualizar
 * @returns {Promise<Object>} Evolución actualizada
 */
const update = async (id, evolucionData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (evolucionData.turno_id !== undefined) {
      fields.push(`turno_id = $${paramIndex++}`);
      values.push(evolucionData.turno_id);
    }
    
    if (evolucionData.fecha_consulta !== undefined) {
      fields.push(`fecha_consulta = $${paramIndex++}`);
      values.push(evolucionData.fecha_consulta);
    }
    
    if (evolucionData.motivo_consulta !== undefined) {
      fields.push(`motivo_consulta = $${paramIndex++}`);
      values.push(evolucionData.motivo_consulta);
    }
    
    if (evolucionData.diagnostico !== undefined) {
      fields.push(`diagnostico = $${paramIndex++}`);
      values.push(evolucionData.diagnostico);
    }
    
    if (evolucionData.tratamiento !== undefined) {
      fields.push(`tratamiento = $${paramIndex++}`);
      values.push(evolucionData.tratamiento);
    }
    
    if (evolucionData.observaciones !== undefined) {
      fields.push(`observaciones = $${paramIndex++}`);
      values.push(evolucionData.observaciones);
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE evoluciones_clinicas
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update evolucion:', error);
    throw error;
  }
};

/**
 * Eliminar evolución clínica
 * @param {string} id - UUID de la evolución
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteEvolucion = async (id) => {
  try {
    const result = await query(
      'DELETE FROM evoluciones_clinicas WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete evolucion:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByPaciente,
  findByProfesional,
  findByTurno,
  create,
  update,
  delete: deleteEvolucion
};

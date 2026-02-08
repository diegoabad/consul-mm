/**
 * AGENDA.MODEL.JS - Modelo de configuración de agenda
 *
 * Este modelo maneja todas las operaciones de base de datos relacionadas
 * con la configuración de horarios de trabajo de los profesionales.
 *
 * ---------------------------------------------------------------------------
 * CÓMO FUNCIONA LA VIGENCIA (cuando deshabilitás un día, "corre desde ese momento")
 * ---------------------------------------------------------------------------
 *
 * La tabla configuracion_agenda tiene:
 *   - vigencia_desde (DATE): fecha desde la que rige esta configuración.
 *   - vigencia_hasta (DATE, nullable): fecha hasta la que rigió; NULL = sigue vigente.
 *
 * Cuando guardás "horarios de la semana" (por ejemplo pasás de Lu–Vi a Ma–Vi, quitando el lunes):
 *
 *   1. closeVigenciaForProfesional(profesionalId)
 *      - A todas las filas de ese profesional que tienen vigencia_hasta IS NULL
 *        les pone vigencia_hasta = CURRENT_DATE (hoy).
 *      - Es decir: "la agenda que estaba vigente hasta ayer, termina hoy".
 *
 *   2. Se crean NUEVAS filas solo para los días que seguís teniendo habilitados
 *      (ej. Ma, Mi, Ju, Vi). Esas filas nuevas tienen:
 *      - vigencia_desde = CURRENT_DATE (por defecto de la tabla)
 *      - vigencia_hasta = NULL
 *      - Es decir: "desde hoy rige esta nueva agenda".
 *
 * Resultado:
 *   - Para fechas PASADAS: se usa la agenda "vieja" (Lu–Vi) porque esas filas
 *     tienen vigencia_hasta = hoy, y para una fecha pasada esa fecha <= vigencia_hasta.
 *   - Para HOY y FUTURO: solo existen las filas nuevas (Ma–Vi) con vigencia_hasta NULL,
 *     así que los lunes ya no tienen configuración vigente y quedan deshabilitados.
 *
 * Al listar "agenda vigente" (por defecto): solo se devuelven filas con
 * vigencia_hasta IS NULL OR vigencia_hasta > CURRENT_DATE, para no mezclar
 * la agenda cerrada hoy con la nueva. Para ver historial se usa vigente=false.
 */

const { query } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Buscar todas las configuraciones de agenda con filtros opcionales
 * @param {Object} filters - Filtros: profesional_id, dia_semana, activo, vigente (default true = solo vigentes)
 * @returns {Promise<Array>} Lista de configuraciones de agenda
 */
const findAll = async (filters = {}) => {
  try {
    let sql = `
      SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion,
        ca.vigencia_desde, ca.vigencia_hasta,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM configuracion_agenda ca
      INNER JOIN profesionales p ON ca.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    
    if (filters.profesional_id) {
      sql += ` AND ca.profesional_id = $${paramIndex++}`;
      params.push(filters.profesional_id);
    }
    
    if (filters.dia_semana !== undefined) {
      sql += ` AND ca.dia_semana = $${paramIndex++}`;
      params.push(filters.dia_semana);
    }
    
    if (filters.activo !== undefined) {
      sql += ` AND ca.activo = $${paramIndex++}`;
      params.push(filters.activo);
    }
    
    // Vigente = sin cierre o vigencia_hasta después de hoy (excluir cerradas hoy para que no compitan con las nuevas)
    if (filters.vigente !== false) {
      sql += ` AND (ca.vigencia_hasta IS NULL OR ca.vigencia_hasta > CURRENT_DATE)`;
    }
    
    sql += ' ORDER BY ca.profesional_id, ca.dia_semana, ca.hora_inicio';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findAll configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Buscar configuración de agenda por ID
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object|null>} Configuración encontrada o null
 */
const findById = async (id) => {
  try {
    const result = await query(
      `SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion,
        ca.vigencia_desde, ca.vigencia_hasta,
        p.matricula, p.especialidad,
        u.nombre as profesional_nombre, u.apellido as profesional_apellido
      FROM configuracion_agenda ca
      INNER JOIN profesionales p ON ca.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
      WHERE ca.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Error en findById configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Buscar configuraciones de agenda por profesional_id
 * @param {string} profesionalId - UUID del profesional
 * @param {boolean} soloActivos - Si true, solo retorna configuraciones activas
 * @param {boolean} vigente - Si true (default), solo configuraciones vigentes (vigencia_hasta IS NULL o > hoy; excluye cerradas hoy)
 * @returns {Promise<Array>} Lista de configuraciones de agenda del profesional
 */
const findByProfesional = async (profesionalId, soloActivos = false, vigente = true) => {
  try {
    let sql = `
      SELECT 
        ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
        ca.duracion_turno_minutos, ca.activo, ca.fecha_creacion, ca.fecha_actualizacion,
        ca.vigencia_desde, ca.vigencia_hasta
      FROM configuracion_agenda ca
      WHERE ca.profesional_id = $1
    `;
    const params = [profesionalId];
    
    if (soloActivos) {
      sql += ' AND ca.activo = $2';
      params.push(true);
    }
    
    if (vigente) {
      sql += ' AND (ca.vigencia_hasta IS NULL OR ca.vigencia_hasta > CURRENT_DATE)';
    }
    
    sql += ' ORDER BY ca.dia_semana, ca.hora_inicio';
    
    const result = await query(sql, params);
    return result.rows;
  } catch (error) {
    logger.error('Error en findByProfesional configuracion_agenda:', error);
    throw error;
  }
};

/** Convierte hora "HH:mm:ss" o "HH:mm" a minutos desde medianoche */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  const part = timeStr.trim().substring(0, 5);
  const [h, m] = part.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Verificar si el profesional tiene agenda vigente para esa fecha/hora (día de semana + rango horario).
 * Usado para no permitir crear turnos en días u horarios que ya no atiende (ej. desactivó los lunes).
 * La hora se interpreta en hora local del servidor (asumir misma zona que el consultorio).
 * @param {string} profesionalId - UUID del profesional
 * @param {Date} fechaHora - Fecha y hora de inicio del turno
 * @returns {Promise<boolean>} true si hay al menos una config vigente para ese día y esa hora dentro del rango
 */
const vigentConfigCoversDateTime = async (profesionalId, fechaHora) => {
  try {
    const configs = await findByProfesional(profesionalId, true, true);
    const diaSemana = fechaHora.getDay();
    const minutos = fechaHora.getHours() * 60 + fechaHora.getMinutes();
    for (const c of configs) {
      if (c.dia_semana !== diaSemana) continue;
      const inicioMin = timeToMinutes(c.hora_inicio);
      const finMin = timeToMinutes(c.hora_fin);
      if (minutos >= inicioMin && minutos < finMin) return true;
    }
    return false;
  } catch (error) {
    logger.error('Error en vigentConfigCoversDateTime:', error);
    throw error;
  }
};

/**
 * Verificar si existe una configuración duplicada
 * @param {string} profesionalId - UUID del profesional
 * @param {number} diaSemana - Día de la semana (0-6)
 * @param {string} horaInicio - Hora de inicio (TIME format)
 * @param {string} excludeId - UUID a excluir de la búsqueda (para updates)
 * @returns {Promise<boolean>} True si existe duplicado
 */
const checkDuplicate = async (profesionalId, diaSemana, horaInicio, excludeId = null) => {
  try {
    let sql = `
      SELECT COUNT(*) as count
      FROM configuracion_agenda
      WHERE profesional_id = $1 AND dia_semana = $2 AND hora_inicio = $3
    `;
    const params = [profesionalId, diaSemana, horaInicio];
    
    if (excludeId) {
      sql += ` AND id != $${params.length + 1}`;
      params.push(excludeId);
    }
    
    const result = await query(sql, params);
    return parseInt(result.rows[0].count) > 0;
  } catch (error) {
    logger.error('Error en checkDuplicate configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Crear nueva configuración de agenda
 * @param {Object} agendaData - Datos de la configuración
 * @returns {Promise<Object>} Configuración creada
 */
const create = async (agendaData) => {
  try {
    const {
      profesional_id,
      dia_semana,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos = 30,
      activo = true,
      vigencia_desde: vigenciaDesdeParam,
      vigencia_hasta: vigenciaHastaParam
    } = agendaData;

    const hasVigenciaDesde = vigenciaDesdeParam != null && String(vigenciaDesdeParam).trim() !== '';
    const hasVigenciaHasta = vigenciaHastaParam != null && String(vigenciaHastaParam).trim() !== '';
    const cols = ['profesional_id', 'dia_semana', 'hora_inicio', 'hora_fin', 'duracion_turno_minutos', 'activo'];
    const placeholders = [1, 2, 3, 4, 5, 6];
    const values = [profesional_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, activo];
    if (hasVigenciaDesde) {
      cols.push('vigencia_desde');
      placeholders.push(values.length + 1);
      values.push(String(vigenciaDesdeParam).trim().slice(0, 10));
    }
    if (hasVigenciaHasta) {
      cols.push('vigencia_hasta');
      placeholders.push(values.length + 1);
      values.push(String(vigenciaHastaParam).trim().slice(0, 10));
    }

    const result = await query(
      `INSERT INTO configuracion_agenda (${cols.join(', ')})
      VALUES (${placeholders.map((p) => `$${p}`).join(', ')})
      RETURNING *`,
      values
    );

    return result.rows[0];
  } catch (error) {
    logger.error('Error en create configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Actualizar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @param {Object} agendaData - Datos a actualizar
 * @returns {Promise<Object>} Configuración actualizada
 */
const update = async (id, agendaData) => {
  try {
    const fields = [];
    const values = [];
    let paramIndex = 1;
    
    if (agendaData.dia_semana !== undefined) {
      fields.push(`dia_semana = $${paramIndex++}`);
      values.push(agendaData.dia_semana);
    }
    
    if (agendaData.hora_inicio !== undefined) {
      fields.push(`hora_inicio = $${paramIndex++}`);
      values.push(agendaData.hora_inicio);
    }
    
    if (agendaData.hora_fin !== undefined) {
      fields.push(`hora_fin = $${paramIndex++}`);
      values.push(agendaData.hora_fin);
    }
    
    if (agendaData.duracion_turno_minutos !== undefined) {
      fields.push(`duracion_turno_minutos = $${paramIndex++}`);
      values.push(agendaData.duracion_turno_minutos);
    }
    
    if (agendaData.activo !== undefined) {
      fields.push(`activo = $${paramIndex++}`);
      values.push(agendaData.activo);
    }
    
    if (agendaData.vigencia_desde !== undefined) {
      fields.push(`vigencia_desde = $${paramIndex++}`);
      values.push(agendaData.vigencia_desde == null || String(agendaData.vigencia_desde).trim() === '' ? null : String(agendaData.vigencia_desde).trim().slice(0, 10));
    }
    
    if (agendaData.vigencia_hasta !== undefined) {
      fields.push(`vigencia_hasta = $${paramIndex++}`);
      values.push(agendaData.vigencia_hasta == null || String(agendaData.vigencia_hasta).trim() === '' ? null : String(agendaData.vigencia_hasta).trim().slice(0, 10));
    }
    
    if (fields.length === 0) {
      // Si no hay campos para actualizar, retornar el registro actual
      return await findById(id);
    }
    
    values.push(id);
    const sql = `
      UPDATE configuracion_agenda
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;
    
    const result = await query(sql, values);
    return result.rows[0];
  } catch (error) {
    logger.error('Error en update configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Eliminar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<boolean>} True si se eliminó correctamente
 */
const deleteAgenda = async (id) => {
  try {
    const result = await query(
      'DELETE FROM configuracion_agenda WHERE id = $1 RETURNING id',
      [id]
    );
    return result.rows.length > 0;
  } catch (error) {
    logger.error('Error en delete configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Activar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object>} Configuración actualizada
 */
const activate = async (id) => {
  try {
    const result = await query(
      'UPDATE configuracion_agenda SET activo = true WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en activate configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Desactivar configuración de agenda
 * @param {string} id - UUID de la configuración
 * @returns {Promise<Object>} Configuración actualizada
 */
const deactivate = async (id) => {
  try {
    const result = await query(
      'UPDATE configuracion_agenda SET activo = false WHERE id = $1 RETURNING *',
      [id]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error en deactivate configuracion_agenda:', error);
    throw error;
  }
};

/**
 * Cerrar periodo vigente de un profesional (set vigencia_hasta en todas las config vigentes)
 * @param {string} profesionalId - UUID del profesional
 * @param {string} [vigenciaHastaDate] - YYYY-MM-DD hasta la que rige la vigencia actual. Si la nueva agenda empieza el 1/3, pasar 'YYYY-MM-DD' del día anterior (ej. 29/2) para que febrero siga aplicando todo el mes. Si no se pasa, se usa CURRENT_DATE (cierre “desde hoy”).
 * @returns {Promise<number>} Cantidad de filas actualizadas
 */
const closeVigenciaForProfesional = async (profesionalId, vigenciaHastaDate = null) => {
  try {
    const params = [profesionalId];
    const setClause = vigenciaHastaDate && String(vigenciaHastaDate).trim()
      ? 'SET vigencia_hasta = $2'
      : 'SET vigencia_hasta = CURRENT_DATE';
    if (vigenciaHastaDate && String(vigenciaHastaDate).trim()) {
      params.push(String(vigenciaHastaDate).trim().slice(0, 10));
    }
    const result = await query(
      `UPDATE configuracion_agenda 
       ${setClause}
       WHERE profesional_id = $1 AND vigencia_hasta IS NULL
       RETURNING id`,
      params
    );
    return result.rows.length;
  } catch (error) {
    logger.error('Error en closeVigenciaForProfesional:', error);
    throw error;
  }
};

/**
 * Guardar horarios de la semana: cierra periodo vigente y crea nuevas configuraciones
 * @param {string} profesionalId - UUID del profesional
 * @param {Array<{dia_semana: number, hora_inicio: string, hora_fin: string}>} horarios - Lista de días con horario (solo los que atiende)
 * @param {string} [fechaDesde] - YYYY-MM-DD desde la que rige la nueva agenda
 * @param {number} [duracionTurnoMinutos] - Duración de cada turno en minutos (default 30)
 * @param {string} [fechaHasta] - YYYY-MM-DD hasta la que rige (opcional); si no se pasa, queda vigente (sin fin)
 * @returns {Promise<Array>} Configuraciones creadas
 */
const guardarHorariosSemana = async (profesionalId, horarios, fechaDesde = null, duracionTurnoMinutos = 30, fechaHasta = null) => {
  try {
    const normalizeTime = (t) => (t && t.length === 5 ? t + ':00' : t);
    const vigenciaDesde = (fechaDesde != null && String(fechaDesde).trim() !== '') ? String(fechaDesde).trim().slice(0, 10) : null;
    // Cerrar la vigencia anterior hasta (vigencia_desde de la nueva - 1 día): la anterior termina el día antes de que empiece la nueva. “vieja” sigue aplicando todo su mes).
    let vigenciaHastaCierre = null;
    if (vigenciaDesde) {
      const [yD, mD, dD] = vigenciaDesde.split('-').map(Number);
      const diaAnterior = new Date(yD, mD - 1, dD - 1);
      const y = diaAnterior.getFullYear();
      const m = String(diaAnterior.getMonth() + 1).padStart(2, '0');
      const d = String(diaAnterior.getDate()).padStart(2, '0');
      vigenciaHastaCierre = `${y}-${m}-${d}`;
    }
    await closeVigenciaForProfesional(profesionalId, vigenciaHastaCierre);
    const vigenciaHasta = (fechaHasta != null && String(fechaHasta).trim() !== '') ? String(fechaHasta).trim().slice(0, 10) : null;
    const duracion = (duracionTurnoMinutos != null && Number.isInteger(duracionTurnoMinutos) && duracionTurnoMinutos >= 5 && duracionTurnoMinutos <= 480)
      ? duracionTurnoMinutos
      : 30;
    const created = [];
    for (const h of horarios) {
      const row = await create({
        profesional_id: profesionalId,
        dia_semana: h.dia_semana,
        hora_inicio: normalizeTime(h.hora_inicio),
        hora_fin: normalizeTime(h.hora_fin),
        duracion_turno_minutos: duracion,
        activo: true,
        ...(vigenciaDesde && { vigencia_desde: vigenciaDesde }),
        ...(vigenciaHasta && { vigencia_hasta: vigenciaHasta }),
      });
      created.push(row);
    }
    return created;
  } catch (error) {
    logger.error('Error en guardarHorariosSemana:', error);
    throw error;
  }
};

module.exports = {
  findAll,
  findById,
  findByProfesional,
  checkDuplicate,
  vigentConfigCoversDateTime,
  create,
  update,
  delete: deleteAgenda,
  activate,
  deactivate,
  closeVigenciaForProfesional,
  guardarHorariosSemana,
};

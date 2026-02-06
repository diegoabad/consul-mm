/**
 * AGENDA.CONTROLLER.JS - Controlador de agenda
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con configuración de agenda y bloques no disponibles.
 */

const agendaModel = require('../models/agenda.model');
const excepcionAgendaModel = require('../models/excepcionAgenda.model');
const bloqueModel = require('../models/bloque.model');
const profesionalModel = require('../models/profesional.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

// ============================================
// CONTROLADORES PARA CONFIGURACIÓN DE AGENDA
// ============================================

/**
 * Listar configuraciones de agenda con filtros (por defecto solo vigentes)
 */
const getAllAgenda = async (req, res, next) => {
  try {
    const { profesional_id, dia_semana, activo, vigente } = req.query;
    const filters = {};
    
    if (profesional_id) filters.profesional_id = profesional_id;
    if (dia_semana !== undefined) filters.dia_semana = parseInt(dia_semana);
    if (activo !== undefined) filters.activo = activo === 'true';
    if (vigente !== undefined) filters.vigente = vigente !== 'false';
    
    const agendas = await agendaModel.findAll(filters);
    
    res.json(buildResponse(true, agendas, 'Configuraciones de agenda obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAllAgenda:', error);
    next(error);
  }
};

/**
 * Obtener configuración de agenda por ID
 */
const getAgendaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agenda = await agendaModel.findById(id);
    
    if (!agenda) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
    }
    
    res.json(buildResponse(true, agenda, 'Configuración de agenda obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getAgendaById:', error);
    next(error);
  }
};

/**
 * Obtener configuraciones de agenda de un profesional (por defecto solo vigentes)
 */
const getAgendaByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { solo_activos, vigente } = req.query;
    
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const vigenteFilter = vigente !== 'false';
    const agendas = await agendaModel.findByProfesional(id, solo_activos === 'true', vigenteFilter);
    
    res.json(buildResponse(true, agendas, 'Configuraciones de agenda del profesional obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAgendaByProfesional:', error);
    next(error);
  }
};

/**
 * Guardar horarios de la semana: cierra el periodo vigente y crea nuevas configuraciones
 * (permite historial: los turnos pasados siguen visibles con la agenda que tenían)
 */
/** Si el usuario es profesional, devuelve su profesional_id; si no, null */
const getProfesionalIdSiProfesional = async (userId, rol) => {
  if (rol !== 'profesional') return null;
  const p = await profesionalModel.findByUserId(userId);
  return p ? p.id : null;
};

const guardarHorariosSemana = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { horarios, fecha_desde: fechaDesde } = req.body;
    const miProfesionalId = await getProfesionalIdSiProfesional(req.user.id, req.user.rol);
    if (miProfesionalId !== null && miProfesionalId !== id) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permisos para modificar la agenda de otro profesional'));
    }
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se puede modificar la agenda de un profesional bloqueado'));
    }
    
    const created = await agendaModel.guardarHorariosSemana(id, horarios, fechaDesde);
    
    res.status(201).json(buildResponse(true, created, 'Horarios de la semana guardados correctamente'));
  } catch (error) {
    logger.error('Error en guardarHorariosSemana:', error);
    next(error);
  }
};

/**
 * Crear nueva configuración de agenda
 */
const createAgenda = async (req, res, next) => {
  try {
    const { profesional_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, activo, vigencia_desde } = req.body;
    const miProfesionalId = await getProfesionalIdSiProfesional(req.user.id, req.user.rol);
    if (miProfesionalId !== null && miProfesionalId !== profesional_id) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permisos para crear agenda de otro profesional'));
    }
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    // Verificar que el profesional no esté bloqueado
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear configuración de agenda para un profesional bloqueado'));
    }
    
    // Verificar duplicado
    const existeDuplicado = await agendaModel.checkDuplicate(profesional_id, dia_semana, hora_inicio);
    if (existeDuplicado) {
      return res.status(400).json(buildResponse(false, null, 'Ya existe una configuración de agenda para este profesional, día y hora de inicio'));
    }
    
    let agenda;
    try {
      agenda = await agendaModel.create({
      profesional_id,
      dia_semana,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos,
      activo,
      ...(vigencia_desde != null && String(vigencia_desde).trim() !== '' && { vigencia_desde: String(vigencia_desde).trim().slice(0, 10) })
      });
    } catch (error) {
      // Manejar error de duplicado de PostgreSQL
      if (error.code === '23505') {
        return res.status(400).json(buildResponse(false, null, 'Ya existe una configuración de agenda para este profesional, día y hora de inicio'));
      }
      throw error;
    }
    
    res.status(201).json(buildResponse(true, agenda, 'Configuración de agenda creada exitosamente'));
  } catch (error) {
    logger.error('Error en createAgenda:', error);
    next(error);
  }
};

/**
 * Actualizar configuración de agenda
 */
const updateAgenda = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const agendaExistente = await agendaModel.findById(id);
    if (!agendaExistente) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
    }
    const miProfesionalId = await getProfesionalIdSiProfesional(req.user.id, req.user.rol);
    if (miProfesionalId !== null && agendaExistente.profesional_id !== miProfesionalId) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permisos para modificar la agenda de otro profesional'));
    }
    // Si se actualiza dia_semana o hora_inicio, verificar duplicado
    if (updateData.dia_semana !== undefined || updateData.hora_inicio !== undefined) {
      const diaSemana = updateData.dia_semana !== undefined ? updateData.dia_semana : agendaExistente.dia_semana;
      const horaInicio = updateData.hora_inicio !== undefined ? updateData.hora_inicio : agendaExistente.hora_inicio;
      
      const existeDuplicado = await agendaModel.checkDuplicate(
        agendaExistente.profesional_id,
        diaSemana,
        horaInicio,
        id
      );
      
      if (existeDuplicado) {
        return res.status(400).json(buildResponse(false, null, 'Ya existe otra configuración de agenda para este profesional, día y hora de inicio'));
      }
    }
    
    const agenda = await agendaModel.update(id, updateData);
    
    res.json(buildResponse(true, agenda, 'Configuración de agenda actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en updateAgenda:', error);
    next(error);
  }
};

/**
 * Eliminar configuración de agenda
 */
const deleteAgenda = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const agenda = await agendaModel.findById(id);
    if (!agenda) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
    }
    
    const eliminado = await agendaModel.delete(id);
    
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar la configuración de agenda'));
    }
    
    res.json(buildResponse(true, null, 'Configuración de agenda eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en deleteAgenda:', error);
    next(error);
  }
};

/**
 * Activar configuración de agenda
 */
const activateAgenda = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agenda = await agendaModel.findById(id);
    if (!agenda) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
    }
    const miProfesionalId = await getProfesionalIdSiProfesional(req.user.id, req.user.rol);
    if (miProfesionalId !== null && agenda.profesional_id !== miProfesionalId) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permisos para modificar la agenda de otro profesional'));
    }
    if (agenda.activo) {
      return res.status(400).json(buildResponse(false, null, 'La configuración de agenda ya está activa'));
    }
    
    const agendaActualizada = await agendaModel.activate(id);
    
    res.json(buildResponse(true, agendaActualizada, 'Configuración de agenda activada exitosamente'));
  } catch (error) {
    logger.error('Error en activateAgenda:', error);
    next(error);
  }
};

/**
 * Desactivar configuración de agenda
 */
const deactivateAgenda = async (req, res, next) => {
  try {
    const { id } = req.params;
    const agenda = await agendaModel.findById(id);
    if (!agenda) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
    }
    const miProfesionalId = await getProfesionalIdSiProfesional(req.user.id, req.user.rol);
    if (miProfesionalId !== null && agenda.profesional_id !== miProfesionalId) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permisos para modificar la agenda de otro profesional'));
    }
    if (!agenda.activo) {
      return res.status(400).json(buildResponse(false, null, 'La configuración de agenda ya está inactiva'));
    }
    
    const agendaActualizada = await agendaModel.deactivate(id);
    
    res.json(buildResponse(true, agendaActualizada, 'Configuración de agenda desactivada exitosamente'));
  } catch (error) {
    logger.error('Error en deactivateAgenda:', error);
    next(error);
  }
};

// ============================================
// CONTROLADORES PARA BLOQUES NO DISPONIBLES
// ============================================

/**
 * Listar bloques no disponibles con filtros
 */
const getAllBloques = async (req, res, next) => {
  try {
    const { profesional_id, fecha_inicio, fecha_fin } = req.query;
    const filters = {};
    
    if (profesional_id) filters.profesional_id = profesional_id;
    if (fecha_inicio) filters.fecha_inicio = fecha_inicio;
    if (fecha_fin) filters.fecha_fin = fecha_fin;
    
    const bloques = await bloqueModel.findAll(filters);
    
    res.json(buildResponse(true, bloques, 'Bloques no disponibles obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAllBloques:', error);
    next(error);
  }
};

/**
 * Obtener bloque no disponible por ID
 */
const getBloqueById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const bloque = await bloqueModel.findById(id);
    
    if (!bloque) {
      return res.status(404).json(buildResponse(false, null, 'Bloque no disponible no encontrado'));
    }
    
    res.json(buildResponse(true, bloque, 'Bloque no disponible obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getBloqueById:', error);
    next(error);
  }
};

/**
 * Obtener bloques no disponibles de un profesional (opcional: rango fecha_inicio, fecha_fin YYYY-MM-DD)
 * Filtra por solapamiento: bloques que se solapan con [fecha_inicio, fecha_fin]
 */
const getBloquesByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const bloques = await bloqueModel.findByProfesional(
      id,
      fecha_inicio || null,
      fecha_fin || null
    );
    
    res.json(buildResponse(true, bloques, 'Bloques no disponibles del profesional obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getBloquesByProfesional:', error);
    next(error);
  }
};

/**
 * Crear nuevo bloque no disponible
 */
const createBloque = async (req, res, next) => {
  try {
    const { profesional_id, fecha_hora_inicio, fecha_hora_fin, motivo } = req.body;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    // Verificar solapamiento
    const fechaInicio = new Date(fecha_hora_inicio);
    const fechaFin = new Date(fecha_hora_fin);
    
    const haySolapamiento = await bloqueModel.checkOverlap(profesional_id, fechaInicio, fechaFin);
    if (haySolapamiento) {
      return res.status(400).json(buildResponse(false, null, 'Ya existe un bloque no disponible que se solapa con el rango de fechas especificado'));
    }
    
    const bloque = await bloqueModel.create({
      profesional_id,
      fecha_hora_inicio: fechaInicio,
      fecha_hora_fin: fechaFin,
      motivo
    });
    
    res.status(201).json(buildResponse(true, bloque, 'Bloque no disponible creado exitosamente'));
  } catch (error) {
    logger.error('Error en createBloque:', error);
    next(error);
  }
};

/**
 * Actualizar bloque no disponible
 */
const updateBloque = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que el bloque existe
    const bloqueExistente = await bloqueModel.findById(id);
    if (!bloqueExistente) {
      return res.status(404).json(buildResponse(false, null, 'Bloque no disponible no encontrado'));
    }
    
    // Si se actualizan las fechas, verificar solapamiento
    if (updateData.fecha_hora_inicio !== undefined || updateData.fecha_hora_fin !== undefined) {
      const fechaInicio = updateData.fecha_hora_inicio 
        ? new Date(updateData.fecha_hora_inicio) 
        : new Date(bloqueExistente.fecha_hora_inicio);
      const fechaFin = updateData.fecha_hora_fin 
        ? new Date(updateData.fecha_hora_fin) 
        : new Date(bloqueExistente.fecha_hora_fin);
      
      const haySolapamiento = await bloqueModel.checkOverlap(
        bloqueExistente.profesional_id,
        fechaInicio,
        fechaFin,
        id
      );
      
      if (haySolapamiento) {
        return res.status(400).json(buildResponse(false, null, 'Ya existe otro bloque no disponible que se solapa con el rango de fechas especificado'));
      }
      
      updateData.fecha_hora_inicio = fechaInicio;
      updateData.fecha_hora_fin = fechaFin;
    }
    
    const bloque = await bloqueModel.update(id, updateData);
    
    res.json(buildResponse(true, bloque, 'Bloque no disponible actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en updateBloque:', error);
    next(error);
  }
};

/**
 * Eliminar bloque no disponible
 */
const deleteBloque = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const bloque = await bloqueModel.findById(id);
    if (!bloque) {
      return res.status(404).json(buildResponse(false, null, 'Bloque no disponible no encontrado'));
    }
    
    const eliminado = await bloqueModel.delete(id);
    
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar el bloque no disponible'));
    }
    
    res.json(buildResponse(true, null, 'Bloque no disponible eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en deleteBloque:', error);
    next(error);
  }
};

// ============================================
// EXCEPCIONES DE AGENDA
// ============================================

/**
 * Listar excepciones de agenda con filtros (profesional_id, fecha_desde, fecha_hasta)
 */
const getAllExcepciones = async (req, res, next) => {
  try {
    const { profesional_id, fecha_desde, fecha_hasta } = req.query;
    const filters = {};
    if (profesional_id) filters.profesional_id = profesional_id;
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;
    const excepciones = await excepcionAgendaModel.findAll(filters);
    res.json(buildResponse(true, excepciones, 'Excepciones de agenda obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAllExcepciones:', error);
    next(error);
  }
};

/**
 * Obtener excepción por ID
 */
const getExcepcionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const excepcion = await excepcionAgendaModel.findById(id);
    if (!excepcion) {
      return res.status(404).json(buildResponse(false, null, 'Excepción de agenda no encontrada'));
    }
    res.json(buildResponse(true, excepcion, 'Excepción de agenda obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getExcepcionById:', error);
    next(error);
  }
};

/**
 * Obtener excepciones de un profesional (opcional: rango de fechas)
 */
const getExcepcionesByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_desde, fecha_hasta } = req.query;
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    let excepciones;
    if (fecha_desde && fecha_hasta) {
      excepciones = await excepcionAgendaModel.findByProfesionalAndDateRange(id, fecha_desde, fecha_hasta);
    } else {
      excepciones = await excepcionAgendaModel.findAll({ profesional_id: id });
    }
    res.json(buildResponse(true, excepciones, 'Excepciones del profesional obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getExcepcionesByProfesional:', error);
    next(error);
  }
};

/**
 * Crear excepción de agenda
 */
const createExcepcion = async (req, res, next) => {
  try {
    const { profesional_id, fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones } = req.body;
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear excepción de agenda para un profesional bloqueado'));
    }
    const excepcion = await excepcionAgendaModel.create({
      profesional_id,
      fecha,
      hora_inicio,
      hora_fin,
      duracion_turno_minutos: duracion_turno_minutos ?? 30,
      observaciones: observaciones || null
    });
    res.status(201).json(buildResponse(true, excepcion, 'Excepción de agenda creada exitosamente'));
  } catch (error) {
    logger.error('Error en createExcepcion:', error);
    next(error);
  }
};

/**
 * Actualizar excepción de agenda
 */
const updateExcepcion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const excepcionExistente = await excepcionAgendaModel.findById(id);
    if (!excepcionExistente) {
      return res.status(404).json(buildResponse(false, null, 'Excepción de agenda no encontrada'));
    }
    const updateData = {};
    const { fecha, hora_inicio, hora_fin, duracion_turno_minutos, observaciones } = req.body;
    if (fecha !== undefined) updateData.fecha = fecha;
    if (hora_inicio !== undefined) updateData.hora_inicio = hora_inicio;
    if (hora_fin !== undefined) updateData.hora_fin = hora_fin;
    if (duracion_turno_minutos !== undefined) updateData.duracion_turno_minutos = duracion_turno_minutos;
    if (observaciones !== undefined) updateData.observaciones = observaciones;
    const excepcion = await excepcionAgendaModel.update(id, updateData);
    res.json(buildResponse(true, excepcion, 'Excepción de agenda actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en updateExcepcion:', error);
    next(error);
  }
};

/**
 * Eliminar excepción de agenda
 */
const deleteExcepcion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const excepcion = await excepcionAgendaModel.findById(id);
    if (!excepcion) {
      return res.status(404).json(buildResponse(false, null, 'Excepción de agenda no encontrada'));
    }
    const eliminado = await excepcionAgendaModel.delete(id);
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar la excepción de agenda'));
    }
    res.json(buildResponse(true, null, 'Excepción de agenda eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en deleteExcepcion:', error);
    next(error);
  }
};

module.exports = {
  // Configuración de agenda
  getAllAgenda,
  getAgendaById,
  getAgendaByProfesional,
  guardarHorariosSemana,
  createAgenda,
  updateAgenda,
  deleteAgenda,
  activateAgenda,
  deactivateAgenda,
  // Bloques no disponibles
  getAllBloques,
  getBloqueById,
  getBloquesByProfesional,
  createBloque,
  updateBloque,
  deleteBloque,
  // Excepciones de agenda
  getAllExcepciones,
  getExcepcionById,
  getExcepcionesByProfesional,
  createExcepcion,
  updateExcepcion,
  deleteExcepcion
};

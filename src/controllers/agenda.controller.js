/**
 * AGENDA.CONTROLLER.JS - Controlador de agenda
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con configuración de agenda y bloques no disponibles.
 */

const agendaModel = require('../models/agenda.model');
const bloqueModel = require('../models/bloque.model');
const profesionalModel = require('../models/profesional.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

// ============================================
// CONTROLADORES PARA CONFIGURACIÓN DE AGENDA
// ============================================

/**
 * Listar configuraciones de agenda con filtros
 */
const getAllAgenda = async (req, res, next) => {
  try {
    const { profesional_id, dia_semana, activo } = req.query;
    const filters = {};
    
    if (profesional_id) filters.profesional_id = profesional_id;
    if (dia_semana !== undefined) filters.dia_semana = parseInt(dia_semana);
    if (activo !== undefined) filters.activo = activo === 'true';
    
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
 * Obtener configuraciones de agenda de un profesional
 */
const getAgendaByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { solo_activos } = req.query;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const agendas = await agendaModel.findByProfesional(id, solo_activos === 'true');
    
    res.json(buildResponse(true, agendas, 'Configuraciones de agenda del profesional obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAgendaByProfesional:', error);
    next(error);
  }
};

/**
 * Crear nueva configuración de agenda
 */
const createAgenda = async (req, res, next) => {
  try {
    const { profesional_id, dia_semana, hora_inicio, hora_fin, duracion_turno_minutos, activo } = req.body;
    
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
      activo
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
    
    // Verificar que la configuración existe
    const agendaExistente = await agendaModel.findById(id);
    if (!agendaExistente) {
      return res.status(404).json(buildResponse(false, null, 'Configuración de agenda no encontrada'));
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
 * Obtener bloques no disponibles de un profesional
 */
const getBloquesByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const bloques = await bloqueModel.findByProfesional(
      id,
      fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin ? new Date(fecha_fin) : null
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

module.exports = {
  // Configuración de agenda
  getAllAgenda,
  getAgendaById,
  getAgendaByProfesional,
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
  deleteBloque
};

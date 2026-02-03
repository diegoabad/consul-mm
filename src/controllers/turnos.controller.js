/**
 * TURNOS.CONTROLLER.JS - Controlador de turnos médicos
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con turnos médicos.
 */

const turnoModel = require('../models/turno.model');
const profesionalModel = require('../models/profesional.model');
const pacienteModel = require('../models/paciente.model');
const bloqueModel = require('../models/bloque.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');
const { ESTADOS_TURNO } = require('../utils/constants');

/**
 * Listar turnos con filtros
 */
const getAll = async (req, res, next) => {
  try {
    const { profesional_id, paciente_id, estado, fecha_inicio, fecha_fin } = req.query;
    const filters = {};
    
    if (profesional_id) filters.profesional_id = profesional_id;
    if (paciente_id) filters.paciente_id = paciente_id;
    if (estado) filters.estado = estado;
    if (fecha_inicio) filters.fecha_inicio = fecha_inicio;
    if (fecha_fin) filters.fecha_fin = fecha_fin;
    
    const turnos = await turnoModel.findAll(filters);
    
    res.json(buildResponse(true, turnos, 'Turnos obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll turnos:', error);
    next(error);
  }
};

/**
 * Obtener turno por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const turno = await turnoModel.findById(id);
    
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    res.json(buildResponse(true, turno, 'Turno obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById turno:', error);
    next(error);
  }
};

/**
 * Obtener turnos de un profesional
 */
const getByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    const turnos = await turnoModel.findByProfesional(id, fecha_inicio || null, fecha_fin || null);
    
    res.json(buildResponse(true, turnos, 'Turnos del profesional obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByProfesional turnos:', error);
    next(error);
  }
};

/**
 * Obtener turnos de un paciente
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    const turnos = await turnoModel.findByPaciente(id, fecha_inicio || null, fecha_fin || null);
    
    res.json(buildResponse(true, turnos, 'Turnos del paciente obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente turnos:', error);
    next(error);
  }
};

/**
 * Verificar disponibilidad de un horario
 */
const checkAvailability = async (req, res, next) => {
  try {
    const { profesional_id, fecha_hora_inicio, fecha_hora_fin } = req.query;
    
    if (!profesional_id || !fecha_hora_inicio || !fecha_hora_fin) {
      return res.status(400).json(buildResponse(false, null, 'profesional_id, fecha_hora_inicio y fecha_hora_fin son requeridos'));
    }
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'El profesional está bloqueado'));
    }
    
    const disponible = await turnoModel.checkAvailability(
      profesional_id,
      new Date(fecha_hora_inicio),
      new Date(fecha_hora_fin)
    );
    
    res.json(buildResponse(true, { disponible }, disponible ? 'Horario disponible' : 'Horario no disponible'));
  } catch (error) {
    logger.error('Error en checkAvailability turno:', error);
    next(error);
  }
};

/**
 * Crear nuevo turno
 */
const create = async (req, res, next) => {
  try {
    const {
      profesional_id,
      paciente_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      estado,
      motivo
    } = req.body;
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para profesionales bloqueados'));
    }
    
    // Verificar que el paciente existe y está activo
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para pacientes inactivos'));
    }
    
    // Verificar disponibilidad (solapamiento con otros turnos)
    const disponible = await turnoModel.checkAvailability(
      profesional_id,
      new Date(fecha_hora_inicio),
      new Date(fecha_hora_fin)
    );
    
    if (!disponible) {
      return res.status(409).json(buildResponse(false, null, 'El horario no está disponible'));
    }
    
    // Verificar que no caiga dentro de un bloque no disponible (vacaciones, ausencias, etc.)
    const hayBloque = await bloqueModel.checkOverlap(
      profesional_id,
      new Date(fecha_hora_inicio),
      new Date(fecha_hora_fin)
    );
    if (hayBloque) {
      return res.status(400).json(buildResponse(false, null, 'El horario está dentro de un período bloqueado'));
    }
    
    const nuevoTurno = await turnoModel.create({
      profesional_id,
      paciente_id,
      fecha_hora_inicio: new Date(fecha_hora_inicio),
      fecha_hora_fin: new Date(fecha_hora_fin),
      estado: estado || ESTADOS_TURNO.PENDIENTE,
      motivo: motivo || null
    });
    
    logger.info('Turno creado:', { id: nuevoTurno.id, profesional_id, paciente_id, fecha_hora_inicio });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(nuevoTurno.id);
    
    res.status(201).json(buildResponse(true, turnoCompleto, 'Turno creado exitosamente'));
  } catch (error) {
    logger.error('Error en create turno:', error);
    next(error);
  }
};

/**
 * Actualizar turno
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que el turno existe
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    // Si se cambia la fecha/hora, verificar disponibilidad
    if (updateData.fecha_hora_inicio || updateData.fecha_hora_fin) {
      const fechaHoraInicio = updateData.fecha_hora_inicio ? new Date(updateData.fecha_hora_inicio) : new Date(turno.fecha_hora_inicio);
      const fechaHoraFin = updateData.fecha_hora_fin ? new Date(updateData.fecha_hora_fin) : new Date(turno.fecha_hora_fin);
      
      const disponible = await turnoModel.checkAvailability(
        turno.profesional_id,
        fechaHoraInicio,
        fechaHoraFin,
        id // Excluir el turno actual
      );
      
      if (!disponible) {
        return res.status(409).json(buildResponse(false, null, 'El nuevo horario no está disponible'));
      }
    }
    
    const turnoActualizado = await turnoModel.update(id, {
      ...updateData,
      fecha_hora_inicio: updateData.fecha_hora_inicio ? new Date(updateData.fecha_hora_inicio) : undefined,
      fecha_hora_fin: updateData.fecha_hora_fin ? new Date(updateData.fecha_hora_fin) : undefined
    });
    
    logger.info('Turno actualizado:', { id, cambios: updateData });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update turno:', error);
    next(error);
  }
};

/**
 * Cancelar turno
 */
const cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razon_cancelacion } = req.body;
    const canceladoPor = req.user?.id || null;
    
    // Verificar que el turno existe
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está cancelado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede cancelar un turno completado'));
    }
    
    const turnoCancelado = await turnoModel.cancel(id, razon_cancelacion || null, canceladoPor);
    
    logger.info('Turno cancelado:', { id, razon_cancelacion, canceladoPor });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno cancelado exitosamente'));
  } catch (error) {
    logger.error('Error en cancel turno:', error);
    next(error);
  }
};

/**
 * Confirmar turno
 */
const confirm = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el turno existe
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CONFIRMADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está confirmado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede confirmar un turno cancelado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede confirmar un turno completado'));
    }
    
    const turnoConfirmado = await turnoModel.confirm(id);
    
    logger.info('Turno confirmado:', { id });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno confirmado exitosamente'));
  } catch (error) {
    logger.error('Error en confirm turno:', error);
    next(error);
  }
};

/**
 * Completar turno
 */
const complete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el turno existe
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está completado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede completar un turno cancelado'));
    }
    
    const turnoCompletado = await turnoModel.complete(id);
    
    logger.info('Turno completado:', { id });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno completado exitosamente'));
  } catch (error) {
    logger.error('Error en complete turno:', error);
    next(error);
  }
};

/**
 * Eliminar turno
 */
const deleteTurno = async (req, res, next) => {
  try {
    const { id } = req.params;

    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }

    await turnoModel.deleteById(id);

    logger.info('Turno eliminado:', { id });

    res.json(buildResponse(true, { id }, 'Turno eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en delete turno:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByProfesional,
  getByPaciente,
  checkAvailability,
  create,
  update,
  cancel,
  confirm,
  complete,
  delete: deleteTurno
};

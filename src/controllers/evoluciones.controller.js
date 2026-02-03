/**
 * EVOLUCIONES.CONTROLLER.JS - Controlador de evoluciones clínicas
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con evoluciones clínicas de pacientes.
 */

const evolucionModel = require('../models/evolucion.model');
const pacienteModel = require('../models/paciente.model');
const profesionalModel = require('../models/profesional.model');
const turnoModel = require('../models/turno.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar evoluciones clínicas con filtros
 */
const getAll = async (req, res, next) => {
  try {
    const { paciente_id, profesional_id, turno_id, fecha_inicio, fecha_fin } = req.query;
    const filters = {};
    
    if (paciente_id) filters.paciente_id = paciente_id;
    if (profesional_id) filters.profesional_id = profesional_id;
    if (turno_id) filters.turno_id = turno_id;
    if (fecha_inicio) filters.fecha_inicio = fecha_inicio;
    if (fecha_fin) filters.fecha_fin = fecha_fin;
    
    const evoluciones = await evolucionModel.findAll(filters);
    
    res.json(buildResponse(true, evoluciones, 'Evoluciones clínicas obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAll evoluciones:', error);
    next(error);
  }
};

/**
 * Obtener evolución clínica por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const evolucion = await evolucionModel.findById(id);
    
    if (!evolucion) {
      return res.status(404).json(buildResponse(false, null, 'Evolución clínica no encontrada'));
    }
    
    res.json(buildResponse(true, evolucion, 'Evolución clínica obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getById evolucion:', error);
    next(error);
  }
};

/**
 * Obtener evoluciones clínicas de un paciente
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    const evoluciones = await evolucionModel.findByPaciente(
      id,
      fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin ? new Date(fecha_fin) : null
    );
    
    res.json(buildResponse(true, evoluciones, 'Evoluciones clínicas del paciente obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente evoluciones:', error);
    next(error);
  }
};

/**
 * Obtener evoluciones clínicas de un profesional
 */
const getByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const evoluciones = await evolucionModel.findByProfesional(
      id,
      fecha_inicio ? new Date(fecha_inicio) : null,
      fecha_fin ? new Date(fecha_fin) : null
    );
    
    res.json(buildResponse(true, evoluciones, 'Evoluciones clínicas del profesional obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByProfesional evoluciones:', error);
    next(error);
  }
};

/**
 * Obtener evoluciones clínicas de un turno
 */
const getByTurno = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el turno existe
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    const evoluciones = await evolucionModel.findByTurno(id);
    
    res.json(buildResponse(true, evoluciones, 'Evoluciones clínicas del turno obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByTurno evoluciones:', error);
    next(error);
  }
};

/**
 * Crear nueva evolución clínica
 */
const create = async (req, res, next) => {
  try {
    const { paciente_id, profesional_id, turno_id, fecha_consulta, motivo_consulta, diagnostico, tratamiento, observaciones } = req.body;
    
    // Verificar que el paciente existe y está activo
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear evolución clínica para un paciente inactivo'));
    }
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear evolución clínica para un profesional bloqueado'));
    }
    
    // Si se proporciona turno_id, verificar que existe
    if (turno_id) {
      const turno = await turnoModel.findById(turno_id);
      if (!turno) {
        return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
      }
      // Verificar que el turno corresponde al paciente y profesional
      if (turno.paciente_id !== paciente_id) {
        return res.status(400).json(buildResponse(false, null, 'El turno no corresponde al paciente especificado'));
      }
      if (turno.profesional_id !== profesional_id) {
        return res.status(400).json(buildResponse(false, null, 'El turno no corresponde al profesional especificado'));
      }
    }
    
    const evolucion = await evolucionModel.create({
      paciente_id,
      profesional_id,
      turno_id: turno_id || null,
      fecha_consulta: new Date(fecha_consulta),
      motivo_consulta: motivo_consulta || null,
      diagnostico: diagnostico || null,
      tratamiento: tratamiento || null,
      observaciones: observaciones || null
    });
    
    res.status(201).json(buildResponse(true, evolucion, 'Evolución clínica creada exitosamente'));
  } catch (error) {
    logger.error('Error en create evolucion:', error);
    next(error);
  }
};

/**
 * Actualizar evolución clínica
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que la evolución existe
    const evolucionExistente = await evolucionModel.findById(id);
    if (!evolucionExistente) {
      return res.status(404).json(buildResponse(false, null, 'Evolución clínica no encontrada'));
    }
    
    // Si se actualiza turno_id, verificar que existe
    if (updateData.turno_id !== undefined && updateData.turno_id !== null) {
      const turno = await turnoModel.findById(updateData.turno_id);
      if (!turno) {
        return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
      }
      // Verificar que el turno corresponde al paciente y profesional de la evolución
      if (turno.paciente_id !== evolucionExistente.paciente_id) {
        return res.status(400).json(buildResponse(false, null, 'El turno no corresponde al paciente de la evolución'));
      }
      if (turno.profesional_id !== evolucionExistente.profesional_id) {
        return res.status(400).json(buildResponse(false, null, 'El turno no corresponde al profesional de la evolución'));
      }
    }
    
    // Convertir fecha_consulta a Date si se proporciona
    if (updateData.fecha_consulta !== undefined) {
      updateData.fecha_consulta = new Date(updateData.fecha_consulta);
    }
    
    const evolucion = await evolucionModel.update(id, updateData);
    
    res.json(buildResponse(true, evolucion, 'Evolución clínica actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update evolucion:', error);
    next(error);
  }
};

/**
 * Eliminar evolución clínica
 */
const deleteEvolucion = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const evolucion = await evolucionModel.findById(id);
    if (!evolucion) {
      return res.status(404).json(buildResponse(false, null, 'Evolución clínica no encontrada'));
    }
    
    const eliminado = await evolucionModel.delete(id);
    
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar la evolución clínica'));
    }
    
    res.json(buildResponse(true, null, 'Evolución clínica eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en delete evolucion:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByPaciente,
  getByProfesional,
  getByTurno,
  create,
  update,
  delete: deleteEvolucion
};

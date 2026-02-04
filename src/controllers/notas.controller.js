/**
 * NOTAS.CONTROLLER.JS - Controlador de notas de paciente
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con notas administrativas sobre pacientes.
 */

const notaModel = require('../models/nota.model');
const pacienteModel = require('../models/paciente.model');
const usuarioModel = require('../models/usuario.model');
const profesionalModel = require('../models/profesional.model');
const pacienteProfesionalModel = require('../models/pacienteProfesional.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar notas con filtros.
 * Si el usuario es profesional, solo ve sus propias notas.
 */
const getAll = async (req, res, next) => {
  try {
    const { paciente_id, usuario_id } = req.query;
    const filters = {};
    
    if (paciente_id) filters.paciente_id = paciente_id;
    if (usuario_id) filters.usuario_id = usuario_id;
    
    if (req.user.rol === 'profesional') {
      filters.usuario_id = req.user.id;
    }
    
    const notas = await notaModel.findAll(filters);
    
    res.json(buildResponse(true, notas, 'Notas obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAll notas:', error);
    next(error);
  }
};

/**
 * Obtener nota por ID.
 * Si el usuario es profesional, solo puede ver sus propias notas.
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nota = await notaModel.findById(id);
    
    if (!nota) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
    }
    
    if (req.user.rol === 'profesional' && nota.usuario_id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permiso para ver esta nota'));
    }
    
    res.json(buildResponse(true, nota, 'Nota obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getById nota:', error);
    next(error);
  }
};

/**
 * Obtener notas de un paciente.
 * Si el usuario es profesional, debe estar asignado al paciente y solo ve sus propias notas.
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    let notas = await notaModel.findByPaciente(id);
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(id)) {
        return res.status(403).json(buildResponse(false, null, 'No tiene asignado este paciente'));
      }
      notas = notas.filter((n) => n.usuario_id === req.user.id);
    }
    
    res.json(buildResponse(true, notas, 'Notas del paciente obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente notas:', error);
    next(error);
  }
};

/**
 * Obtener notas de un usuario.
 * Si el usuario es profesional, solo puede consultar sus propias notas.
 */
const getByUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    if (req.user.rol === 'profesional' && id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'Solo puede ver sus propias notas'));
    }
    
    const notas = await notaModel.findByUsuario(id);
    
    res.json(buildResponse(true, notas, 'Notas del usuario obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByUsuario notas:', error);
    next(error);
  }
};

/**
 * Crear nueva nota.
 * Si el usuario es profesional, solo puede crear como él mismo y debe estar asignado al paciente.
 */
const create = async (req, res, next) => {
  try {
    let { paciente_id, usuario_id, contenido } = req.body;
    
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear nota para un paciente inactivo'));
    }
    
    if (req.user.rol === 'profesional') {
      usuario_id = req.user.id;
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(paciente_id)) {
        return res.status(403).json(buildResponse(false, null, 'Debe estar asignado al paciente para crear notas'));
      }
    }
    
    const usuario = await usuarioModel.findById(usuario_id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    if (!usuario.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear nota para un usuario inactivo'));
    }
    
    const nota = await notaModel.create({
      paciente_id,
      usuario_id,
      contenido
    });
    
    res.status(201).json(buildResponse(true, nota, 'Nota creada exitosamente'));
  } catch (error) {
    logger.error('Error en create nota:', error);
    next(error);
  }
};

/**
 * Actualizar nota.
 * Si el usuario es profesional, solo puede actualizar sus propias notas.
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    
    const notaExistente = await notaModel.findById(id);
    if (!notaExistente) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
    }
    
    if (req.user.rol === 'profesional' && notaExistente.usuario_id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permiso para editar esta nota'));
    }
    
    const nota = await notaModel.update(id, { contenido });
    
    res.json(buildResponse(true, nota, 'Nota actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update nota:', error);
    next(error);
  }
};

/**
 * Eliminar nota.
 * Si el usuario es profesional, solo puede eliminar sus propias notas.
 */
const deleteNota = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const nota = await notaModel.findById(id);
    if (!nota) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
    }
    
    if (req.user.rol === 'profesional' && nota.usuario_id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'No tiene permiso para eliminar esta nota'));
    }
    
    const eliminado = await notaModel.delete(id);
    
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar la nota'));
    }
    
    res.json(buildResponse(true, null, 'Nota eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en delete nota:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByPaciente,
  getByUsuario,
  create,
  update,
  delete: deleteNota
};

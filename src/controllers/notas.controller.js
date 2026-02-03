/**
 * NOTAS.CONTROLLER.JS - Controlador de notas de paciente
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con notas administrativas sobre pacientes.
 */

const notaModel = require('../models/nota.model');
const pacienteModel = require('../models/paciente.model');
const usuarioModel = require('../models/usuario.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar notas con filtros
 */
const getAll = async (req, res, next) => {
  try {
    const { paciente_id, usuario_id } = req.query;
    const filters = {};
    
    if (paciente_id) filters.paciente_id = paciente_id;
    if (usuario_id) filters.usuario_id = usuario_id;
    
    const notas = await notaModel.findAll(filters);
    
    res.json(buildResponse(true, notas, 'Notas obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getAll notas:', error);
    next(error);
  }
};

/**
 * Obtener nota por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const nota = await notaModel.findById(id);
    
    if (!nota) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
    }
    
    res.json(buildResponse(true, nota, 'Nota obtenida exitosamente'));
  } catch (error) {
    logger.error('Error en getById nota:', error);
    next(error);
  }
};

/**
 * Obtener notas de un paciente
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    const notas = await notaModel.findByPaciente(id);
    
    res.json(buildResponse(true, notas, 'Notas del paciente obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente notas:', error);
    next(error);
  }
};

/**
 * Obtener notas de un usuario
 */
const getByUsuario = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el usuario existe
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    const notas = await notaModel.findByUsuario(id);
    
    res.json(buildResponse(true, notas, 'Notas del usuario obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en getByUsuario notas:', error);
    next(error);
  }
};

/**
 * Crear nueva nota
 */
const create = async (req, res, next) => {
  try {
    const { paciente_id, usuario_id, contenido } = req.body;
    
    // Verificar que el paciente existe y está activo
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se puede crear nota para un paciente inactivo'));
    }
    
    // Verificar que el usuario existe y está activo
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
 * Actualizar nota
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    
    // Verificar que la nota existe
    const notaExistente = await notaModel.findById(id);
    if (!notaExistente) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
    }
    
    const nota = await notaModel.update(id, { contenido });
    
    res.json(buildResponse(true, nota, 'Nota actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update nota:', error);
    next(error);
  }
};

/**
 * Eliminar nota
 */
const deleteNota = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const nota = await notaModel.findById(id);
    if (!nota) {
      return res.status(404).json(buildResponse(false, null, 'Nota no encontrada'));
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

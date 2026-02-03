/**
 * PACIENTES.CONTROLLER.JS - Controlador de pacientes
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas
 * con pacientes.
 */

const pacienteModel = require('../models/paciente.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar todos los pacientes
 */
const getAll = async (req, res, next) => {
  try {
    const { activo, obra_social } = req.query;
    const filters = {};
    
    if (activo !== undefined) filters.activo = activo === 'true';
    if (obra_social) filters.obra_social = obra_social;
    
    const pacientes = await pacienteModel.findAll(filters);
    
    res.json(buildResponse(true, pacientes, 'Pacientes obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll pacientes:', error);
    next(error);
  }
};

/**
 * Obtener paciente por DNI
 */
const getByDni = async (req, res, next) => {
  try {
    const { dni } = req.query;
    if (!dni || !String(dni).trim()) {
      return res.status(400).json(buildResponse(false, null, 'El DNI es requerido'));
    }
    const paciente = await pacienteModel.findByDni(String(dni).trim());
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    res.json(buildResponse(true, paciente, 'Paciente obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getByDni paciente:', error);
    next(error);
  }
};

/**
 * Obtener paciente por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const paciente = await pacienteModel.findById(id);
    
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    res.json(buildResponse(true, paciente, 'Paciente obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById paciente:', error);
    next(error);
  }
};

/**
 * Buscar pacientes por nombre, apellido o DNI
 */
const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json(buildResponse(false, null, 'El término de búsqueda debe tener al menos 2 caracteres'));
    }
    
    const pacientes = await pacienteModel.search(q);
    
    res.json(buildResponse(true, pacientes, `Se encontraron ${pacientes.length} pacientes`));
  } catch (error) {
    logger.error('Error en search pacientes:', error);
    next(error);
  }
};

/**
 * Crear nuevo paciente
 */
const create = async (req, res, next) => {
  try {
    const {
      dni,
      nombre,
      apellido,
      fecha_nacimiento,
      telefono,
      email,
      direccion,
      obra_social,
      numero_afiliado,
      contacto_emergencia_nombre,
      contacto_emergencia_telefono,
      activo
    } = req.body;
    
    // Verificar si el DNI ya existe
    const pacienteExistente = await pacienteModel.findByDni(dni);
    if (pacienteExistente) {
      return res.status(409).json(buildResponse(false, null, 'El DNI ya está registrado'));
    }
    
    const nuevoPaciente = await pacienteModel.create({
      dni,
      nombre,
      apellido,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      direccion: direccion || null,
      obra_social: obra_social || null,
      numero_afiliado: numero_afiliado || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre || null,
      contacto_emergencia_telefono: contacto_emergencia_telefono || null,
      activo: activo !== undefined ? activo : true
    });
    
    logger.info('Paciente creado:', { id: nuevoPaciente.id, dni, nombre, apellido });
    
    res.status(201).json(buildResponse(true, nuevoPaciente, 'Paciente creado exitosamente'));
  } catch (error) {
    logger.error('Error en create paciente:', error);
    next(error);
  }
};

/**
 * Actualizar paciente
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    // Si se actualiza el DNI, verificar que no esté en uso
    if (updateData.dni && updateData.dni !== paciente.dni) {
      const pacienteConDni = await pacienteModel.findByDni(updateData.dni);
      if (pacienteConDni) {
        return res.status(409).json(buildResponse(false, null, 'El DNI ya está registrado'));
      }
    }
    
    const pacienteActualizado = await pacienteModel.update(id, updateData);
    
    logger.info('Paciente actualizado:', { id, cambios: updateData });
    
    res.json(buildResponse(true, pacienteActualizado, 'Paciente actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update paciente:', error);
    next(error);
  }
};

/**
 * Eliminar paciente (soft delete)
 */
const deletePaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    await pacienteModel.delete(id);
    
    logger.info('Paciente eliminado:', { id });
    
    res.json(buildResponse(true, null, 'Paciente eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en delete paciente:', error);
    next(error);
  }
};

/**
 * Activar paciente
 */
const activate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'El paciente ya está activo'));
    }
    
    const pacienteActivado = await pacienteModel.activate(id);
    
    logger.info('Paciente activado:', { id });
    
    res.json(buildResponse(true, pacienteActivado, 'Paciente activado exitosamente'));
  } catch (error) {
    logger.error('Error en activate paciente:', error);
    next(error);
  }
};

/**
 * Desactivar paciente
 */
const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el paciente existe
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'El paciente ya está inactivo'));
    }
    
    const pacienteDesactivado = await pacienteModel.deactivate(id);
    
    logger.info('Paciente desactivado:', { id });
    
    res.json(buildResponse(true, pacienteDesactivado, 'Paciente desactivado exitosamente'));
  } catch (error) {
    logger.error('Error en deactivate paciente:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getByDni,
  getById,
  search,
  create,
  update,
  delete: deletePaciente,
  activate,
  deactivate
};

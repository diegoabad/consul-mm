/**
 * PACIENTES.CONTROLLER.JS - Controlador de pacientes
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas
 * con pacientes.
 */

const pacienteModel = require('../models/paciente.model');
const profesionalModel = require('../models/profesional.model');
const pacienteProfesionalModel = require('../models/pacienteProfesional.model');
const logger = require('../utils/logger');
const { buildResponse, normalizeToLowerCase } = require('../utils/helpers');

/**
 * Listar todos los pacientes (para profesional solo los asignados)
 */
const getAll = async (req, res, next) => {
  try {
    const { activo, obra_social } = req.query;
    const filters = {};
    
    if (activo !== undefined) filters.activo = activo === 'true';
    if (obra_social) filters.obra_social = obra_social;
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.json(buildResponse(true, [], 'Pacientes obtenidos exitosamente'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (pacienteIds.length === 0) {
        return res.json(buildResponse(true, [], 'Pacientes obtenidos exitosamente'));
      }
      filters.ids = pacienteIds;
    }
    
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
    // Si es profesional, indicar si ya tiene asignado este paciente (para mostrar "Ver ficha" en el modal)
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      let ya_asignado = false;
      if (profesional) {
        const asignaciones = await pacienteProfesionalModel.findAll({
          paciente_id: paciente.id,
          profesional_id: profesional.id
        });
        ya_asignado = asignaciones.length > 0;
      }
      return res.json(buildResponse(true, { ...paciente, ya_asignado }, 'Paciente obtenido exitosamente'));
    }
    res.json(buildResponse(true, paciente, 'Paciente obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getByDni paciente:', error);
    next(error);
  }
};

/**
 * Obtener paciente por ID (profesional solo si está asignado al paciente)
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const paciente = await pacienteModel.findById(id);
    
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'No tiene acceso a este paciente'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(id)) {
        return res.status(403).json(buildResponse(false, null, 'No tiene acceso a este paciente'));
      }
    }
    
    res.json(buildResponse(true, paciente, 'Paciente obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById paciente:', error);
    next(error);
  }
};

/**
 * Buscar pacientes por nombre, apellido o DNI (profesional solo entre sus asignados)
 */
const search = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json(buildResponse(false, null, 'El término de búsqueda debe tener al menos 2 caracteres'));
    }
    
    let pacientes = await pacienteModel.search(q);
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.json(buildResponse(true, [], 'Se encontraron 0 pacientes'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (pacienteIds.length === 0) {
        return res.json(buildResponse(true, [], 'Se encontraron 0 pacientes'));
      }
      const idSet = new Set(pacienteIds);
      pacientes = pacientes.filter((p) => idSet.has(p.id));
    }
    
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
      nombre: normalizeToLowerCase(nombre) ?? nombre,
      apellido: normalizeToLowerCase(apellido) ?? apellido,
      fecha_nacimiento: fecha_nacimiento || null,
      telefono: telefono || null,
      email: email || null,
      direccion: direccion ? normalizeToLowerCase(direccion) : null,
      obra_social: obra_social ? normalizeToLowerCase(obra_social) : null,
      numero_afiliado: numero_afiliado || null,
      contacto_emergencia_nombre: contacto_emergencia_nombre ? normalizeToLowerCase(contacto_emergencia_nombre) : null,
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
    
    // Normalizar textos a minúsculas para consistencia
    if (updateData.nombre != null) updateData.nombre = normalizeToLowerCase(updateData.nombre) ?? updateData.nombre;
    if (updateData.apellido != null) updateData.apellido = normalizeToLowerCase(updateData.apellido) ?? updateData.apellido;
    if (updateData.direccion != null) updateData.direccion = updateData.direccion ? normalizeToLowerCase(updateData.direccion) : updateData.direccion;
    if (updateData.obra_social != null) updateData.obra_social = updateData.obra_social ? normalizeToLowerCase(updateData.obra_social) : updateData.obra_social;
    if (updateData.contacto_emergencia_nombre != null) updateData.contacto_emergencia_nombre = updateData.contacto_emergencia_nombre ? normalizeToLowerCase(updateData.contacto_emergencia_nombre) : updateData.contacto_emergencia_nombre;
    
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

/**
 * Listar profesionales asignados a un paciente
 */
const listAsignaciones = async (req, res, next) => {
  try {
    const { id: pacienteId } = req.params;
    const paciente = await pacienteModel.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    const asignaciones = await pacienteProfesionalModel.findAll({ paciente_id: pacienteId });
    res.json(buildResponse(true, asignaciones, 'Asignaciones obtenidas exitosamente'));
  } catch (error) {
    logger.error('Error en listAsignaciones:', error);
    next(error);
  }
};

/**
 * Asignar un profesional a un paciente
 */
const addAsignacion = async (req, res, next) => {
  try {
    const { id: pacienteId } = req.params;
    let { profesional_id } = req.body;
    // Asegurar que sea un solo UUID (no array ni múltiples)
    if (Array.isArray(profesional_id)) {
      return res.status(400).json(buildResponse(false, null, 'Se debe asignar un solo profesional a la vez'));
    }
    if (typeof profesional_id !== 'string') {
      return res.status(400).json(buildResponse(false, null, 'profesional_id debe ser un UUID válido'));
    }
    profesional_id = profesional_id.trim();
    const paciente = await pacienteModel.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    // Si es profesional, solo puede asignarse a sí mismo
    if (req.user.rol === 'profesional') {
      const profesionalLogueado = await profesionalModel.findByUserId(req.user.id);
      if (!profesionalLogueado || profesionalLogueado.id !== profesional_id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permisos para realizar esta acción'));
      }
    }
    const row = await pacienteProfesionalModel.create({
      paciente_id: pacienteId,
      profesional_id,
      asignado_por_usuario_id: req.user.id
    });
    if (!row) {
      return res.status(400).json(buildResponse(false, null, 'El profesional ya está asignado a este paciente'));
    }
    const asignaciones = await pacienteProfesionalModel.findAll({ paciente_id: pacienteId });
    res.status(201).json(buildResponse(true, asignaciones, 'Profesional asignado correctamente'));
  } catch (error) {
    logger.error('Error en addAsignacion:', error);
    next(error);
  }
};

/**
 * Quitar asignación de un profesional a un paciente
 */
const removeAsignacion = async (req, res, next) => {
  try {
    const { id: pacienteId, profesionalId } = req.params;
    const paciente = await pacienteModel.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    const removed = await pacienteProfesionalModel.remove(pacienteId, profesionalId);
    if (!removed) {
      return res.status(404).json(buildResponse(false, null, 'Asignación no encontrada'));
    }
    res.json(buildResponse(true, null, 'Asignación eliminada correctamente'));
  } catch (error) {
    logger.error('Error en removeAsignacion:', error);
    next(error);
  }
};

/**
 * Reemplazar todas las asignaciones del paciente en una sola operación
 * Body: { profesional_ids: string[] }
 */
const setAsignaciones = async (req, res, next) => {
  try {
    const { id: pacienteId } = req.params;
    let { profesional_ids: profesionalIds } = req.body;
    if (!Array.isArray(profesionalIds)) {
      return res.status(400).json(buildResponse(false, null, 'profesional_ids debe ser un arreglo'));
    }
    profesionalIds = profesionalIds.map((id) => (typeof id === 'string' ? id.trim() : id)).filter(Boolean);
    const paciente = await pacienteModel.findById(pacienteId);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    if (req.user.rol === 'profesional') {
      const profesionalLogueado = await profesionalModel.findByUserId(req.user.id);
      if (!profesionalLogueado) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permisos para realizar esta acción'));
      }
      const soloSiMismo = profesionalIds.every((pid) => pid === profesionalLogueado.id);
      if (!soloSiMismo) {
        return res.status(403).json(buildResponse(false, null, 'Un profesional solo puede asignarse a sí mismo'));
      }
    }
    for (const profId of profesionalIds) {
      const profesional = await profesionalModel.findById(profId);
      if (!profesional) {
        return res.status(404).json(buildResponse(false, null, `Profesional no encontrado: ${profId}`));
      }
    }
    const asignaciones = await pacienteProfesionalModel.replaceAll(
      pacienteId,
      profesionalIds,
      req.user.id
    );
    res.json(buildResponse(true, asignaciones, 'Asignaciones actualizadas correctamente'));
  } catch (error) {
    logger.error('Error en setAsignaciones:', error);
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
  deactivate,
  listAsignaciones,
  addAsignacion,
  removeAsignacion,
  setAsignaciones
};

const obraSocialModel = require('../models/obra-social.model');
const { buildResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Obtener todas las obras sociales activas
 */
const getAll = async (req, res, next) => {
  try {
    const { includeInactive } = req.query;
    const obrasSociales = includeInactive === 'true'
      ? await obraSocialModel.findAllIncludingInactive()
      : await obraSocialModel.findAll();
    
    res.json(buildResponse(true, obrasSociales));
  } catch (error) {
    logger.error('Error en getAll obras_sociales:', error);
    next(error);
  }
};

/**
 * Obtener obra social por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const obraSocial = await obraSocialModel.findById(id);
    
    if (!obraSocial) {
      return res.status(404).json(buildResponse(false, null, 'Obra social no encontrada'));
    }
    
    res.json(buildResponse(true, obraSocial));
  } catch (error) {
    logger.error('Error en getById obra_social:', error);
    next(error);
  }
};

/**
 * Crear nueva obra social
 */
const create = async (req, res, next) => {
  try {
    const { nombre, codigo, descripcion } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json(buildResponse(false, null, 'El nombre es requerido'));
    }
    
    // Verificar si ya existe
    const existente = await obraSocialModel.findByName(nombre.trim());
    if (existente) {
      return res.status(400).json(buildResponse(false, null, 'Ya existe una obra social con ese nombre'));
    }
    
    const obraSocial = await obraSocialModel.create({
      nombre: nombre.trim(),
      codigo: codigo?.trim() || null,
      descripcion: descripcion?.trim() || null,
    });
    
    logger.info('Obra social creada:', { id: obraSocial.id, nombre: obraSocial.nombre });
    res.status(201).json(buildResponse(true, obraSocial, 'Obra social creada exitosamente'));
  } catch (error) {
    logger.error('Error en create obra_social:', error);
    next(error);
  }
};

/**
 * Actualizar obra social
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, codigo, descripcion, activo } = req.body;
    
    const obraSocial = await obraSocialModel.findById(id);
    if (!obraSocial) {
      return res.status(404).json(buildResponse(false, null, 'Obra social no encontrada'));
    }
    
    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (nombre && nombre.trim() !== obraSocial.nombre) {
      const existente = await obraSocialModel.findByName(nombre.trim());
      if (existente && existente.id !== id) {
        return res.status(400).json(buildResponse(false, null, 'Ya existe una obra social con ese nombre'));
      }
    }
    
    const updated = await obraSocialModel.update(id, {
      nombre: nombre?.trim(),
      codigo: codigo !== undefined ? (codigo?.trim() || null) : undefined,
      descripcion: descripcion !== undefined ? (descripcion?.trim() || null) : undefined,
      activo,
    });
    
    logger.info('Obra social actualizada:', { id });
    res.json(buildResponse(true, updated, 'Obra social actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update obra_social:', error);
    next(error);
  }
};

/**
 * Desactivar obra social
 */
const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const obraSocial = await obraSocialModel.findById(id);
    if (!obraSocial) {
      return res.status(404).json(buildResponse(false, null, 'Obra social no encontrada'));
    }
    
    await obraSocialModel.deactivate(id);
    
    logger.info('Obra social desactivada:', { id });
    res.json(buildResponse(true, null, 'Obra social desactivada exitosamente'));
  } catch (error) {
    logger.error('Error en deactivate obra_social:', error);
    next(error);
  }
};

/**
 * Eliminar obra social (borrado permanente)
 * No permite eliminar si tiene pacientes asociados (con esa obra social por nombre)
 */
const deleteObraSocial = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const obraSocial = await obraSocialModel.findById(id);
    if (!obraSocial) {
      return res.status(404).json(buildResponse(false, null, 'Obra social no encontrada'));
    }
    
    const countPacientes = await obraSocialModel.countPacientesByNombre(obraSocial.nombre);
    if (countPacientes > 0) {
      return res.status(400).json(
        buildResponse(false, null, 'No se puede eliminar: hay pacientes asociados a esta obra social. Desasigne la obra social de esos pacientes o desactive la obra social en lugar de eliminarla.')
      );
    }
    
    await obraSocialModel.deleteById(id);
    
    logger.info('Obra social eliminada:', { id });
    res.json(buildResponse(true, null, 'Obra social eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en delete obra_social:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deactivate,
  delete: deleteObraSocial,
};

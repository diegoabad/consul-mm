const especialidadModel = require('../models/especialidad.model');
const { buildResponse } = require('../utils/response');
const logger = require('../utils/logger');

/**
 * Obtener todas las especialidades (o paginado si se envían page/limit)
 */
const getAll = async (req, res, next) => {
  try {
    const { includeInactive, page, limit, q } = req.query;
    const hasPagination = page !== undefined || limit !== undefined;

    if (hasPagination) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
      const filters = {
        page: pageNum,
        limit: limitNum,
        includeInactive: includeInactive === 'true',
        q: q && String(q).trim() ? String(q).trim() : undefined,
      };
      const { rows, total } = await especialidadModel.findAllPaginated(filters);
      const totalPages = Math.ceil(total / limitNum) || 0;
      return res.json(buildResponse(true, {
        data: rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      }));
    }

    const especialidades = includeInactive === 'true'
      ? await especialidadModel.findAllIncludingInactive()
      : await especialidadModel.findAll();
    res.json(buildResponse(true, especialidades));
  } catch (error) {
    logger.error('Error en getAll especialidades:', error);
    next(error);
  }
};

/**
 * Obtener especialidad por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const especialidad = await especialidadModel.findById(id);
    
    if (!especialidad) {
      return res.status(404).json(buildResponse(false, null, 'Especialidad no encontrada'));
    }
    
    res.json(buildResponse(true, especialidad));
  } catch (error) {
    logger.error('Error en getById especialidad:', error);
    next(error);
  }
};

/**
 * Crear nueva especialidad
 */
const create = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body;
    
    if (!nombre || nombre.trim() === '') {
      return res.status(400).json(buildResponse(false, null, 'El nombre es requerido'));
    }
    
    // Verificar si ya existe
    const existente = await especialidadModel.findByName(nombre.trim());
    if (existente) {
      return res.status(400).json(buildResponse(false, null, 'Ya existe una especialidad con ese nombre'));
    }
    
    const especialidad = await especialidadModel.create({
      nombre: nombre.trim(),
      descripcion: descripcion?.trim() || null,
    });
    
    logger.info('Especialidad creada:', { id: especialidad.id, nombre: especialidad.nombre });
    res.status(201).json(buildResponse(true, especialidad, 'Especialidad creada exitosamente'));
  } catch (error) {
    logger.error('Error en create especialidad:', error);
    next(error);
  }
};

/**
 * Actualizar especialidad
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, activo } = req.body;
    
    const especialidad = await especialidadModel.findById(id);
    if (!especialidad) {
      return res.status(404).json(buildResponse(false, null, 'Especialidad no encontrada'));
    }
    
    // Si se está cambiando el nombre, verificar que no exista otro con ese nombre
    if (nombre && nombre.trim() !== especialidad.nombre) {
      const existente = await especialidadModel.findByName(nombre.trim());
      if (existente && existente.id !== id) {
        return res.status(400).json(buildResponse(false, null, 'Ya existe una especialidad con ese nombre'));
      }
    }
    
    const updated = await especialidadModel.update(id, {
      nombre: nombre?.trim(),
      descripcion: descripcion !== undefined ? (descripcion?.trim() || null) : undefined,
      activo,
    });
    
    logger.info('Especialidad actualizada:', { id });
    res.json(buildResponse(true, updated, 'Especialidad actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en update especialidad:', error);
    next(error);
  }
};

/**
 * Desactivar especialidad
 */
const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const especialidad = await especialidadModel.findById(id);
    if (!especialidad) {
      return res.status(404).json(buildResponse(false, null, 'Especialidad no encontrada'));
    }
    
    await especialidadModel.deactivate(id);
    
    logger.info('Especialidad desactivada:', { id });
    res.json(buildResponse(true, null, 'Especialidad desactivada exitosamente'));
  } catch (error) {
    logger.error('Error en deactivate especialidad:', error);
    next(error);
  }
};

/**
 * Eliminar especialidad (borrado permanente)
 * No permite eliminar si tiene profesionales asociados (con esa especialidad por nombre)
 */
const deleteEspecialidad = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const especialidad = await especialidadModel.findById(id);
    if (!especialidad) {
      return res.status(404).json(buildResponse(false, null, 'Especialidad no encontrada'));
    }
    
    const countProfesionales = await especialidadModel.countProfesionalesByNombre(especialidad.nombre);
    if (countProfesionales > 0) {
      return res.status(400).json(
        buildResponse(false, null, 'No se puede eliminar: hay profesionales asociados a esta especialidad. Cambie la especialidad de esos profesionales o desactive la especialidad en lugar de eliminarla.')
      );
    }
    
    await especialidadModel.deleteById(id);
    
    logger.info('Especialidad eliminada:', { id });
    res.json(buildResponse(true, null, 'Especialidad eliminada exitosamente'));
  } catch (error) {
    logger.error('Error en delete especialidad:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  deactivate,
  delete: deleteEspecialidad,
};

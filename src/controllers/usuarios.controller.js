/**
 * USUARIOS.CONTROLLER.JS - Controlador de usuarios
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas
 * con usuarios del sistema.
 */

const usuarioModel = require('../models/usuario.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Listar todos los usuarios
 */
const getAll = async (req, res, next) => {
  try {
    const { rol, activo } = req.query;
    const filters = {};
    
    if (rol) filters.rol = rol;
    if (activo !== undefined) filters.activo = activo === 'true';
    
    const usuarios = await usuarioModel.findAll(filters);
    
    res.json(buildResponse(true, usuarios, 'Usuarios obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll usuarios:', error);
    next(error);
  }
};

/**
 * Obtener usuario por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const usuario = await usuarioModel.findById(id);
    
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    res.json(buildResponse(true, usuario, 'Usuario obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById usuario:', error);
    next(error);
  }
};

/**
 * Crear nuevo usuario
 */
const create = async (req, res, next) => {
  try {
    const { email, password, nombre, apellido, telefono, rol, activo } = req.body;
    
    // Verificar si el email ya existe
    const existingUser = await usuarioModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json(buildResponse(false, null, 'El email ya está registrado'));
    }
    
    const nuevoUsuario = await usuarioModel.create({
      email,
      password,
      nombre: nombre || '',
      apellido: apellido || '',
      telefono: telefono || null,
      rol,
      activo: activo !== undefined ? activo : true
    });
    
    logger.info('Usuario creado:', { email, id: nuevoUsuario.id, rol });
    
    res.status(201).json(buildResponse(true, nuevoUsuario, 'Usuario creado exitosamente'));
  } catch (error) {
    logger.error('Error en create usuario:', error);
    next(error);
  }
};

/**
 * Actualizar usuario
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar si el usuario existe
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    // Si se actualiza el email, verificar que no esté en uso
    if (updateData.email && updateData.email !== usuario.email) {
      const existingUser = await usuarioModel.findByEmail(updateData.email);
      if (existingUser) {
        return res.status(409).json(buildResponse(false, null, 'El email ya está en uso'));
      }
    }
    
    const usuarioActualizado = await usuarioModel.update(id, updateData);
    
    logger.info('Usuario actualizado:', { id, cambios: updateData });
    
    res.json(buildResponse(true, usuarioActualizado, 'Usuario actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update usuario:', error);
    next(error);
  }
};

/**
 * Eliminar usuario (soft delete)
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    await usuarioModel.delete(id);
    
    logger.info('Usuario desactivado:', { id });
    
    res.json(buildResponse(true, null, 'Usuario desactivado exitosamente'));
  } catch (error) {
    logger.error('Error en delete usuario:', error);
    next(error);
  }
};

/**
 * Activar usuario
 */
const activate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const usuario = await usuarioModel.activate(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    logger.info('Usuario activado:', { id });
    
    res.json(buildResponse(true, usuario, 'Usuario activado exitosamente'));
  } catch (error) {
    logger.error('Error en activate usuario:', error);
    next(error);
  }
};

/**
 * Desactivar usuario
 */
const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const usuario = await usuarioModel.deactivate(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    logger.info('Usuario desactivado:', { id });
    
    res.json(buildResponse(true, usuario, 'Usuario desactivado exitosamente'));
  } catch (error) {
    logger.error('Error en deactivate usuario:', error);
    next(error);
  }
};

/**
 * Actualizar password
 */
const updatePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    await usuarioModel.updatePassword(id, newPassword);
    
    logger.info('Password actualizado:', { id });
    
    res.json(buildResponse(true, null, 'Contraseña actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en updatePassword usuario:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  delete: deleteUser,
  activate,
  deactivate,
  updatePassword
};

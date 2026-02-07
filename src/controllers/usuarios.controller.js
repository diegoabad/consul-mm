/**
 * USUARIOS.CONTROLLER.JS - Controlador de usuarios
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas
 * con usuarios del sistema.
 */

const usuarioModel = require('../models/usuario.model');
const emailService = require('../services/email.service');
const logger = require('../utils/logger');
const { buildResponse, normalizeToLowerCase } = require('../utils/helpers');

/**
 * Listar usuarios con paginación y filtros (rol, activo, búsqueda q)
 * Query: page, limit, q, rol, activo
 */
const getAll = async (req, res, next) => {
  try {
    const { rol, activo, q, page, limit } = req.query;
    const filters = {
      page: page ? parseInt(String(page), 10) : 1,
      limit: limit ? parseInt(String(limit), 10) : 10
    };
    if (rol) filters.rol = rol;
    if (activo !== undefined) filters.activo = activo === 'true';
    if (q && String(q).trim()) filters.q = String(q).trim();

    const { rows, total } = await usuarioModel.findAllPaginated(filters);
    const totalPages = Math.ceil(total / filters.limit) || 0;

    res.json(buildResponse(true, {
      data: rows,
      total,
      page: filters.page,
      limit: filters.limit,
      totalPages
    }, 'Usuarios obtenidos exitosamente'));
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
    
    // Secretaria no puede crear usuarios con rol administrador
    if (req.user && req.user.rol === 'secretaria' && rol === 'administrador') {
      return res.status(403).json(buildResponse(false, null, 'No puedes crear usuarios con rol administrador'));
    }
    
    // Verificar si el email ya existe
    const existingUser = await usuarioModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json(buildResponse(false, null, 'El email ya está registrado'));
    }
    
    const nuevoUsuario = await usuarioModel.create({
      email,
      password,
      nombre: normalizeToLowerCase(nombre) ?? (nombre || ''),
      apellido: normalizeToLowerCase(apellido) ?? (apellido || ''),
      telefono: telefono || null,
      rol,
      activo: activo !== undefined ? activo : true
    });
    
    logger.info('Usuario creado:', { email, id: nuevoUsuario.id, rol });
    emailService.sendWelcomeEmail(
      { nombre: nuevoUsuario.nombre, apellido: nuevoUsuario.apellido, email: nuevoUsuario.email, password: password || '(la que elegiste)' },
      nuevoUsuario.email
    ).catch((err) => logger.error('Error enviando email de bienvenida:', err));
    res.status(201).json(buildResponse(true, nuevoUsuario, 'Usuario creado exitosamente'));
  } catch (error) {
    logger.error('Error en create usuario:', error);
    next(error);
  }
};

/**
 * Actualizar usuario
 * Secretarias no pueden editar administradores. Debe haber al menos un administrador activo.
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    // Secretaria no puede editar un administrador ni asignar rol administrador
    if (req.user.rol === 'secretaria') {
      if (usuario.rol === 'administrador') {
        return res.status(403).json(buildResponse(false, null, 'No puedes editar un usuario administrador'));
      }
      if (updateData.rol === 'administrador') {
        return res.status(403).json(buildResponse(false, null, 'No puedes asignar el rol administrador'));
      }
    }
    
    // Si se cambia rol de admin a otro o se desactiva un admin, debe quedar al menos un admin activo
    if (usuario.rol === 'administrador') {
      const cambiarRol = updateData.rol !== undefined && updateData.rol !== 'administrador';
      const desactivar = updateData.activo === false;
      if (cambiarRol || desactivar) {
        const n = await usuarioModel.countActiveAdmins();
        if (n <= 1) {
          return res.status(400).json(buildResponse(false, null, 'Debe haber al menos un usuario administrador activo'));
        }
      }
    }
    
    if (updateData.email && updateData.email !== usuario.email) {
      const existingUser = await usuarioModel.findByEmail(updateData.email);
      if (existingUser) {
        return res.status(409).json(buildResponse(false, null, 'El email ya está en uso'));
      }
    }
    
    if (updateData.nombre != null) updateData.nombre = normalizeToLowerCase(updateData.nombre) ?? updateData.nombre;
    if (updateData.apellido != null) updateData.apellido = normalizeToLowerCase(updateData.apellido) ?? updateData.apellido;
    
    const usuarioActualizado = await usuarioModel.update(id, updateData);
    
    logger.info('Usuario actualizado:', { id, cambios: updateData });
    
    res.json(buildResponse(true, usuarioActualizado, 'Usuario actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update usuario:', error);
    next(error);
  }
};

/**
 * Eliminar usuario
 * Nadie puede autoeliminarse. Secretarias no pueden eliminar administradores. Debe haber al menos un admin activo.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (req.user.id === id) {
      return res.status(403).json(buildResponse(false, null, 'No puedes eliminarte a ti mismo'));
    }
    
    const usuario = await usuarioModel.findById(id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    if (req.user.rol === 'secretaria' && usuario.rol === 'administrador') {
      return res.status(403).json(buildResponse(false, null, 'No puedes eliminar un usuario administrador'));
    }
    
    if (usuario.rol === 'administrador') {
      const n = await usuarioModel.countActiveAdmins();
      if (n <= 1) {
        return res.status(400).json(buildResponse(false, null, 'Debe haber al menos un usuario administrador activo'));
      }
    }
    
    await usuarioModel.delete(id);
    
    logger.info('Usuario eliminado:', { id });
    
    res.json(buildResponse(true, null, 'Usuario eliminado exitosamente'));
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
 * Nadie puede desactivarse a sí mismo. Secretarias no pueden desactivar administradores. Debe haber al menos un admin activo.
 */
const deactivate = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    if (req.user.id === id) {
      return res.status(403).json(buildResponse(false, null, 'No puedes desactivarte a ti mismo'));
    }
    
    const usuarioExistente = await usuarioModel.findById(id);
    if (!usuarioExistente) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    if (req.user.rol === 'secretaria' && usuarioExistente.rol === 'administrador') {
      return res.status(403).json(buildResponse(false, null, 'No puedes desactivar un usuario administrador'));
    }
    
    if (usuarioExistente.rol === 'administrador') {
      const n = await usuarioModel.countActiveAdmins();
      if (n <= 1) {
        return res.status(400).json(buildResponse(false, null, 'Debe haber al menos un usuario administrador activo'));
      }
    }
    
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

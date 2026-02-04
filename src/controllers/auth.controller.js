/**
 * AUTH.CONTROLLER.JS - Controlador de autenticación
 * 
 * Este controlador maneja todas las operaciones relacionadas con
 * autenticación de usuarios (login, registro, refresh token, etc.).
 */

const usuarioModel = require('../models/usuario.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * Login de usuario
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    
    // Buscar usuario por email
    const usuario = await usuarioModel.findByEmail(email);
    
    if (!usuario) {
      return res.status(401).json(buildResponse(false, null, 'Tu email o contraseña están incorrectos'));
    }
    
    // Verificar si está activo (maneja false, null, undefined)
    if (usuario.activo === false || usuario.activo === null || usuario.activo === undefined) {
      return res.status(401).json(buildResponse(false, null, 'Tu cuenta está desactivada. Contacta al administrador'));
    }
    
    // Verificar password
    const passwordMatch = await bcrypt.compare(password, usuario.password_hash);
    
    if (!passwordMatch) {
      return res.status(401).json(buildResponse(false, null, 'Tu email o contraseña están incorrectos'));
    }
    
    // Generar JWT
    const token = jwt.sign(
      {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      },
      process.env.JWT_SECRET,
      {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d'
      }
    );
    
    logger.info('Usuario autenticado:', { email, id: usuario.id });
    
    res.json(buildResponse(true, {
      token,
      user: {
        id: usuario.id,
        email: usuario.email,
        rol: usuario.rol
      }
    }, 'Login exitoso'));
  } catch (error) {
    logger.error('Error en login:', error);
    next(error);
  }
};

/**
 * Registrar nuevo usuario (solo admin)
 */
const register = async (req, res, next) => {
  try {
    const { email, password, nombre, apellido, telefono, rol } = req.body;
    
    // Verificar si el email ya existe
    const existingUser = await usuarioModel.findByEmail(email);
    if (existingUser) {
      return res.status(409).json(buildResponse(false, null, 'El email ya está registrado'));
    }
    
    // Crear usuario
    const nuevoUsuario = await usuarioModel.create({
      email,
      password,
      nombre: nombre || '',
      apellido: apellido || '',
      telefono: telefono || null,
      rol,
      activo: true
    });
    
    logger.info('Usuario registrado:', { email, id: nuevoUsuario.id, rol });
    res.status(201).json(buildResponse(true, {
      id: nuevoUsuario.id,
      email: nuevoUsuario.email,
      nombre: nuevoUsuario.nombre,
      apellido: nuevoUsuario.apellido,
      rol: nuevoUsuario.rol
    }, 'Usuario registrado exitosamente'));
  } catch (error) {
    logger.error('Error en register:', error);
    next(error);
  }
};

/**
 * Obtener perfil del usuario autenticado
 */
const getProfile = async (req, res, next) => {
  try {
    const usuario = await usuarioModel.findById(req.user.id);
    
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    res.json(buildResponse(true, usuario, 'Perfil obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getProfile:', error);
    next(error);
  }
};

/**
 * Actualizar perfil del usuario autenticado (solo datos propios: nombre, apellido, email, telefono)
 */
const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { nombre, apellido, email, telefono } = req.body;

    const usuario = await usuarioModel.findById(userId);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }

    if (email && email !== usuario.email) {
      const existingUser = await usuarioModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json(buildResponse(false, null, 'El email ya está en uso'));
      }
    }

    const updateData = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (apellido !== undefined) updateData.apellido = apellido;
    if (email !== undefined) updateData.email = email;
    if (telefono !== undefined) updateData.telefono = telefono || null;

    const usuarioActualizado = await usuarioModel.update(userId, updateData);
    logger.info('Perfil actualizado:', { id: userId });
    res.json(buildResponse(true, usuarioActualizado, 'Perfil actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en updateProfile:', error);
    next(error);
  }
};

/**
 * Cambiar contraseña del usuario autenticado
 */
const updateMyPassword = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { newPassword, confirmPassword } = req.body;

    if (newPassword !== confirmPassword) {
      return res.status(400).json(buildResponse(false, null, 'Las contraseñas no coinciden'));
    }

    const usuario = await usuarioModel.findById(userId);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }

    await usuarioModel.updatePassword(userId, newPassword);
    logger.info('Contraseña actualizada:', { id: userId });
    res.json(buildResponse(true, null, 'Contraseña actualizada exitosamente'));
  } catch (error) {
    logger.error('Error en updateMyPassword:', error);
    next(error);
  }
};

module.exports = {
  login,
  register,
  getProfile,
  updateProfile,
  updateMyPassword
};

/**
 * ARCHIVOS.CONTROLLER.JS - Controlador de archivos médicos
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con archivos médicos subidos (upload, download, delete).
 */

const archivoModel = require('../models/archivo.model');
const pacienteModel = require('../models/paciente.model');
const profesionalModel = require('../models/profesional.model');
const pacienteProfesionalModel = require('../models/pacienteProfesional.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');

// Directorio base para uploads
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Listar archivos con filtros.
 * Si el usuario es profesional, solo ve sus propios archivos.
 */
const getAll = async (req, res, next) => {
  try {
    const { paciente_id, profesional_id } = req.query;
    const filters = {};
    
    if (paciente_id) filters.paciente_id = paciente_id;
    if (profesional_id) filters.profesional_id = profesional_id;
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      filters.profesional_id = profesional.id;
    }
    
    const archivos = await archivoModel.findAll(filters);
    
    res.json(buildResponse(true, archivos, 'Archivos obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll archivos:', error);
    next(error);
  }
};

/**
 * Obtener archivo por ID.
 * Si el usuario es profesional, solo puede ver sus propios archivos.
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const archivo = await archivoModel.findById(id);
    
    if (!archivo) {
      return res.status(404).json(buildResponse(false, null, 'Archivo no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || archivo.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para ver este archivo'));
      }
    }
    
    res.json(buildResponse(true, archivo, 'Archivo obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById archivo:', error);
    next(error);
  }
};

/**
 * Obtener archivos de un paciente.
 * Si el usuario es profesional, debe estar asignado al paciente y solo ve sus propios archivos.
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const paciente = await pacienteModel.findById(id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(id)) {
        return res.status(403).json(buildResponse(false, null, 'No tiene asignado este paciente'));
      }
      const archivos = await archivoModel.findAll({ paciente_id: id, profesional_id: profesional.id });
      return res.json(buildResponse(true, archivos, 'Archivos del paciente obtenidos exitosamente'));
    }
    
    const archivos = await archivoModel.findByPaciente(id);
    
    res.json(buildResponse(true, archivos, 'Archivos del paciente obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente archivos:', error);
    next(error);
  }
};

/**
 * Subir archivo.
 * Si el usuario es profesional, solo puede subir como él mismo y debe estar asignado al paciente.
 */
const upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(buildResponse(false, null, 'No se proporcionó ningún archivo'));
    }
    
    let { paciente_id, profesional_id, descripcion } = req.body;
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      profesional_id = profesional.id;
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(paciente_id)) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(403).json(buildResponse(false, null, 'Debe estar asignado al paciente para subir archivos'));
      }
    }
    
    // Verificar que el paciente existe y está activo
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      // Eliminar archivo subido si el paciente no existe
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.error('Error eliminando archivo temporal:', err);
        }
      }
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (!paciente.activo) {
      // Eliminar archivo subido si el paciente está inactivo
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.error('Error eliminando archivo temporal:', err);
        }
      }
      return res.status(400).json(buildResponse(false, null, 'No se puede subir archivo para un paciente inactivo'));
    }
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      // Eliminar archivo subido si el profesional no existe
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.error('Error eliminando archivo temporal:', err);
        }
      }
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      // Eliminar archivo subido si el profesional está bloqueado
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (err) {
          logger.error('Error eliminando archivo temporal:', err);
        }
      }
      return res.status(400).json(buildResponse(false, null, 'No se puede subir archivo para un profesional bloqueado'));
    }
    
    // Mover archivo del directorio temporal a la carpeta del paciente
    const pacienteDir = path.join(UPLOADS_DIR, 'pacientes', paciente_id);
    
    // Crear directorio del paciente si no existe
    if (!fs.existsSync(pacienteDir)) {
      fs.mkdirSync(pacienteDir, { recursive: true });
    }
    
    // Ruta final del archivo
    const finalPath = path.join(pacienteDir, req.file.filename);
    
    // Mover archivo de temp a la carpeta del paciente
    try {
      fs.renameSync(req.file.path, finalPath);
    } catch (err) {
      logger.error('Error moviendo archivo a carpeta del paciente:', err);
      // Eliminar archivo temporal si falla el movimiento
      if (req.file.path) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkErr) {
          logger.error('Error eliminando archivo temporal después de fallo:', unlinkErr);
        }
      }
      return res.status(500).json(buildResponse(false, null, 'Error al guardar el archivo'));
    }
    
    // Construir URL relativa del archivo
    // finalPath será algo como: uploads/pacientes/{paciente_id}/{filename}
    // La URL será: /uploads/pacientes/{paciente_id}/{filename}
    const relativePath = finalPath.replace(path.join(__dirname, '../../'), '').replace(/\\/g, '/');
    const urlArchivo = `/${relativePath}`;
    
    // Crear registro en la base de datos
    const archivo = await archivoModel.create({
      paciente_id,
      profesional_id,
      nombre_archivo: req.file.originalname,
      tipo_archivo: req.file.mimetype,
      url_archivo: urlArchivo,
      tamanio_bytes: req.file.size,
      descripcion: descripcion || null
    });
    
    logger.info('Archivo subido exitosamente:', { id: archivo.id, paciente_id, nombre: req.file.originalname });
    
    res.status(201).json(buildResponse(true, archivo, 'Archivo subido exitosamente'));
  } catch (error) {
    // Eliminar archivo subido si hay error
    if (req.file && req.file.path) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (err) {
        logger.error('Error eliminando archivo temporal después de error:', err);
      }
    }
    logger.error('Error en upload archivo:', error);
    next(error);
  }
};

/**
 * Descargar archivo.
 * Si el usuario es profesional, solo puede descargar sus propios archivos.
 */
const download = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const archivo = await archivoModel.findById(id);
    if (!archivo) {
      return res.status(404).json(buildResponse(false, null, 'Archivo no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || archivo.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para descargar este archivo'));
      }
    }
    
    // Construir ruta completa del archivo
    const filePath = path.join(__dirname, '../../', archivo.url_archivo);
    
    // Verificar que el archivo existe físicamente
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(buildResponse(false, null, 'El archivo físico no existe'));
    }
    
    // Enviar archivo
    res.download(filePath, archivo.nombre_archivo, (err) => {
      if (err) {
        logger.error('Error descargando archivo:', err);
        if (!res.headersSent) {
          res.status(500).json(buildResponse(false, null, 'Error al descargar el archivo'));
        }
      }
    });
  } catch (error) {
    logger.error('Error en download archivo:', error);
    next(error);
  }
};

/**
 * Eliminar archivo.
 * Si el usuario es profesional, solo puede eliminar sus propios archivos.
 */
const deleteArchivo = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const archivo = await archivoModel.findById(id);
    if (!archivo) {
      return res.status(404).json(buildResponse(false, null, 'Archivo no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || archivo.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para eliminar este archivo'));
      }
    }
    
    // Construir ruta completa del archivo
    const filePath = path.join(__dirname, '../../', archivo.url_archivo);
    
    // Eliminar archivo físico si existe
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info('Archivo físico eliminado:', { path: filePath });
      } catch (err) {
        logger.error('Error eliminando archivo físico:', err);
        // Continuar con la eliminación del registro aunque falle la eliminación física
      }
    }
    
    // Eliminar registro de la base de datos
    const eliminado = await archivoModel.delete(id);
    
    if (!eliminado) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar el registro del archivo'));
    }
    
    logger.info('Archivo eliminado exitosamente:', { id });
    
    res.json(buildResponse(true, null, 'Archivo eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en delete archivo:', error);
    next(error);
  }
};

/**
 * Actualizar metadatos de archivo.
 * Si el usuario es profesional, solo puede actualizar sus propios archivos.
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const archivoExistente = await archivoModel.findById(id);
    if (!archivoExistente) {
      return res.status(404).json(buildResponse(false, null, 'Archivo no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || archivoExistente.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para editar este archivo'));
      }
    }
    
    const archivo = await archivoModel.update(id, updateData);
    
    res.json(buildResponse(true, archivo, 'Archivo actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update archivo:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByPaciente,
  upload,
  download,
  delete: deleteArchivo,
  update
};

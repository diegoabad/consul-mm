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
const usuarioModel = require('../models/usuario.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const azureStorage = require('../services/azure-storage.service');

// Directorio base para uploads (solo cuando no se usa Azure Blob)
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Filtra la lista de archivos para excluir aquellos cuyo archivo físico ya no existe
 * (ej. borrados manualmente del disco). Opcionalmente elimina esos registros huérfanos de la DB.
 * @param {Array} archivos - Lista de archivos desde la DB
 * @returns {Promise<Array>} Lista solo con archivos que existen en disco
 */
async function filtrarArchivosExistentes(archivos) {
  if (!archivos || archivos.length === 0) return archivos;
  if (azureStorage.isAzureConfigured()) return archivos;
  const baseDir = path.join(__dirname, '../..');
  const validos = [];
  for (const a of archivos) {
    if (!a.url_archivo) {
      try {
        await archivoModel.delete(a.id);
        logger.info('Registro de archivo huérfano eliminado (sin url):', { id: a.id });
      } catch (err) {
        logger.error('Error eliminando registro huérfano:', err);
      }
      continue;
    }
    const filePath = path.join(baseDir, a.url_archivo.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      validos.push(a);
    } else {
      try {
        await archivoModel.delete(a.id);
        logger.info('Registro de archivo huérfano eliminado (archivo físico no existe):', { id: a.id, url: a.url_archivo });
      } catch (err) {
        logger.error('Error eliminando registro huérfano:', err);
      }
    }
  }
  return validos;
}

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
    
    let archivos = await archivoModel.findAll(filters);
    archivos = await filtrarArchivosExistentes(archivos);

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
 * - Administrador y secretaria: ven todos los archivos del paciente.
 * - Profesional: debe estar asignado al paciente y solo ve sus propios archivos.
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
      let archivos = await archivoModel.findAll({ paciente_id: id, profesional_id: profesional.id });
      archivos = await filtrarArchivosExistentes(archivos);
      return res.json(buildResponse(true, archivos, 'Archivos del paciente obtenidos exitosamente'));
    }

    // Administrador y secretaria: todos los archivos del paciente
    let archivos = await archivoModel.findByPaciente(id);
    archivos = await filtrarArchivosExistentes(archivos);
    res.json(buildResponse(true, archivos, 'Archivos del paciente obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente archivos:', error);
    next(error);
  }
};

/**
 * Subir archivo.
 * - Administrador: puede subir en nombre de cualquier usuario (usuario_id en body).
 * - Secretaria y profesional: solo pueden subir como ellos mismos.
 * - Profesional: además debe estar asignado al paciente.
 */
const upload = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(buildResponse(false, null, 'No se proporcionó ningún archivo'));
    }
    
    let { paciente_id, usuario_id, profesional_id, descripcion } = req.body;
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      usuario_id = req.user.id;
      profesional_id = profesional.id;
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(paciente_id)) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(403).json(buildResponse(false, null, 'Debe estar asignado al paciente para subir archivos'));
      }
    } else {
      // Solo administrador puede subir en nombre de otro usuario; secretaria siempre como ella misma
      if (req.user.rol === 'secretaria') {
        usuario_id = req.user.id;
      }
      if (!usuario_id) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(400).json(buildResponse(false, null, 'El usuario_id es requerido'));
      }
      const usuarioSubido = await usuarioModel.findById(usuario_id);
      if (!usuarioSubido || !usuarioSubido.activo) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado o inactivo'));
      }
      const profDelUsuario = await profesionalModel.findByUserId(usuario_id);
      profesional_id = profDelUsuario ? profDelUsuario.id : null;
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
    
    if (profesional_id) {
      const profesional = await profesionalModel.findById(profesional_id);
      if (!profesional) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      if (profesional.bloqueado) {
        if (req.file.path) {
          try { fs.unlinkSync(req.file.path); } catch (err) { logger.error('Error eliminando archivo temporal:', err); }
        }
        return res.status(400).json(buildResponse(false, null, 'No se puede subir archivo para un profesional bloqueado'));
      }
    }
    
    const ext = path.extname(req.file.originalname) || '';
    const safeFilename = `${uuidv4()}-${Date.now()}${ext}`;
    const blobPath = `uploads/archivos/${uuidv4()}/${safeFilename}`;
    let urlArchivo;

    if (azureStorage.isAzureConfigured()) {
      try {
        const buffer = fs.readFileSync(req.file.path);
        await azureStorage.uploadBuffer(blobPath, buffer);
        urlArchivo = `/${blobPath}`;
        try { fs.unlinkSync(req.file.path); } catch (e) { logger.warn('Error eliminando temp tras upload Azure:', e.message); }
      } catch (err) {
        logger.warn('Storage no disponible - archivo guardado en local como respaldo. Error:', err.message);
        // Fallback a disco local si Azure falla (conexión, credenciales, etc.)
      }
    }
    if (!urlArchivo) {
      const archivoDir = path.join(UPLOADS_DIR, 'archivos', uuidv4());
      if (!fs.existsSync(archivoDir)) fs.mkdirSync(archivoDir, { recursive: true });
      const finalPath = path.join(archivoDir, safeFilename);
      try {
        fs.renameSync(req.file.path, finalPath);
      } catch (err) {
        logger.error('Error moviendo archivo a carpeta del paciente:', err);
        if (req.file.path) { try { fs.unlinkSync(req.file.path); } catch (unlinkErr) {} }
        return res.status(500).json(buildResponse(false, null, 'Error al guardar el archivo'));
      }
      const relativePath = finalPath.replace(path.join(__dirname, '../../'), '').replace(/\\/g, '/');
      urlArchivo = `/${relativePath}`;
    }
    
    // Nombre: usar el enviado en el body (UTF-8) para soportar español; si no viene, el del archivo
    const nombreArchivo = (req.body && typeof req.body.nombre_archivo === 'string' && req.body.nombre_archivo.trim())
      ? req.body.nombre_archivo.trim()
      : req.file.originalname;

    const archivo = await archivoModel.create({
      paciente_id,
      usuario_id,
      profesional_id: profesional_id || null,
      nombre_archivo: nombreArchivo,
      tipo_archivo: req.file.mimetype,
      url_archivo: urlArchivo,
      tamanio_bytes: req.file.size,
      descripcion: descripcion || null
    });

    logger.info('Archivo subido exitosamente:', { id: archivo.id, paciente_id, nombre: nombreArchivo });

    // Si Azure está configurado y el archivo quedó en local (fallback), intentar subirlo a Storage y borrar local en background
    if (azureStorage.isAzureConfigured()) {
      setImmediate(() => syncOneLocalToStorage(archivo).catch(e => logger.error('Sync local→Storage tras subida:', e.message)));
    }

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
    
    if (azureStorage.isAzureConfigured()) {
      const blobPath = azureStorage.toBlobName(archivo.url_archivo);
      const stream = await azureStorage.getReadStream(blobPath);
      if (stream) {
        const fileName = archivo.nombre_archivo || 'archivo';
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
        if (archivo.tipo_archivo) res.setHeader('Content-Type', archivo.tipo_archivo);
        stream.pipe(res);
        return;
      }
      // Blob no encontrado (ej. archivo viejo guardado en local): intentar disco local
    }

    const filePath = path.join(__dirname, '../../', archivo.url_archivo);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json(buildResponse(false, null, 'El archivo no existe'));
    }
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
    
    if (azureStorage.isAzureConfigured()) {
      const blobPath = azureStorage.toBlobName(archivo.url_archivo);
      await azureStorage.deleteBlob(blobPath);
    }
    const filePath = path.join(__dirname, '../../', archivo.url_archivo);
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        logger.info('Archivo físico eliminado:', { path: filePath });
      } catch (err) {
        logger.error('Error eliminando archivo físico:', err);
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

/**
 * Sincroniza un archivo que está en disco local hacia Azure Blob.
 * Si la subida es exitosa, borra el archivo local (local queda como respaldo solo hasta que se vacíe).
 * No hace nada si Azure no está configurado o si el archivo no existe en disco.
 * @param {Object} archivo - Registro con id y url_archivo
 * @returns {Promise<boolean>} true si se subió a Storage y se borró local
 */
async function syncOneLocalToStorage(archivo) {
  if (!azureStorage.isAzureConfigured() || !archivo || !archivo.url_archivo) return false;
  const baseDir = path.join(__dirname, '../..');
  const filePath = path.join(baseDir, archivo.url_archivo.replace(/^\//, ''));
  if (!fs.existsSync(filePath)) return false;
  const blobPath = azureStorage.toBlobName(archivo.url_archivo);
  try {
    const buffer = fs.readFileSync(filePath);
    await azureStorage.uploadBuffer(blobPath, buffer);
    fs.unlinkSync(filePath);
    logger.info('Archivo local subido a Storage y eliminado de disco (respaldo vaciado)', { id: archivo.id, url: archivo.url_archivo });
    return true;
  } catch (err) {
    logger.warn('Sync local→Storage fallido (archivo sigue en local):', err.message, { id: archivo.id });
    return false;
  }
}

/**
 * Recorre todos los archivos en la DB: si existe en disco y no en Storage, lo sube y borra de local.
 * Se ejecuta en background al arrancar el servidor (y opcionalmente tras cada fallback).
 */
async function syncAllLocalToStorage() {
  if (!azureStorage.isAzureConfigured()) return;
  try {
    const archivos = await archivoModel.findAll({});
    let synced = 0;
    for (const a of archivos) {
      const ok = await syncOneLocalToStorage(a);
      if (ok) synced++;
    }
    if (synced > 0) logger.info('Sync local→Storage al arranque: ' + synced + ' archivo(s) subidos a Storage y borrados de disco.');
  } catch (err) {
    logger.error('Error en sync local→Storage al arranque:', err);
  }
}

module.exports = {
  getAll,
  getById,
  getByPaciente,
  upload,
  download,
  delete: deleteArchivo,
  update,
  syncOneLocalToStorage,
  syncAllLocalToStorage
};

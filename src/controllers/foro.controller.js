const foroTemaModel = require('../models/foroTema.model');
const foroPostModel = require('../models/foroPost.model');
const profesionalModel = require('../models/profesional.model');
const permissionsService = require('../services/permissions.service');
const { validarSinLinks } = require('../utils/antiLinks');
const { buildResponse } = require('../utils/helpers');
const logger = require('../utils/logger');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const azureStorage = require('../services/azure-storage.service');

const UPLOADS_DIR = path.join(__dirname, '../../uploads');

/**
 * Listar todos los profesionales con su estado de habilitación para el foro
 */
const getProfesionalesHabilitados = async (req, res, next) => {
  try {
    const profesionales = await profesionalModel.findAll({ bloqueado: false });
    const activos = profesionales.filter((p) => p.usuario_activo !== false);
    const foroMap = await permissionsService.hasForoLeerBatch(
      activos.map((p) => ({ usuario_id: p.usuario_id, rol: p.rol || 'profesional' }))
    );
    const lista = activos.map((p) => ({
      id: p.id,
      usuario_id: p.usuario_id,
      nombre: p.nombre,
      apellido: p.apellido,
      especialidad: p.especialidad,
      email: p.email,
      habilitado: !!foroMap.get(p.usuario_id)
    }));
    res.json(buildResponse(true, lista));
  } catch (error) {
    logger.error('Error getProfesionalesHabilitados:', error);
    next(error);
  }
};

/**
 * Habilitar o deshabilitar un profesional para ver el foro
 */
const updatePermisoForo = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const { habilitado } = req.body;
    if (typeof habilitado !== 'boolean') {
      return res.status(400).json(buildResponse(false, null, 'habilitado debe ser true o false'));
    }
    const permisoModel = require('../models/permiso.model');
    if (habilitado) {
      await permisoModel.grant(usuarioId, 'foro.leer');
      await permisoModel.grant(usuarioId, 'foro.responder');
    } else {
      await permisoModel.revoke(usuarioId, 'foro.leer');
      await permisoModel.revoke(usuarioId, 'foro.responder');
    }
    res.json(buildResponse(true, { usuario_id: usuarioId, habilitado }, habilitado ? 'Profesional habilitado para el foro' : 'Profesional deshabilitado para el foro'));
  } catch (error) {
    logger.error('Error updatePermisoForo:', error);
    next(error);
  }
};

/**
 * Subir imagen para tema del foro
 * Guarda en uploads/foro/{uuid}/ o Azure blob uploads/foro/{uuid}/
 */
const uploadImagenTema = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json(buildResponse(false, null, 'No se proporcionó ninguna imagen'));
    }
    const ext = path.extname(req.file.originalname) || '.jpg';
    const safeFilename = `${uuidv4()}-${Date.now()}${ext}`;
    const folderId = uuidv4();
    const blobPath = `uploads/foro/${folderId}/${safeFilename}`;
    let urlImagen;

    if (azureStorage.isAzureConfigured()) {
      try {
        const buffer = fs.readFileSync(req.file.path);
        await azureStorage.uploadBuffer(blobPath, buffer);
        urlImagen = `/${blobPath}`;
        try { fs.unlinkSync(req.file.path); } catch (e) { logger.warn('Error eliminando temp:', e.message); }
      } catch (err) {
        logger.warn('Azure upload falló:', err.message);
      }
    }
    if (!urlImagen) {
      const foroDir = path.join(UPLOADS_DIR, 'foro', folderId);
      if (!fs.existsSync(foroDir)) fs.mkdirSync(foroDir, { recursive: true });
      const finalPath = path.join(foroDir, safeFilename);
      try {
        fs.renameSync(req.file.path, finalPath);
      } catch (err) {
        if (req.file.path) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
        return res.status(500).json(buildResponse(false, null, 'Error al guardar la imagen'));
      }
      const relativePath = path.relative(path.join(__dirname, '../../'), finalPath).replace(/\\/g, '/');
      urlImagen = `/${relativePath}`;
    }

    res.status(201).json(buildResponse(true, { url: urlImagen }, 'Imagen subida correctamente'));
  } catch (error) {
    if (req.file?.path) { try { fs.unlinkSync(req.file.path); } catch (_) {} }
    logger.error('Error uploadImagenTema:', error);
    next(error);
  }
};

/**
 * Listar temas
 * Admin: paginado, puede incluir inactivos
 * Profesional/Secretaria: solo activos, sin paginación (para cards)
 */
const getTemas = async (req, res, next) => {
  try {
    const canCreateTema = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.crear_tema');
    const { page = 1, limit = 20, includeInactive } = req.query;
    if (canCreateTema) {
      const { rows, total } = await foroTemaModel.findAllPaginated({
        page,
        limit,
        includeInactive: includeInactive === 'true' || includeInactive === true
      });
      const totalPages = Math.ceil(total / limit) || 0;
      return res.json(buildResponse(true, {
        data: rows,
        total,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages
      }));
    }
    const { rows, total } = await foroTemaModel.findAllActivosPaginated({ page, limit });
    const totalPages = Math.ceil(total / limit) || 0;
    return res.json(buildResponse(true, {
      data: rows,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages
    }));
  } catch (error) {
    logger.error('Error getTemas:', error);
    next(error);
  }
};

/**
 * Obtener tema por ID
 */
const getTemaById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tema = await foroTemaModel.findById(id);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const canCreateTema = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.crear_tema');
    if (!tema.activo && !canCreateTema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    res.json(buildResponse(true, tema));
  } catch (error) {
    logger.error('Error getTemaById:', error);
    next(error);
  }
};

/**
 * Crear tema (solo admin)
 */
const createTema = async (req, res, next) => {
  try {
    const { titulo, descripcion, imagen_url, orden } = req.body;
    const tema = await foroTemaModel.create({
      titulo,
      descripcion: descripcion || null,
      imagen_url: imagen_url || null,
      creado_por: req.user.id,
      orden: orden ?? 0
    });
    res.status(201).json(buildResponse(true, tema, 'Tema creado correctamente'));
  } catch (error) {
    logger.error('Error createTema:', error);
    next(error);
  }
};

/**
 * Actualizar tema (solo admin)
 */
const updateTema = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tema = await foroTemaModel.findById(id);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const { titulo, descripcion, imagen_url, activo, orden } = req.body;
    const updated = await foroTemaModel.update(id, {
      titulo,
      descripcion,
      imagen_url,
      activo,
      orden
    });
    res.json(buildResponse(true, updated, 'Tema actualizado correctamente'));
  } catch (error) {
    logger.error('Error updateTema:', error);
    next(error);
  }
};

/**
 * Eliminar tema (solo admin)
 */
const deleteTema = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tema = await foroTemaModel.findById(id);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    await foroTemaModel.deleteById(id);
    res.json(buildResponse(true, null, 'Tema eliminado correctamente'));
  } catch (error) {
    logger.error('Error deleteTema:', error);
    next(error);
  }
};

/**
 * Listar posts de un tema (paginado)
 */
const getPosts = async (req, res, next) => {
  try {
    const { id } = req.params;
    const tema = await foroTemaModel.findById(id);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const canCreateTema = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.crear_tema');
    if (!tema.activo && !canCreateTema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const { page = 1, limit = 20, includeModerados, order, rootsPage, rootsLimit, repliesPerRoot } = req.query;
    const canModerar = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.moderar');
    const incMod = canModerar && (includeModerados === 'true' || includeModerados === true);

    if (rootsPage || rootsLimit !== undefined || repliesPerRoot !== undefined) {
      const { roots, totalRoots, rootsPage: rp, rootsTotalPages, repliesPerRoot: rpr } = await foroPostModel.findByTemaPaginatedByRoots(id, {
        rootsPage: rootsPage || 1,
        rootsLimit: rootsLimit || 10,
        repliesPerRoot: repliesPerRoot !== undefined ? parseInt(repliesPerRoot, 10) : 2,
        includeModerados: incMod,
        order: order || 'asc'
      });
      const total = roots.reduce((acc, r) => acc + 1 + r.totalReplies, 0);
      return res.json(buildResponse(true, {
        mode: 'roots',
        roots,
        totalRoots,
        rootsPage: parseInt(rp, 10),
        rootsTotalPages,
        repliesPerRoot: rpr,
        total
      }));
    }

    const { rows, total } = await foroPostModel.findByTemaPaginated(id, {
      page,
      limit,
      includeModerados: incMod,
      order: order || 'asc'
    });
    const totalPages = Math.ceil(total / limit) || 0;
    res.json(buildResponse(true, {
      data: rows,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages
    }));
  } catch (error) {
    logger.error('Error getPosts:', error);
    next(error);
  }
};

/**
 * Listar respuestas de un post raíz (para ampliar)
 */
const getRepliesByRoot = async (req, res, next) => {
  try {
    const { id: temaId, rootId } = req.params;
    const tema = await foroTemaModel.findById(temaId);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const canCreateTema = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.crear_tema');
    if (!tema.activo && !canCreateTema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    const { page = 1, limit = 10, offset, order } = req.query;
    const canModerar = await permissionsService.hasPermission(req.user.id, req.user.rol, 'foro.moderar');
    const { rows, total, totalPages } = await foroPostModel.findRepliesByRootPaginated(temaId, rootId, {
      page,
      limit,
      offset: offset !== undefined ? parseInt(offset, 10) : undefined,
      includeModerados: canModerar,
      order: order || 'asc'
    });
    const usedOffset = offset !== undefined ? parseInt(offset, 10) : (parseInt(page, 10) - 1) * parseInt(limit, 10);
    res.json(buildResponse(true, {
      data: rows,
      total,
      offset: usedOffset,
      limit: parseInt(limit, 10),
      totalPages
    }));
  } catch (error) {
    logger.error('Error getRepliesByRoot:', error);
    next(error);
  }
};

/**
 * Crear post (responder en tema)
 */
const createPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido, parent_id } = req.body;
    const validacion = validarSinLinks(contenido);
    if (!validacion.valido) {
      return res.status(400).json(buildResponse(false, null, validacion.mensaje));
    }
    const tema = await foroTemaModel.findById(id);
    if (!tema) {
      return res.status(404).json(buildResponse(false, null, 'Tema no encontrado'));
    }
    if (!tema.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden agregar respuestas a un tema inactivo'));
    }
    if (parent_id) {
      const parentPost = await foroPostModel.findByIdAndTema(parent_id, id);
      if (!parentPost) {
        return res.status(400).json(buildResponse(false, null, 'El post al que intentas responder no existe o no pertenece a este tema'));
      }
    }
    const post = await foroPostModel.create({
      tema_id: id,
      usuario_id: req.user.id,
      contenido: contenido.trim(),
      parent_id: parent_id || null
    });
    res.status(201).json(buildResponse(true, post, 'Respuesta publicada'));
  } catch (error) {
    logger.error('Error createPost:', error);
    next(error);
  }
};

/**
 * Editar post (solo el autor)
 */
const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { contenido } = req.body;
    const post = await foroPostModel.findById(id);
    if (!post) {
      return res.status(404).json(buildResponse(false, null, 'Post no encontrado'));
    }
    if (post.usuario_id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'Solo podés editar tus propios mensajes'));
    }
    const validacion = validarSinLinks(contenido);
    if (!validacion.valido) {
      return res.status(400).json(buildResponse(false, null, validacion.mensaje));
    }
    const updated = await foroPostModel.update(id, contenido.trim());
    res.json(buildResponse(true, updated, 'Mensaje actualizado'));
  } catch (error) {
    logger.error('Error updatePost:', error);
    next(error);
  }
};

/**
 * Eliminar post (solo el autor)
 */
const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const post = await foroPostModel.findById(id);
    if (!post) {
      return res.status(404).json(buildResponse(false, null, 'Post no encontrado'));
    }
    if (post.usuario_id !== req.user.id) {
      return res.status(403).json(buildResponse(false, null, 'Solo podés eliminar tus propios mensajes'));
    }
    await foroPostModel.deleteById(id);
    res.json(buildResponse(true, null, 'Mensaje eliminado'));
  } catch (error) {
    logger.error('Error deletePost:', error);
    next(error);
  }
};

/**
 * Moderar post (ocultar/mostrar)
 */
const moderarPost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { moderado } = req.body;
    const post = await foroPostModel.setModerado(id, moderado);
    if (!post) {
      return res.status(404).json(buildResponse(false, null, 'Post no encontrado'));
    }
    res.json(buildResponse(true, post, moderado ? 'Post ocultado' : 'Post visible'));
  } catch (error) {
    logger.error('Error moderarPost:', error);
    next(error);
  }
};

module.exports = {
  getProfesionalesHabilitados,
  updatePermisoForo,
  uploadImagenTema,
  getTemas,
  getTemaById,
  createTema,
  updateTema,
  deleteTema,
  getPosts,
  getRepliesByRoot,
  createPost,
  updatePost,
  deletePost,
  moderarPost,
};

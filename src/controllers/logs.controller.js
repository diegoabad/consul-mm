/**
 * LOGS.CONTROLLER.JS - Crear y listar logs de errores (front/back)
 * Una sola tabla; columna origen distingue los registros.
 */

const logModel = require('../models/log.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');

/**
 * POST /api/logs - Crear log (llamado desde front o desde errorHandler back)
 * Opcional: enviar Authorization para asociar usuario en logs front.
 */
const create = async (req, res, next) => {
  try {
    const body = req.body || {};
    const origen = body.origen === 'back' ? 'back' : 'front';

    const payload = {
      origen,
      mensaje: typeof body.mensaje === 'string' ? body.mensaje : (body.mensaje || 'Sin mensaje'),
      stack: body.stack || null,
    };

    if (origen === 'front') {
      payload.usuario_id = body.usuario_id ?? req.user?.id ?? null;
      payload.rol = body.rol ?? req.user?.rol ?? null;
      payload.pantalla = body.pantalla ?? null;
      payload.accion = body.accion ?? null;
    } else {
      payload.ruta = body.ruta ?? null;
      payload.metodo = body.metodo ?? null;
      payload.params = body.params != null ? (typeof body.params === 'string' ? body.params : JSON.stringify(body.params)) : null;
    }

    const row = await logModel.create(payload);
    return res.status(201).json(buildResponse(true, { id: row.id, created_at: row.created_at }));
  } catch (error) {
    logger.error('Error en logs.controller create:', error);
    next(error);
  }
};

/**
 * GET /api/logs - Listar logs con filtros (solo administrador)
 * Query: fecha_desde, fecha_hasta, origen, page (1-based), limit
 */
const list = async (req, res, next) => {
  try {
    const { fecha_desde, fecha_hasta, origen, page, limit } = req.query;
    const filters = {};
    if (fecha_desde) filters.fecha_desde = fecha_desde;
    if (fecha_hasta) filters.fecha_hasta = fecha_hasta;
    if (origen === 'front' || origen === 'back') filters.origen = origen;

    const limitNum = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 10));
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    filters.limit = limitNum;
    filters.offset = (pageNum - 1) * limitNum;

    const [rows, total] = await Promise.all([
      logModel.findAll(filters),
      logModel.count(filters),
    ]);
    const totalPages = Math.ceil(total / limitNum) || 0;

    return res.json(buildResponse(true, {
      logs: rows,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages,
    }));
  } catch (error) {
    logger.error('Error en logs.controller list:', error);
    next(error);
  }
};

/**
 * DELETE /api/logs - Borrar todos los logs (solo administrador)
 */
const deleteAll = async (req, res, next) => {
  try {
    const deleted = await logModel.deleteAll();
    return res.json(buildResponse(true, { deleted }));
  } catch (error) {
    logger.error('Error en logs.controller deleteAll:', error);
    next(error);
  }
};

/**
 * DELETE /api/logs/:id - Borrar un log por id (solo administrador)
 */
const deleteOne = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json(buildResponse(false, null, 'ID inválido'));
    const deleted = await logModel.deleteById(id);
    if (deleted === 0) return res.status(404).json(buildResponse(false, null, 'Log no encontrado'));
    return res.json(buildResponse(true, { deleted: 1 }));
  } catch (error) {
    logger.error('Error en logs.controller deleteOne:', error);
    next(error);
  }
};

module.exports = {
  create,
  list,
  deleteAll,
  deleteOne,
};

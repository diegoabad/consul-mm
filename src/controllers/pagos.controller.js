/**
 * PAGOS.CONTROLLER.JS - Controlador de pagos de profesionales
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con pagos mensuales de profesionales.
 */

const pagoModel = require('../models/pago.model');
const profesionalModel = require('../models/profesional.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');
const { ESTADOS_PAGO } = require('../utils/constants');

/**
 * Normaliza el valor de periodo a string YYYY-MM-DD en UTC para evitar
 * desfases de un día por zona horaria al guardar en PostgreSQL.
 */
function normalizePeriodoToYYYYMMDD(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, '0');
    const day = String(value.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  return null;
}

/**
 * Listar pagos con filtros. Si se envían page o limit, devuelve respuesta paginada.
 */
const getAll = async (req, res, next) => {
  try {
    const { profesional_id, estado, periodo_desde, periodo_hasta, page, limit } = req.query;
    const hasPagination = page !== undefined || limit !== undefined;

    if (hasPagination) {
      const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(String(limit), 10) || 10));
      const filters = { page: pageNum, limit: limitNum };
      if (profesional_id) filters.profesional_id = profesional_id;
      if (estado) filters.estado = estado;
      if (periodo_desde) filters.periodo_desde = normalizePeriodoToYYYYMMDD(periodo_desde);
      if (periodo_hasta) filters.periodo_hasta = normalizePeriodoToYYYYMMDD(periodo_hasta);

      const { rows, total } = await pagoModel.findAllPaginated(filters);
      const totalPages = Math.ceil(total / limitNum) || 0;
      return res.json(buildResponse(true, {
        data: rows,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages,
      }, 'Pagos obtenidos exitosamente'));
    }

    const filters = {};
    if (profesional_id) filters.profesional_id = profesional_id;
    if (estado) filters.estado = estado;
    if (periodo_desde) filters.periodo_desde = normalizePeriodoToYYYYMMDD(periodo_desde);
    if (periodo_hasta) filters.periodo_hasta = normalizePeriodoToYYYYMMDD(periodo_hasta);

    const pagos = await pagoModel.findAll(filters);
    res.json(buildResponse(true, pagos, 'Pagos obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll pagos:', error);
    next(error);
  }
};

/**
 * Obtener pago por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pago = await pagoModel.findById(id);
    
    if (!pago) {
      return res.status(404).json(buildResponse(false, null, 'Pago no encontrado'));
    }
    
    res.json(buildResponse(true, pago, 'Pago obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById pago:', error);
    next(error);
  }
};

/**
 * Obtener pagos de un profesional
 */
const getByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    const pagos = await pagoModel.findByProfesional(id);
    
    res.json(buildResponse(true, pagos, 'Pagos del profesional obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByProfesional pagos:', error);
    next(error);
  }
};

/**
 * Obtener pagos pendientes
 */
const getPending = async (req, res, next) => {
  try {
    const pagos = await pagoModel.getPending();
    
    res.json(buildResponse(true, pagos, 'Pagos pendientes obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getPending pagos:', error);
    next(error);
  }
};

/**
 * Obtener pagos vencidos
 */
const getOverdue = async (req, res, next) => {
  try {
    const pagos = await pagoModel.getOverdue();
    
    res.json(buildResponse(true, pagos, 'Pagos vencidos obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getOverdue pagos:', error);
    next(error);
  }
};

/**
 * Crear nuevo registro de pago
 */
const create = async (req, res, next) => {
  try {
    const { profesional_id, periodo, monto, estado, metodo_pago, comprobante_url, observaciones } = req.body;
    const periodoNormalizado = normalizePeriodoToYYYYMMDD(periodo);
    if (!periodoNormalizado) {
      return res.status(400).json(buildResponse(false, null, 'El periodo debe ser una fecha válida'));
    }
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    // Verificar que no exista ya un pago para este profesional y periodo
    const pagoExistente = await pagoModel.checkPaymentStatus(profesional_id, periodoNormalizado);
    if (pagoExistente) {
      return res.status(400).json(buildResponse(false, null, 'Ya existe un pago registrado para este profesional y periodo'));
    }
    
    const pago = await pagoModel.create({
      profesional_id,
      periodo: periodoNormalizado,
      monto,
      estado: estado || ESTADOS_PAGO.PENDIENTE,
      metodo_pago,
      comprobante_url,
      observaciones
    });
    
    res.status(201).json(buildResponse(true, pago, 'Pago creado exitosamente'));
  } catch (error) {
    logger.error('Error en create pago:', error);
    
    // Manejar error de constraint único (profesional_id, periodo)
    if (error.code === '23505') {
      return res.status(400).json(buildResponse(false, null, 'Ya existe un pago registrado para este profesional y periodo'));
    }
    
    next(error);
  }
};

/**
 * Actualizar pago
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { monto, estado, metodo_pago, comprobante_url, observaciones } = req.body;
    
    // Verificar que el pago existe
    const pagoExistente = await pagoModel.findById(id);
    if (!pagoExistente) {
      return res.status(404).json(buildResponse(false, null, 'Pago no encontrado'));
    }
    
    const pago = await pagoModel.update(id, {
      monto,
      estado,
      metodo_pago,
      comprobante_url,
      observaciones
    });
    
    res.json(buildResponse(true, pago, 'Pago actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update pago:', error);
    next(error);
  }
};

/**
 * Marcar pago como pagado
 */
const markAsPaid = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_pago, metodo_pago, comprobante_url, observaciones } = req.body;
    
    // Verificar que el pago existe
    const pagoExistente = await pagoModel.findById(id);
    if (!pagoExistente) {
      return res.status(404).json(buildResponse(false, null, 'Pago no encontrado'));
    }
    
    // Si ya está pagado, retornar error
    if (pagoExistente.estado === ESTADOS_PAGO.PAGADO) {
      return res.status(400).json(buildResponse(false, null, 'El pago ya está marcado como pagado'));
    }
    
    // Normalizar fecha_pago a YYYY-MM-DD en UTC para evitar desfase de un día
    const fechaPagoStr = fecha_pago ? normalizePeriodoToYYYYMMDD(fecha_pago) : null;
    const hoyUtc = () => {
      const d = new Date();
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    };
    const fechaPagoParaGuardar = fechaPagoStr || hoyUtc();
    const pago = await pagoModel.markAsPaid(id, fechaPagoParaGuardar, metodo_pago, comprobante_url);
    
    if (!pago) {
      return res.status(500).json(buildResponse(false, null, 'Error al marcar el pago como pagado'));
    }
    
    // Actualizar fecha_ultimo_pago en el profesional
    await profesionalModel.updateLastPayment(pagoExistente.profesional_id, fechaPagoParaGuardar);
    
    // Si el profesional estaba bloqueado, desbloquearlo
    const profesional = await profesionalModel.findById(pagoExistente.profesional_id);
    if (profesional && profesional.bloqueado) {
      await profesionalModel.unblock(pagoExistente.profesional_id);
    }
    
    // Actualizar observaciones si se proporcionaron
    if (observaciones) {
      await pagoModel.update(id, { observaciones });
    }
    
    // Obtener el pago actualizado con toda la información
    const pagoActualizado = await pagoModel.findById(id);
    
    res.json(buildResponse(true, pagoActualizado, 'Pago marcado como pagado exitosamente'));
  } catch (error) {
    logger.error('Error en markAsPaid pago:', error);
    next(error);
  }
};

/**
 * Eliminar pago
 */
const deletePago = async (req, res, next) => {
  try {
    const { id } = req.params;
    const pago = await pagoModel.findById(id);
    if (!pago) {
      return res.status(404).json(buildResponse(false, null, 'Pago no encontrado'));
    }
    const deleted = await pagoModel.deleteById(id);
    if (!deleted) {
      return res.status(500).json(buildResponse(false, null, 'Error al eliminar el pago'));
    }
    res.json(buildResponse(true, null, 'Pago eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en deletePago:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByProfesional,
  getPending,
  getOverdue,
  create,
  update,
  markAsPaid,
  deletePago
};

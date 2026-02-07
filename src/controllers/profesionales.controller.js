/**
 * PROFESIONALES.CONTROLLER.JS - Controlador de profesionales médicos
 * 
 * Este controlador maneja todas las operaciones CRUD relacionadas
 * con profesionales médicos.
 */

const profesionalModel = require('../models/profesional.model');
const usuarioModel = require('../models/usuario.model');
const logger = require('../utils/logger');
const { buildResponse, normalizeToLowerCase } = require('../utils/helpers');
const { ROLES } = require('../utils/constants');

/**
 * Normaliza fecha_inicio_contrato a string YYYY-MM-DD en UTC para guardar en columna DATE
 * sin desfase por zona horaria (evita que "2026-02-01" se guarde como 31/1 en zonas UTC-x).
 * @param {Date|string|null} value - Valor devuelto por Joi (Date o string ISO) o string YYYY-MM-DD
 * @returns {string|null} - "YYYY-MM-DD" o null
 */
function normalizeFechaInicioContratoToYYYYMMDD(value) {
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
 * Listar todos los profesionales.
 * Si el usuario es rol profesional, solo devuelve su propio registro (para agenda, etc.).
 * Si se envían page o limit en query, devuelve respuesta paginada: { data, total, page, limit, totalPages }.
 */
const getAll = async (req, res, next) => {
  try {
    if (req.user.rol === ROLES.PROFESIONAL) {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      const list = profesional ? [profesional] : [];
      return res.json(buildResponse(true, list, 'Profesional obtenido exitosamente'));
    }

    const { activo, bloqueado, especialidad, estado_pago, page, limit, id, tipo_periodo_pago } = req.query;
    const hasPagination = page !== undefined || limit !== undefined;

    if (hasPagination) {
      const filters = {
        page: page ? parseInt(String(page), 10) : 1,
        limit: limit ? parseInt(String(limit), 10) : 10
      };
      if (activo !== undefined) filters.activo = activo === 'true';
      if (bloqueado !== undefined) filters.bloqueado = bloqueado === 'true';
      if (especialidad) filters.especialidad = especialidad;
      if (estado_pago) filters.estado_pago = estado_pago;
      if (id) filters.id = id;
      if (tipo_periodo_pago) filters.tipo_periodo_pago = tipo_periodo_pago;

      const { rows, total } = await profesionalModel.findAllPaginated(filters);
      const totalPages = Math.ceil(total / filters.limit) || 0;
      return res.json(buildResponse(true, {
        data: rows,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages
      }, 'Profesionales obtenidos exitosamente'));
    }

    const filters = {};
    if (activo !== undefined) filters.activo = activo === 'true';
    if (bloqueado !== undefined) filters.bloqueado = bloqueado === 'true';
    if (especialidad) filters.especialidad = especialidad;
    if (estado_pago) filters.estado_pago = estado_pago;

    const profesionales = await profesionalModel.findAll(filters);
    res.json(buildResponse(true, profesionales, 'Profesionales obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll profesionales:', error);
    next(error);
  }
};

/**
 * Obtener profesional por ID
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const profesional = await profesionalModel.findById(id);
    
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    res.json(buildResponse(true, profesional, 'Profesional obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById profesional:', error);
    next(error);
  }
};

/**
 * Obtener profesional por usuario_id
 */
const getByUserId = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const profesional = await profesionalModel.findByUserId(usuarioId);
    
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado para este usuario'));
    }
    
    res.json(buildResponse(true, profesional, 'Profesional obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getByUserId profesional:', error);
    next(error);
  }
};

/**
 * Crear nuevo profesional
 * Requiere que el usuario ya exista y tenga rol 'profesional'
 */
const create = async (req, res, next) => {
  try {
    const {
      usuario_id,
      matricula,
      especialidad,
      estado_pago,
      bloqueado,
      razon_bloqueo,
      fecha_ultimo_pago,
      fecha_inicio_contrato,
      monto_mensual,
      tipo_periodo_pago,
      observaciones
    } = req.body;
    
    // Verificar que el usuario existe
    const usuario = await usuarioModel.findById(usuario_id);
    if (!usuario) {
      return res.status(404).json(buildResponse(false, null, 'Usuario no encontrado'));
    }
    
    // Verificar que el usuario tenga rol 'profesional'
    if (usuario.rol !== ROLES.PROFESIONAL) {
      return res.status(400).json(buildResponse(false, null, 'El usuario debe tener rol "profesional"'));
    }
    
    // Verificar que el usuario no tenga ya un profesional asociado
    const profesionalExistente = await profesionalModel.findByUserId(usuario_id);
    if (profesionalExistente) {
      return res.status(409).json(buildResponse(false, null, 'El usuario ya tiene un profesional asociado'));
    }
    
    // Verificar que la matrícula no esté en uso (si se proporciona)
    if (matricula) {
      const profesionales = await profesionalModel.findAll({});
      const matriculaEnUso = profesionales.find(p => p.matricula === matricula);
      if (matriculaEnUso) {
        return res.status(409).json(buildResponse(false, null, 'La matrícula ya está en uso'));
      }
    }
    
    const nuevoProfesional = await profesionalModel.create({
      usuario_id,
      matricula: matricula ? normalizeToLowerCase(matricula) : null,
      especialidad: especialidad ? normalizeToLowerCase(especialidad) : null,
      estado_pago: estado_pago || 'al_dia',
      bloqueado: bloqueado !== undefined ? bloqueado : false,
      razon_bloqueo: razon_bloqueo ? normalizeToLowerCase(razon_bloqueo) : null,
      fecha_ultimo_pago: fecha_ultimo_pago || null,
      fecha_inicio_contrato: normalizeFechaInicioContratoToYYYYMMDD(fecha_inicio_contrato),
      monto_mensual: monto_mensual || null,
      tipo_periodo_pago: tipo_periodo_pago || 'mensual',
      observaciones: observaciones ? normalizeToLowerCase(observaciones) : null
    });
    
    logger.info('Profesional creado:', { id: nuevoProfesional.id, usuario_id, matricula });
    
    // Obtener el profesional completo con datos del usuario
    const profesionalCompleto = await profesionalModel.findById(nuevoProfesional.id);
    
    res.status(201).json(buildResponse(true, profesionalCompleto, 'Profesional creado exitosamente'));
  } catch (error) {
    logger.error('Error en create profesional:', error);
    next(error);
  }
};

/**
 * Actualizar profesional
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    // Si se actualiza la matrícula, verificar que no esté en uso
    if (updateData.matricula && updateData.matricula !== profesional.matricula) {
      const profesionales = await profesionalModel.findAll({});
      const matriculaEnUso = profesionales.find(p => p.matricula === updateData.matricula && p.id !== id);
      if (matriculaEnUso) {
        return res.status(409).json(buildResponse(false, null, 'La matrícula ya está en uso'));
      }
    }
    // Normalizar fecha_inicio_contrato a YYYY-MM-DD (UTC) para evitar desfase por zona horaria
    if (updateData.fecha_inicio_contrato !== undefined) {
      updateData.fecha_inicio_contrato = normalizeFechaInicioContratoToYYYYMMDD(updateData.fecha_inicio_contrato);
    }
    if (updateData.matricula != null && updateData.matricula !== '') updateData.matricula = normalizeToLowerCase(updateData.matricula);
    if (updateData.especialidad != null && updateData.especialidad !== '') updateData.especialidad = normalizeToLowerCase(updateData.especialidad);
    if (updateData.razon_bloqueo != null && updateData.razon_bloqueo !== '') updateData.razon_bloqueo = normalizeToLowerCase(updateData.razon_bloqueo);
    if (updateData.observaciones != null && updateData.observaciones !== '') updateData.observaciones = normalizeToLowerCase(updateData.observaciones);
    const profesionalActualizado = await profesionalModel.update(id, updateData);
    
    logger.info('Profesional actualizado:', { id, cambios: updateData });
    
    // Obtener el profesional completo con datos del usuario
    const profesionalCompleto = await profesionalModel.findById(id);
    
    res.json(buildResponse(true, profesionalCompleto, 'Profesional actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update profesional:', error);
    next(error);
  }
};

/**
 * Eliminar profesional
 */
const deleteProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    await profesionalModel.delete(id);
    
    logger.info('Profesional eliminado:', { id });
    
    res.json(buildResponse(true, null, 'Profesional eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en delete profesional:', error);
    next(error);
  }
};

/**
 * Bloquear profesional (solo admin)
 */
const block = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razon_bloqueo } = req.body;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'El profesional ya está bloqueado'));
    }
    
    const razonNormalizada = razon_bloqueo ? normalizeToLowerCase(razon_bloqueo) : null;
    const profesionalBloqueado = await profesionalModel.block(id, razonNormalizada);
    
    logger.info('Profesional bloqueado:', { id, razon_bloqueo });
    
    // Obtener el profesional completo con datos del usuario
    const profesionalCompleto = await profesionalModel.findById(id);
    
    res.json(buildResponse(true, profesionalCompleto, 'Profesional bloqueado exitosamente'));
  } catch (error) {
    logger.error('Error en block profesional:', error);
    next(error);
  }
};

/**
 * Desbloquear profesional (solo admin)
 */
const unblock = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Verificar que el profesional existe
    const profesional = await profesionalModel.findById(id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (!profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'El profesional no está bloqueado'));
    }
    
    const profesionalDesbloqueado = await profesionalModel.unblock(id);
    
    logger.info('Profesional desbloqueado:', { id });
    
    // Obtener el profesional completo con datos del usuario
    const profesionalCompleto = await profesionalModel.findById(id);
    
    res.json(buildResponse(true, profesionalCompleto, 'Profesional desbloqueado exitosamente'));
  } catch (error) {
    logger.error('Error en unblock profesional:', error);
    next(error);
  }
};

/**
 * Obtener profesionales bloqueados
 */
const getBlocked = async (req, res, next) => {
  try {
    const profesionales = await profesionalModel.getBlocked();
    
    res.json(buildResponse(true, profesionales, 'Profesionales bloqueados obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getBlocked profesionales:', error);
    next(error);
  }
};

module.exports = {
  getAll,
  getById,
  getByUserId,
  create,
  update,
  delete: deleteProfesional,
  block,
  unblock,
  getBlocked
};

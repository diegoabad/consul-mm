/**
 * TURNOS.CONTROLLER.JS - Controlador de turnos médicos
 * 
 * Este controlador maneja todas las operaciones relacionadas
 * con turnos médicos.
 */

const turnoModel = require('../models/turno.model');
const profesionalModel = require('../models/profesional.model');
const pacienteModel = require('../models/paciente.model');
const pacienteProfesionalModel = require('../models/pacienteProfesional.model');
const agendaModel = require('../models/agenda.model');
const excepcionAgendaModel = require('../models/excepcionAgenda.model');
const emailService = require('../services/email.service');
const { enviarRecordatorioTurno } = require('../services/whatsapp.service');
const logModel = require('../models/log.model');
const turnoSerieModel = require('../models/turnoSerie.model');
const logger = require('../utils/logger');
const { buildResponse } = require('../utils/helpers');
const { ESTADOS_TURNO } = require('../utils/constants');
const { pool } = require('../config/database');
const { generarOcurrencias } = require('../services/recurrenciaFechas.service');
const { evaluarSlotTurno, evaluarSlotsTurnoBatch } = require('../services/turnoSlotValidation.service');

const RECURRENCIA_MAX_OCURRENCIAS = parseInt(process.env.RECURRENCIA_MAX_OCURRENCIAS || '52', 10);
const RECURRENCIA_MESES_MAX = parseInt(process.env.RECURRENCIA_MESES_MAX || '6', 10);

/**
 * Misma forma que findByIdsInOrder, usando profesional/paciente ya cargados.
 * Evita un segundo SELECT + descifrado masivo tras INSERT de series largas.
 */
function enrichTurnosRecurrencia(creados, profesional, paciente) {
  return creados.map((t) => ({
    ...t,
    matricula: profesional.matricula,
    profesional_especialidad: profesional.especialidad,
    profesional_nombre: profesional.nombre,
    profesional_apellido: profesional.apellido,
    profesional_email: profesional.email,
    paciente_nombre: paciente.nombre,
    paciente_apellido: paciente.apellido,
    paciente_dni: paciente.dni,
    paciente_telefono: paciente.telefono,
    paciente_whatsapp: paciente.whatsapp,
    paciente_email: paciente.email
  }));
}

/**
 * Listar turnos con filtros.
 * Si se envían page y/o limit, devuelve respuesta paginada { data, total, page, limit, totalPages }.
 * Si no, devuelve array (para agenda del día).
 * Si el usuario es profesional, solo ve sus propios turnos.
 */
const getAll = async (req, res, next) => {
  try {
    const { profesional_id, paciente_id, estado, fecha_inicio, fecha_fin, page, limit } = req.query;
    const filters = {};
    if (profesional_id) filters.profesional_id = profesional_id;
    if (paciente_id) filters.paciente_id = paciente_id;
    if (estado) filters.estado = estado;
    if (fecha_inicio) filters.fecha_inicio = fecha_inicio;
    if (fecha_fin) filters.fecha_fin = fecha_fin;

    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      filters.profesional_id = profesional.id;
    }

    const usePagination = page !== undefined || limit !== undefined;
    if (usePagination) {
      filters.page = page ? parseInt(String(page), 10) : 1;
      filters.limit = limit ? parseInt(String(limit), 10) : 10;
      const { rows, total } = await turnoModel.findAllPaginated(filters);
      const totalPages = Math.ceil(total / filters.limit) || 0;
      return res.json(buildResponse(true, {
        data: rows,
        total,
        page: filters.page,
        limit: filters.limit,
        totalPages
      }, 'Turnos obtenidos exitosamente'));
    }

    const turnos = await turnoModel.findAll(filters);
    res.json(buildResponse(true, turnos, 'Turnos obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getAll turnos:', error);
    next(error);
  }
};

/**
 * Obtener turno por ID.
 * Si el usuario es profesional, solo puede ver/operar sus propios turnos (puede "sacar" el turno).
 */
const getById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const turno = await turnoModel.findById(id);
    
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para ver este turno'));
      }
    }
    
    res.json(buildResponse(true, turno, 'Turno obtenido exitosamente'));
  } catch (error) {
    logger.error('Error en getById turno:', error);
    next(error);
  }
};

/**
 * Obtener turnos de un profesional.
 * Si el usuario es profesional, solo puede consultar sus propios turnos.
 */
const getByProfesional = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || profesional.id !== id) {
        return res.status(403).json(buildResponse(false, null, 'Solo puede ver sus propios turnos'));
      }
    }
    
    const turnos = await turnoModel.findByProfesional(id, fecha_inicio || null, fecha_fin || null);
    
    res.json(buildResponse(true, turnos, 'Turnos del profesional obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByProfesional turnos:', error);
    next(error);
  }
};

/**
 * Obtener turnos de un paciente.
 * - Admin/secretaria: todos los turnos del paciente.
 * - Profesional: solo turnos de ese paciente con ese profesional (y solo si tiene asignado al paciente).
 */
const getByPaciente = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fecha_inicio, fecha_fin } = req.query;

    let turnos = await turnoModel.findByPaciente(id, fecha_inicio || null, fecha_fin || null);

    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional) {
        return res.status(403).json(buildResponse(false, null, 'Profesional no encontrado'));
      }
      const pacienteIds = await pacienteProfesionalModel.getPacienteIdsByProfesional(profesional.id);
      if (!pacienteIds.includes(id)) {
        return res.status(403).json(buildResponse(false, null, 'No tiene asignado este paciente'));
      }
      turnos = turnos.filter((t) => t.profesional_id === profesional.id);
    }

    res.json(buildResponse(true, turnos, 'Turnos del paciente obtenidos exitosamente'));
  } catch (error) {
    logger.error('Error en getByPaciente turnos:', error);
    next(error);
  }
};

/**
 * Verificar disponibilidad de un horario
 */
const checkAvailability = async (req, res, next) => {
  try {
    const { profesional_id, fecha_hora_inicio, fecha_hora_fin } = req.query;
    
    if (!profesional_id || !fecha_hora_inicio || !fecha_hora_fin) {
      return res.status(400).json(buildResponse(false, null, 'profesional_id, fecha_hora_inicio y fecha_hora_fin son requeridos'));
    }
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'El profesional está bloqueado'));
    }
    
    const disponible = await turnoModel.checkAvailability(
      profesional_id,
      new Date(fecha_hora_inicio),
      new Date(fecha_hora_fin)
    );
    
    res.json(buildResponse(true, { disponible }, disponible ? 'Horario disponible' : 'Horario no disponible'));
  } catch (error) {
    logger.error('Error en checkAvailability turno:', error);
    next(error);
  }
};

/**
 * Crear nuevo turno
 */
const create = async (req, res, next) => {
  try {
    const {
      profesional_id,
      paciente_id,
      fecha_hora_inicio,
      fecha_hora_fin,
      estado,
      sobreturno,
      motivo,
      permiso_fuera_agenda
    } = req.body;
    
    // Verificar que el profesional existe y no está bloqueado
    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para profesionales bloqueados'));
    }
    
    // Verificar que el paciente existe y está activo
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para pacientes inactivos'));
    }

    const slot = await evaluarSlotTurno({
      profesional_id,
      paciente_id,
      fecha_hora_inicio: new Date(fecha_hora_inicio),
      fecha_hora_fin: new Date(fecha_hora_fin),
      permiso_fuera_agenda: Boolean(permiso_fuera_agenda)
    });
    if (!slot.ok) {
      const status = slot.mensaje && slot.mensaje.includes('paciente ya tiene') ? 409 : 400;
      return res.status(status).json(buildResponse(false, null, slot.mensaje || 'No se puede crear el turno'));
    }

    const nuevoTurno = await turnoModel.create({
      profesional_id,
      paciente_id,
      fecha_hora_inicio: new Date(fecha_hora_inicio),
      fecha_hora_fin: new Date(fecha_hora_fin),
      estado: estado || ESTADOS_TURNO.PENDIENTE,
      sobreturno: Boolean(sobreturno),
      motivo: motivo || null
    });
    
    logger.info('Turno creado:', { id: nuevoTurno.id, profesional_id, paciente_id, fecha_hora_inicio });

    // Asignar automáticamente al profesional al paciente (para que pueda verlo y cargar evoluciones, notas, archivos)
    try {
      await pacienteProfesionalModel.create({
        paciente_id,
        profesional_id,
        asignado_por_usuario_id: req.user.id
      });
    } catch (err) {
      logger.error('Error auto-asignando profesional al paciente:', err);
    }

    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(nuevoTurno.id);
    // Envío de email en segundo plano (no bloquea la respuesta). Capturamos usuario ahora por si el callback corre después de cerrar la request.
    if (turnoCompleto?.paciente_email) {
      const pathRuta = req.originalUrl || req.path || req.url;
      const usuarioId = req.user?.id ?? null;
      const usuarioRol = req.user?.rol ?? null;
      let bodySafe = undefined;
      if (req.body && typeof req.body === 'object') {
        const omitir = ['password', 'password_hash', 'token', 'refreshToken', 'confirmPassword'];
        bodySafe = Object.fromEntries(
          Object.entries(req.body).filter(([k]) => !omitir.includes(k))
        );
      }
      const paramsLog = {
        context: 'email_turno_asignado',
        email_destino: turnoCompleto.paciente_email,
        turno_id: turnoCompleto.id,
        paciente_id: turnoCompleto.paciente_id,
        profesional_id: turnoCompleto.profesional_id,
        fecha_turno: turnoCompleto.fecha,
        hora_turno: turnoCompleto.hora_inicio,
        body_request: bodySafe,
      };
      emailService.sendTurnoConfirmation(turnoCompleto, turnoCompleto.paciente_email)
        .catch(async (err) => {
          logger.error('Error enviando email de turno asignado:', err);
          try {
            await logModel.create({
              origen: 'back',
              usuario_id: usuarioId,
              rol: usuarioRol,
              ruta: pathRuta,
              metodo: req.method,
              params: JSON.stringify(paramsLog, null, 2),
              mensaje: err.message || 'Error enviando email de turno asignado',
              stack: err.stack || null,
            });
          } catch (logErr) {
            logger.error('No se pudo guardar log de error (email turno):', logErr);
          }
        });
    }
    // Envío de WhatsApp al crear turno: mismos datos y plantilla que cron / envío manual
    // (findParaRecordatorioById + enviarRecordatorioTurno; TWILIO_RECORDATORIO_VARS + Content SID del .env).
    if (process.env.WHATSAPP_RECORDATORIO_AL_CREAR === 'true') {
      turnoModel
        .findParaRecordatorioById(nuevoTurno.id)
        .then(async (turnoParaWsp) => {
          if (!turnoParaWsp) {
            logger.warn(`WhatsApp al crear turno: sin fila para recordatorio (turno ${nuevoTurno.id})`);
            return;
          }
          try {
            const resultado = await enviarRecordatorioTurno(turnoParaWsp);
            if (resultado) {
              await turnoModel.marcarRecordatorioEnviado(turnoParaWsp.id);
              logger.info(`WhatsApp recordatorio al crear turno OK | turno ${turnoParaWsp.id}`);
            } else {
              logger.warn(
                `WhatsApp al crear turno omitido (null) | turno ${turnoParaWsp.id} — sin WhatsApp, notificaciones off o recordatorio off`
              );
            }
          } catch (err) {
            const errorMsg = err?.message || String(err);
            logger.error(`Error enviando WhatsApp al crear turno ${turnoParaWsp.id}: ${errorMsg}`);
            try {
              await turnoModel.marcarRecordatorioFallido(turnoParaWsp.id, `[al_crear] ${errorMsg}`);
            } catch (_) {
              /* no bloquear */
            }
          }
        })
        .catch((err) => logger.error('Error preparando WhatsApp al crear turno:', err.message));
    }

    res.status(201).json(buildResponse(true, turnoCompleto, 'Turno creado exitosamente'));
  } catch (error) {
    logger.error('Error en create turno:', error);
    next(error);
  }
};

/**
 * Actualizar turno.
 * Si el usuario es profesional, solo puede actualizar sus propios turnos.
 */
const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para editar este turno'));
      }
    }
    
    // Si se cambia la fecha/hora, verificar agenda vigente y disponibilidad
    if (updateData.fecha_hora_inicio || updateData.fecha_hora_fin) {
      const fechaHoraInicio = updateData.fecha_hora_inicio ? new Date(updateData.fecha_hora_inicio) : new Date(turno.fecha_hora_inicio);
      const fechaHoraFin = updateData.fecha_hora_fin ? new Date(updateData.fecha_hora_fin) : new Date(turno.fecha_hora_fin);
      
      const cubiertoPorAgenda = await agendaModel.vigentConfigCoversDateTime(turno.profesional_id, fechaHoraInicio);
      const cubiertoPorExcepcion = await excepcionAgendaModel.coversDateTime(turno.profesional_id, fechaHoraInicio);
      if (!cubiertoPorAgenda && !cubiertoPorExcepcion) {
        return res.status(400).json(buildResponse(false, null, 'No se pueden asignar turnos en días u horarios en que el profesional no atiende'));
      }
      
      const disponible = await turnoModel.checkAvailability(
        turno.profesional_id,
        fechaHoraInicio,
        fechaHoraFin,
        id // Excluir el turno actual
      );
      
      if (!disponible) {
        return res.status(409).json(buildResponse(false, null, 'El nuevo horario no está disponible'));
      }
    }
    
    const turnoActualizado = await turnoModel.update(id, {
      ...updateData,
      fecha_hora_inicio: updateData.fecha_hora_inicio ? new Date(updateData.fecha_hora_inicio) : undefined,
      fecha_hora_fin: updateData.fecha_hora_fin ? new Date(updateData.fecha_hora_fin) : undefined
    });
    
    logger.info('Turno actualizado:', { id, cambios: updateData });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno actualizado exitosamente'));
  } catch (error) {
    logger.error('Error en update turno:', error);
    next(error);
  }
};

/**
 * Cancelar turno.
 * Si el usuario es profesional, solo puede cancelar sus propios turnos.
 */
const cancel = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { razon_cancelacion } = req.body;
    const canceladoPor = req.user?.id || null;
    
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para cancelar este turno'));
      }
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está cancelado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede cancelar un turno completado'));
    }
    
    const turnoCancelado = await turnoModel.cancel(id, razon_cancelacion || null, canceladoPor);
    logger.info('Turno cancelado:', { id, razon_cancelacion, canceladoPor });
    const turnoCompleto = await turnoModel.findById(id);
    res.json(buildResponse(true, turnoCompleto, 'Turno cancelado exitosamente'));
  } catch (error) {
    logger.error('Error en cancel turno:', error);
    next(error);
  }
};

/**
 * Confirmar turno.
 * Si el usuario es profesional, solo puede confirmar sus propios turnos.
 */
const confirm = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para confirmar este turno'));
      }
    }
    
    if (turno.estado === ESTADOS_TURNO.CONFIRMADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está confirmado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede confirmar un turno cancelado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede confirmar un turno completado'));
    }
    
    const turnoConfirmado = await turnoModel.confirm(id);
    
    logger.info('Turno confirmado:', { id });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno confirmado exitosamente'));
  } catch (error) {
    logger.error('Error en confirm turno:', error);
    next(error);
  }
};

/**
 * Completar turno.
 * Si el usuario es profesional, solo puede completar sus propios turnos ("sacar" el turno).
 */
const complete = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }
    
    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para completar este turno'));
      }
    }
    
    if (turno.estado === ESTADOS_TURNO.COMPLETADO) {
      return res.status(400).json(buildResponse(false, null, 'El turno ya está completado'));
    }
    
    if (turno.estado === ESTADOS_TURNO.CANCELADO) {
      return res.status(400).json(buildResponse(false, null, 'No se puede completar un turno cancelado'));
    }
    
    const turnoCompletado = await turnoModel.complete(id);
    
    logger.info('Turno completado:', { id });
    
    // Obtener el turno completo con datos relacionados
    const turnoCompleto = await turnoModel.findById(id);
    
    res.json(buildResponse(true, turnoCompleto, 'Turno completado exitosamente'));
  } catch (error) {
    logger.error('Error en complete turno:', error);
    next(error);
  }
};

/**
 * Eliminar turno.
 * Si el usuario es profesional, solo puede eliminar sus propios turnos.
 */
const deleteTurno = async (req, res, next) => {
  try {
    const { id } = req.params;
    const alcance = req.query.alcance || 'solo_este';

    const turno = await turnoModel.findById(id);
    if (!turno) {
      return res.status(404).json(buildResponse(false, null, 'Turno no encontrado'));
    }

    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || turno.profesional_id !== profesional.id) {
        return res.status(403).json(buildResponse(false, null, 'No tiene permiso para eliminar este turno'));
      }
    }

    if (alcance === 'desde_aqui_en_adelante') {
      if (!turno.serie_id) {
        return res.status(400).json(buildResponse(false, null, 'Este turno no pertenece a una serie'));
      }
      const desde = new Date(turno.fecha_hora_inicio);
      const n = await turnoModel.softDeleteSerieDesde(turno.serie_id, desde);
      await turnoSerieModel.marcarTerminada(turno.serie_id);
      logger.info('Serie eliminada desde fecha:', { id, serie_id: turno.serie_id, n });
      return res.json(
        buildResponse(true, { id, serie_id: turno.serie_id, eliminados: n }, 'Turnos de la serie eliminados exitosamente')
      );
    }

    if (alcance !== 'solo_este') {
      return res.status(400).json(buildResponse(false, null, 'alcance inválido (use solo_este o desde_aqui_en_adelante)'));
    }

    await turnoModel.deleteById(id);

    logger.info('Turno eliminado:', { id });

    res.json(buildResponse(true, { id }, 'Turno eliminado exitosamente'));
  } catch (error) {
    logger.error('Error en delete turno:', error);
    next(error);
  }
};

/**
 * Preview de ocurrencias recurrentes (sin persistir).
 */
const previewRecurrencia = async (req, res, next) => {
  try {
    const {
      profesional_id,
      paciente_id,
      frecuencia,
      fecha_hora_inicio,
      fecha_hora_fin,
      dia_semana,
      semana_del_mes,
      fecha_fin,
      max_ocurrencias,
      meses_max,
      permiso_fuera_agenda = false
    } = req.body;

    if (req.user.rol === 'profesional') {
      const profesional = await profesionalModel.findByUserId(req.user.id);
      if (!profesional || profesional.id !== profesional_id) {
        return res.status(403).json(buildResponse(false, null, 'Solo puede previsualizar turnos para su propia agenda'));
      }
    }

    const capN = Math.min(
      max_ocurrencias != null ? parseInt(String(max_ocurrencias), 10) : RECURRENCIA_MAX_OCURRENCIAS,
      RECURRENCIA_MAX_OCURRENCIAS
    );
    const mesesCap = Math.min(
      meses_max != null ? parseInt(String(meses_max), 10) : RECURRENCIA_MESES_MAX,
      RECURRENCIA_MESES_MAX
    );

    let ocurrencias;
    try {
      ocurrencias = generarOcurrencias({
        frecuencia,
        fecha_hora_inicio,
        fecha_hora_fin,
        dia_semana,
        semana_del_mes,
        fecha_fin: fecha_fin || null,
        max_ocurrencias: capN,
        meses_max: mesesCap
      });
    } catch (e) {
      return res.status(400).json(buildResponse(false, null, e.message || 'Regla de recurrencia inválida'));
    }

    const evaluaciones = await evaluarSlotsTurnoBatch({
      profesional_id,
      paciente_id,
      slots: ocurrencias.map((o) => ({
        fecha_hora_inicio: o.fecha_hora_inicio,
        fecha_hora_fin: o.fecha_hora_fin
      })),
      permiso_fuera_agenda_default: Boolean(permiso_fuera_agenda)
    });

    const filas = ocurrencias.map((o, i) => {
      const ev = evaluaciones[i];
      return {
        indice: i + 1,
        fecha_hora_inicio: o.fecha_hora_inicio.toISOString(),
        fecha_hora_fin: o.fecha_hora_fin.toISOString(),
        ok: ev.ok,
        flags: ev.flags,
        mensaje: ev.mensaje || null
      };
    });

    res.json(buildResponse(true, { ocurrencias: filas }, 'Preview generado'));
  } catch (error) {
    logger.error('Error en previewRecurrencia:', error);
    next(error);
  }
};

/**
 * Crear serie + turnos según lista ya editada en cliente.
 */
const createRecurrencia = async (req, res, next) => {
  let client;
  try {
    const {
      profesional_id,
      paciente_id,
      motivo,
      permiso_fuera_agenda = false,
      serie: serieMeta,
      ocurrencias
    } = req.body;

    if (!serieMeta || !serieMeta.frecuencia) {
      return res.status(400).json(buildResponse(false, null, 'Datos de serie inválidos'));
    }

    if (req.user.rol === 'profesional') {
      const prof = await profesionalModel.findByUserId(req.user.id);
      if (!prof || prof.id !== profesional_id) {
        return res.status(403).json(buildResponse(false, null, 'Solo puede crear series para su propia agenda'));
      }
    }

    if (!Array.isArray(ocurrencias) || ocurrencias.length === 0) {
      return res.status(400).json(buildResponse(false, null, 'Debe enviar al menos una ocurrencia'));
    }
    if (ocurrencias.length > RECURRENCIA_MAX_OCURRENCIAS) {
      return res.status(400).json(buildResponse(false, null, `Máximo ${RECURRENCIA_MAX_OCURRENCIAS} turnos por serie`));
    }

    const profesional = await profesionalModel.findById(profesional_id);
    if (!profesional) {
      return res.status(404).json(buildResponse(false, null, 'Profesional no encontrado'));
    }
    if (profesional.bloqueado) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para profesionales bloqueados'));
    }
    const paciente = await pacienteModel.findById(paciente_id);
    if (!paciente) {
      return res.status(404).json(buildResponse(false, null, 'Paciente no encontrado'));
    }
    if (!paciente.activo) {
      return res.status(400).json(buildResponse(false, null, 'No se pueden crear turnos para pacientes inactivos'));
    }

    const slotsParaValidar = ocurrencias.map((o) => ({
      fecha_hora_inicio: new Date(o.fecha_hora_inicio),
      fecha_hora_fin: new Date(o.fecha_hora_fin),
      permiso_fuera_agenda: o.permiso_fuera_agenda != null ? Boolean(o.permiso_fuera_agenda) : Boolean(permiso_fuera_agenda)
    }));

    const evalsSerie = await evaluarSlotsTurnoBatch({
      profesional_id,
      paciente_id,
      profesional,
      paciente,
      slots: slotsParaValidar
    });
    for (let i = 0; i < evalsSerie.length; i++) {
      const ev = evalsSerie[i];
      if (!ev.ok) {
        return res.status(400).json(
          buildResponse(false, { fila: i + 1, flags: ev.flags }, ev.mensaje || 'Validación fallida')
        );
      }
    }

    const solapan = (a0, a1, b0, b1) => a0 < b1 && b0 < a1;
    const ordenados = ocurrencias
      .map((o, idx) => ({
        idx,
        i0: new Date(o.fecha_hora_inicio).getTime(),
        i1: new Date(o.fecha_hora_fin).getTime()
      }))
      .sort((x, y) => x.i0 - y.i0);
    for (let a = 0; a < ordenados.length; a++) {
      for (let b = a + 1; b < ordenados.length; b++) {
        if (solapan(ordenados[a].i0, ordenados[a].i1, ordenados[b].i0, ordenados[b].i1)) {
          return res.status(400).json(
            buildResponse(false, { filas: [ordenados[a].idx + 1, ordenados[b].idx + 1] }, 'Hay turnos solapados entre sí en la lista enviada')
          );
        }
      }
    }

    const primeraInicio = new Date(ocurrencias[0].fecha_hora_inicio);
    const primeraFin = new Date(ocurrencias[0].fecha_hora_fin);

    client = await pool.connect();
    await client.query('BEGIN');

    const serieRow = await turnoSerieModel.create(
      {
        profesional_id,
        paciente_id,
        frecuencia: serieMeta.frecuencia,
        mensual_modo: serieMeta.mensual_modo || null,
        dia_semana: serieMeta.dia_semana != null ? serieMeta.dia_semana : null,
        semana_del_mes: serieMeta.semana_del_mes,
        fecha_inicio_serie: primeraInicio,
        fecha_hora_fin_template: primeraFin,
        fecha_fin: serieMeta.fecha_fin ? new Date(serieMeta.fecha_fin) : null,
        max_ocurrencias: serieMeta.max_ocurrencias != null ? serieMeta.max_ocurrencias : ocurrencias.length,
        creado_por: req.user.id
      },
      client
    );

    const rowsToInsert = ocurrencias.map((o, i) => ({
      profesional_id,
      paciente_id,
      fecha_hora_inicio: new Date(o.fecha_hora_inicio),
      fecha_hora_fin: new Date(o.fecha_hora_fin),
      estado: ESTADOS_TURNO.PENDIENTE,
      sobreturno: false,
      motivo: motivo || null,
      serie_id: serieRow.id,
      serie_secuencia: i + 1
    }));

    const creados = await turnoModel.createManyWithClient(client, rowsToInsert);
    const turnosCompletos = enrichTurnosRecurrencia(creados, profesional, paciente);

    await client.query('COMMIT');
    client.release();
    client = null;

    try {
      await pacienteProfesionalModel.create({
        paciente_id,
        profesional_id,
        asignado_por_usuario_id: req.user.id
      });
    } catch (err) {
      logger.error('Error auto-asignando profesional al paciente (serie):', err);
    }

    if (turnosCompletos.length && turnosCompletos[0].paciente_email) {
      emailService
        .sendRecurrenciaCreada(turnosCompletos, turnosCompletos[0].paciente_email)
        .catch((err) => logger.error('Error enviando email recurrencia:', err));
    }

    res.status(201).json(buildResponse(true, { serie_id: serieRow.id, turnos: turnosCompletos }, 'Serie de turnos creada exitosamente'));
  } catch (error) {
    if (client) {
      try {
        await client.query('ROLLBACK');
      } catch (_) {
        /* no-op */
      }
    }
    logger.error('Error en createRecurrencia:', error);
    next(error);
  } finally {
    if (client) {
      client.release();
    }
  }
};

module.exports = {
  getAll,
  getById,
  getByProfesional,
  getByPaciente,
  checkAvailability,
  create,
  update,
  cancel,
  confirm,
  complete,
  delete: deleteTurno,
  previewRecurrencia,
  createRecurrencia
};

/**
 * Validación unificada de un intervalo de turno (create, preview, serie, update).
 */

const profesionalModel = require('../models/profesional.model');
const pacienteModel = require('../models/paciente.model');
const agendaModel = require('../models/agenda.model');
const excepcionAgendaModel = require('../models/excepcionAgenda.model');
const bloqueModel = require('../models/bloque.model');
const turnoModel = require('../models/turno.model');

function emptyFlags() {
  return {
    profesional_inexistente: false,
    profesional_bloqueado: false,
    paciente_inexistente: false,
    paciente_inactivo: false,
    fuera_de_agenda: false,
    bloque: false,
    paciente_solapado: false,
    ocupado: false
  };
}

/**
 * Valida un slot usando entidades ya cargadas (evita N× findById en listas largas).
 * @returns {Promise<{ ok: boolean, flags: object, mensaje?: string }>}
 */
async function evaluarSlotTurnoCore(profesional, paciente, {
  fecha_hora_inicio,
  fecha_hora_fin,
  permiso_fuera_agenda = false,
  excludeTurnoId = null
}) {
  const inicio = fecha_hora_inicio instanceof Date ? fecha_hora_inicio : new Date(fecha_hora_inicio);
  const fin = fecha_hora_fin instanceof Date ? fecha_hora_fin : new Date(fecha_hora_fin);

  const flags = emptyFlags();

  if (!profesional) {
    flags.profesional_inexistente = true;
    return { ok: false, flags, mensaje: 'Profesional no encontrado' };
  }
  if (profesional.bloqueado) {
    flags.profesional_bloqueado = true;
    return { ok: false, flags, mensaje: 'No se pueden crear turnos para profesionales bloqueados' };
  }

  if (!paciente) {
    flags.paciente_inexistente = true;
    return { ok: false, flags, mensaje: 'Paciente no encontrado' };
  }
  if (!paciente.activo) {
    flags.paciente_inactivo = true;
    return { ok: false, flags, mensaje: 'No se pueden crear turnos para pacientes inactivos' };
  }

  if (!permiso_fuera_agenda) {
    const cubiertoPorAgenda = await agendaModel.vigentConfigCoversDateTime(profesional.id, inicio);
    const cubiertoPorExcepcion = await excepcionAgendaModel.coversDateTime(profesional.id, inicio);
    if (!cubiertoPorAgenda && !cubiertoPorExcepcion) {
      flags.fuera_de_agenda = true;
    }
  }

  const hayBloque = await bloqueModel.checkOverlap(profesional.id, inicio, fin);
  if (hayBloque) {
    flags.bloque = true;
  }

  const mismoPacienteOcupado = await turnoModel.hasPacienteOverlap(profesional.id, paciente.id, inicio, fin);
  if (mismoPacienteOcupado) {
    flags.paciente_solapado = true;
  }

  const disponible = await turnoModel.checkAvailability(profesional.id, inicio, fin, excludeTurnoId);
  if (!disponible) {
    flags.ocupado = true;
  }

  const ok =
    !flags.fuera_de_agenda &&
    !flags.bloque &&
    !flags.paciente_solapado &&
    !flags.ocupado;

  let mensaje;
  if (!ok) {
    if (flags.fuera_de_agenda) mensaje = 'Fuera del horario de agenda del profesional';
    else if (flags.bloque) mensaje = 'El horario está dentro de un período bloqueado';
    else if (flags.paciente_solapado) mensaje = 'Este paciente ya tiene un turno en ese horario';
    else if (flags.ocupado) mensaje = 'El horario no está disponible';
  }

  return { ok, flags, mensaje };
}

/**
 * @returns {Promise<{ ok: boolean, flags: object, mensaje?: string }>}
 */
async function evaluarSlotTurno({
  profesional_id,
  paciente_id,
  fecha_hora_inicio,
  fecha_hora_fin,
  permiso_fuera_agenda = false,
  excludeTurnoId = null
}) {
  const profesional = await profesionalModel.findById(profesional_id);
  const paciente = await pacienteModel.findById(paciente_id);
  return evaluarSlotTurnoCore(profesional, paciente, {
    fecha_hora_inicio,
    fecha_hora_fin,
    permiso_fuera_agenda,
    excludeTurnoId
  });
}

/**
 * Valida muchos slots en paralelo: un solo find de profesional y paciente; el resto en Promise.all.
 * Cada elemento de `slots` puede llevar `permiso_fuera_agenda` propio; si no, usa `permiso_fuera_agenda_default`.
 *
 * @param {object} opts
 * @param {string} [opts.profesional_id] - Si no pasás `profesional`, se carga por id
 * @param {string} [opts.paciente_id]
 * @param {object|null} [opts.profesional] - Entidad ya cargada (evita doble query en createRecurrencia)
 * @param {object|null} [opts.paciente]
 * @param {Array<{ fecha_hora_inicio: Date|string, fecha_hora_fin: Date|string, permiso_fuera_agenda?: boolean }>} opts.slots
 * @param {boolean} [opts.permiso_fuera_agenda_default=false]
 * @returns {Promise<Array<{ ok: boolean, flags: object, mensaje?: string }>>} Mismo orden que `slots`
 */
async function evaluarSlotsTurnoBatch({
  profesional_id,
  paciente_id,
  profesional: profesionalPrecargado,
  paciente: pacientePrecargado,
  slots,
  permiso_fuera_agenda_default = false
}) {
  const profesional =
    profesionalPrecargado !== undefined ? profesionalPrecargado : await profesionalModel.findById(profesional_id);
  const paciente =
    pacientePrecargado !== undefined ? pacientePrecargado : await pacienteModel.findById(paciente_id);

  return Promise.all(
    slots.map((slot) => {
      const perm =
        slot.permiso_fuera_agenda != null ? Boolean(slot.permiso_fuera_agenda) : permiso_fuera_agenda_default;
      return evaluarSlotTurnoCore(profesional, paciente, {
        fecha_hora_inicio: slot.fecha_hora_inicio,
        fecha_hora_fin: slot.fecha_hora_fin,
        permiso_fuera_agenda: perm,
        excludeTurnoId: slot.excludeTurnoId ?? null
      });
    })
  );
}

module.exports = {
  evaluarSlotTurno,
  evaluarSlotTurnoCore,
  evaluarSlotsTurnoBatch
};

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

/** YYYY-MM-DD en hora local (alineado a vigentConfigCoversDateTime / coversDateTime). */
function fechaLocalKey(fechaHora) {
  const y = fechaHora.getFullYear();
  const m = String(fechaHora.getMonth() + 1).padStart(2, '0');
  const d = String(fechaHora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Misma lógica que bloqueModel.checkOverlap (intervalos de bloque vs turno). */
function bloqueSolapaSlot(bloque, slotInicio, slotFin) {
  const bi = bloque.fecha_hora_inicio instanceof Date ? bloque.fecha_hora_inicio : new Date(bloque.fecha_hora_inicio);
  const bf = bloque.fecha_hora_fin instanceof Date ? bloque.fecha_hora_fin : new Date(bloque.fecha_hora_fin);
  const si = slotInicio.getTime();
  const sf = slotFin.getTime();
  const bim = bi.getTime();
  const bfm = bf.getTime();
  return (
    (bim <= si && bfm > si) ||
    (bim < sf && bfm >= sf) ||
    (bim >= si && bfm <= sf)
  );
}

/** Misma lógica que checkAvailability / hasPacienteOverlap (solape estricto). */
function turnoSolapaSlot(turno, slotInicio, slotFin, excludeTurnoId) {
  if (excludeTurnoId && turno.id === excludeTurnoId) return false;
  const ti = turno.fecha_hora_inicio instanceof Date ? turno.fecha_hora_inicio : new Date(turno.fecha_hora_inicio);
  const tf = turno.fecha_hora_fin instanceof Date ? turno.fecha_hora_fin : new Date(turno.fecha_hora_fin);
  const t0 = ti.getTime();
  const t1 = tf.getTime();
  const s0 = slotInicio.getTime();
  const s1 = slotFin.getTime();
  if (Number.isNaN(t0) || Number.isNaN(t1) || Number.isNaN(s0) || Number.isNaN(s1)) {
    return false;
  }
  return t0 < s1 && t1 > s0;
}

/**
 * Validación de un slot con datos ya cargados (sin consultas por slot).
 */
function evaluarSlotTurnoCorePreloaded(profesional, paciente, inicio, fin, permiso_fuera_agenda, excludeTurnoId, ctx) {
  const { agendaConfigs, excepcionesPorFecha, bloques, turnosVentana } = ctx;
  const flags = emptyFlags();

  if (!permiso_fuera_agenda) {
    const cubiertoPorAgenda = agendaModel.coversDateTimeWithConfigs(agendaConfigs, inicio);
    const key = fechaLocalKey(inicio);
    const delDia = excepcionesPorFecha.get(key) || [];
    const cubiertoPorExcepcion = excepcionAgendaModel.coversDateTimeWithExcepcionesDelDia(delDia, inicio);
    if (!cubiertoPorAgenda && !cubiertoPorExcepcion) {
      flags.fuera_de_agenda = true;
    }
  }

  for (const b of bloques) {
    if (bloqueSolapaSlot(b, inicio, fin)) {
      flags.bloque = true;
      break;
    }
  }

  for (const t of turnosVentana) {
    if (!turnoSolapaSlot(t, inicio, fin, excludeTurnoId)) continue;
    if (t.paciente_id === paciente.id) {
      flags.paciente_solapado = true;
    }
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
 * Valida muchos slots: un find de profesional y paciente; luego 4 consultas en paralelo (agenda, excepciones,
 * bloques, turnos en ventana) y evaluación en memoria por slot — evita N× Promise.all contra la BD.
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
  if (!slots?.length) {
    return [];
  }

  const profesional =
    profesionalPrecargado !== undefined ? profesionalPrecargado : await profesionalModel.findById(profesional_id);
  const paciente =
    pacientePrecargado !== undefined ? pacientePrecargado : await pacienteModel.findById(paciente_id);

  const entidadErr = (() => {
    if (!profesional) {
      return { ok: false, flags: { ...emptyFlags(), profesional_inexistente: true }, mensaje: 'Profesional no encontrado' };
    }
    if (profesional.bloqueado) {
      return {
        ok: false,
        flags: { ...emptyFlags(), profesional_bloqueado: true },
        mensaje: 'No se pueden crear turnos para profesionales bloqueados'
      };
    }
    if (!paciente) {
      return { ok: false, flags: { ...emptyFlags(), paciente_inexistente: true }, mensaje: 'Paciente no encontrado' };
    }
    if (!paciente.activo) {
      return {
        ok: false,
        flags: { ...emptyFlags(), paciente_inactivo: true },
        mensaje: 'No se pueden crear turnos para pacientes inactivos'
      };
    }
    return null;
  })();

  if (entidadErr) {
    return slots.map(() => ({
      ok: entidadErr.ok,
      flags: { ...entidadErr.flags },
      mensaje: entidadErr.mensaje
    }));
  }

  if (slots.length === 1) {
    const slot = slots[0];
    const perm =
      slot.permiso_fuera_agenda != null ? Boolean(slot.permiso_fuera_agenda) : permiso_fuera_agenda_default;
    const one = await evaluarSlotTurnoCore(profesional, paciente, {
      fecha_hora_inicio: slot.fecha_hora_inicio,
      fecha_hora_fin: slot.fecha_hora_fin,
      permiso_fuera_agenda: perm,
      excludeTurnoId: slot.excludeTurnoId ?? null
    });
    return [one];
  }

  const parsed = slots.map((slot) => {
    const inicio = slot.fecha_hora_inicio instanceof Date ? slot.fecha_hora_inicio : new Date(slot.fecha_hora_inicio);
    const fin = slot.fecha_hora_fin instanceof Date ? slot.fecha_hora_fin : new Date(slot.fecha_hora_fin);
    const perm =
      slot.permiso_fuera_agenda != null ? Boolean(slot.permiso_fuera_agenda) : permiso_fuera_agenda_default;
    return {
      inicio,
      fin,
      perm,
      excludeTurnoId: slot.excludeTurnoId ?? null
    };
  });

  let minT = Infinity;
  let maxT = -Infinity;
  for (const p of parsed) {
    minT = Math.min(minT, p.inicio.getTime());
    maxT = Math.max(maxT, p.fin.getTime());
  }
  const minStart = new Date(minT);
  const maxEnd = new Date(maxT);
  const fechaDesde = fechaLocalKey(minStart);
  const fechaHasta = fechaLocalKey(maxEnd);

  const [agendaConfigs, excepciones, bloques, turnosVentana] = await Promise.all([
    agendaModel.findByProfesional(profesional.id, true, false),
    excepcionAgendaModel.findByProfesionalAndDateRange(profesional.id, fechaDesde, fechaHasta),
    bloqueModel.findByProfesional(profesional.id, fechaDesde, fechaHasta),
    turnoModel.findActiveInWindowForProfesional(profesional.id, minStart, maxEnd)
  ]);

  const excepcionesPorFecha = new Map();
  for (const ex of excepciones) {
    const key =
      typeof ex.fecha === 'string' && ex.fecha.length >= 10
        ? ex.fecha.slice(0, 10)
        : fechaLocalKey(new Date(ex.fecha));
    if (!excepcionesPorFecha.has(key)) excepcionesPorFecha.set(key, []);
    excepcionesPorFecha.get(key).push(ex);
  }

  const ctx = { agendaConfigs, excepcionesPorFecha, bloques, turnosVentana };

  return parsed.map((p) =>
    evaluarSlotTurnoCorePreloaded(
      profesional,
      paciente,
      p.inicio,
      p.fin,
      p.perm,
      p.excludeTurnoId,
      ctx
    )
  );
}

module.exports = {
  evaluarSlotTurno,
  evaluarSlotTurnoCore,
  evaluarSlotsTurnoBatch
};

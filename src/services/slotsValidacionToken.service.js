/**
 * Token corto (JWT) que ata la validación de slots al paso de creación de recurrencia.
 * Evita repetir evaluarSlotsTurnoBatch si el cliente envía el mismo payload que ya validó.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const TYP = 'slots_recurrencia_ok';
const TTL_SEC = parseInt(process.env.SLOTS_VALIDACION_TOKEN_TTL_SEC || '600', 10);

function normalizeSlotsForDigest(slots, permisoDefault) {
  const arr = slots.map((s) => {
    const i = new Date(s.fecha_hora_inicio).toISOString();
    const f = new Date(s.fecha_hora_fin).toISOString();
    const p = s.permiso_fuera_agenda != null ? Boolean(s.permiso_fuera_agenda) : Boolean(permisoDefault);
    return { i, f, p };
  });
  arr.sort((a, b) => a.i.localeCompare(b.i) || a.f.localeCompare(b.f) || String(a.p).localeCompare(String(b.p)));
  return JSON.stringify(arr);
}

function digestSlots(slots, permisoDefault) {
  return crypto.createHash('sha256').update(normalizeSlotsForDigest(slots, permisoDefault)).digest('hex');
}

/**
 * @param {object} opts
 * @param {string} opts.profesional_id
 * @param {string} opts.paciente_id
 * @param {string} opts.usuario_id - req.user.id que ejecutó la validación
 * @param {Array} opts.slots - mismos intervalos que luego irán en ocurrencias
 * @param {boolean} opts.permiso_fuera_agenda_default
 */
function emitirTokenValidacionSlots({ profesional_id, paciente_id, usuario_id, slots, permiso_fuera_agenda_default }) {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET no configurado');
  }
  const digest = digestSlots(slots, permiso_fuera_agenda_default);
  return jwt.sign(
    {
      typ: TYP,
      pid: profesional_id,
      pacid: paciente_id,
      uid: usuario_id,
      digest
    },
    process.env.JWT_SECRET,
    { expiresIn: TTL_SEC }
  );
}

/**
 * @returns {boolean} true si el token es válido y coincide con ocurrencias + usuario
 */
function verificarTokenParaOcurrencias(token, {
  profesional_id,
  paciente_id,
  usuario_id,
  ocurrencias,
  permiso_fuera_agenda_default
}) {
  if (!token || typeof token !== 'string') return false;
  if (!process.env.JWT_SECRET) return false;
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return false;
  }
  if (payload.typ !== TYP) return false;
  if (payload.pid !== profesional_id || payload.pacid !== paciente_id) return false;
  if (payload.uid !== usuario_id) return false;
  const digest = digestSlots(ocurrencias, permiso_fuera_agenda_default);
  return digest === payload.digest;
}

module.exports = {
  emitirTokenValidacionSlots,
  verificarTokenParaOcurrencias,
  digestSlots,
  TYP,
  TTL_SEC
};

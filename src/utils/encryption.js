/**
 * ENCRYPTION.JS - Cifrado de datos sensibles en BD
 *
 * Usa AES-256-GCM. La clave se toma de DATA_ENCRYPTION_KEY en .env
 * (debe ser una frase o string de al menos 16 caracteres; se deriva a 32 bytes con scrypt).
 * Formato guardado: "encv1:" + base64(iv + authTag + ciphertext).
 * Si no hay clave configurada, no se cifra (devuelve el valor tal cual).
 */

const crypto = require('crypto');

const ENCRYPTION_PREFIX = 'encv1:';
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SCRYPT_SALT = 'consultorio-mm-data-encryption-v1';

/** Clave derivada con scrypt (costosa). Debe calcularse una vez por proceso, no en cada encrypt/decrypt. */
let derivedKeyCache;

function getKey() {
  if (derivedKeyCache !== undefined) return derivedKeyCache;
  const pass = process.env.DATA_ENCRYPTION_KEY;
  if (!pass || typeof pass !== 'string' || pass.trim().length < 16) {
    derivedKeyCache = null;
    return null;
  }
  derivedKeyCache = crypto.scryptSync(pass.trim(), SCRYPT_SALT, KEY_LENGTH);
  return derivedKeyCache;
}

/**
 * Cifra un string. Si no hay clave o el valor es null/undefined, devuelve el valor original.
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function encrypt(value) {
  if (value === null || value === undefined) return value;
  const key = getKey();
  if (!key) return value;
  const str = String(value);
  if (str === '') return str;
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, enc]);
    return ENCRYPTION_PREFIX + combined.toString('base64');
  } catch (err) {
    return value;
  }
}

/**
 * Descifra un string. Si no tiene el prefijo encv1: o no hay clave, devuelve el valor tal cual.
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function decrypt(value) {
  if (value === null || value === undefined) return value;
  const key = getKey();
  if (!key) return value;
  const str = String(value);
  if (str === '' || !str.startsWith(ENCRYPTION_PREFIX)) return value;
  try {
    const raw = Buffer.from(str.slice(ENCRYPTION_PREFIX.length), 'base64');
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) return value;
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    return value;
  }
}

function isEncryptionEnabled() {
  return getKey() !== null;
}

/** Prefijo para cifrado determinístico (mismo valor -> mismo ciphertext, permite búsqueda) */
const ENCRYPTION_DETERMINISTIC_PREFIX = 'encv1d:';

/**
 * Cifra de forma determinística: mismo valor siempre produce mismo resultado.
 * Útil para campos que se usan en WHERE (ej. paciente_id en archivos_paciente).
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function encryptDeterministic(value) {
  if (value === null || value === undefined) return value;
  const key = getKey();
  if (!key) return value;
  const str = String(value);
  if (str === '') return str;
  try {
    const iv = crypto.createHmac('sha256', key).update('archivo-paciente-id-' + str).digest().subarray(0, IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(str, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const combined = Buffer.concat([iv, authTag, enc]);
    return ENCRYPTION_DETERMINISTIC_PREFIX + combined.toString('base64');
  } catch (err) {
    return value;
  }
}

/**
 * Descifra valor con prefijo encv1d: (determinístico).
 * @param {string|null|undefined} value
 * @returns {string|null|undefined}
 */
function decryptDeterministic(value) {
  if (value === null || value === undefined) return value;
  const key = getKey();
  if (!key) return value;
  const str = String(value);
  if (str === '' || !str.startsWith(ENCRYPTION_DETERMINISTIC_PREFIX)) return value;
  try {
    const raw = Buffer.from(str.slice(ENCRYPTION_DETERMINISTIC_PREFIX.length), 'base64');
    if (raw.length < IV_LENGTH + AUTH_TAG_LENGTH) return value;
    const iv = raw.subarray(0, IV_LENGTH);
    const authTag = raw.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = raw.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
  } catch (err) {
    return value;
  }
}

/** Normaliza fecha de nacimiento antes de cifrar (evita guardar Date#toString() local incorrecto). */
function normalizeFechaNacimientoForStorage(value) {
  if (value === undefined || value === null || value === '') return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : s;
}

/** Tras descifrar: dejar solo YYYY-MM-DD si venía ISO completo. */
function normalizeFechaNacimientoAfterDecrypt(value) {
  if (value === undefined || value === null || value === '') return value;
  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})(?:[T\s]|$)/);
  if (m) return m[1];
  return s;
}

/** Campos sensibles de pacientes que se cifran en BD (dni, nombre, apellido NO se cifran para búsqueda rápida) */
const PACIENTE_ENCRYPT_FIELDS = [
  'fecha_nacimiento', 'telefono', 'whatsapp', 'email',
  'direccion', 'obra_social', 'numero_afiliado', 'plan',
  'contacto_emergencia_nombre', 'contacto_emergencia_telefono',
  'contacto_emergencia_nombre_2', 'contacto_emergencia_telefono_2'
];

/** Campos a descifrar al leer (incluye dni, nombre, apellido por compatibilidad con datos legacy cifrados) */
const PACIENTE_DECRYPT_FIELDS = [
  'dni', 'nombre', 'apellido', 'fecha_nacimiento', 'telefono', 'whatsapp', 'email',
  'direccion', 'obra_social', 'numero_afiliado', 'plan',
  'contacto_emergencia_nombre', 'contacto_emergencia_telefono',
  'contacto_emergencia_nombre_2', 'contacto_emergencia_telefono_2'
];

function encryptPacienteRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of PACIENTE_ENCRYPT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(out, field)) continue;
    const val = out[field];
    if (val === null || val === '') {
      out[field] = null;
      continue;
    }
    let v = val;
    if (field === 'fecha_nacimiento') v = normalizeFechaNacimientoForStorage(v);
    if (v === null || v === '') {
      out[field] = null;
      continue;
    }
    out[field] = encrypt(v);
  }
  return out;
}

function decryptPacienteRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of PACIENTE_DECRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      let val = decrypt(out[field]);
      if (field === 'fecha_nacimiento') val = normalizeFechaNacimientoAfterDecrypt(val);
      out[field] = val;
    }
  }
  return out;
}

function decryptPacienteRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(decryptPacienteRow);
}

/** Solo columnas usadas en el listado paginado (menos trabajo de descifrado por fila). */
const PACIENTE_LIST_DECRYPT_FIELDS = [
  'dni',
  'nombre',
  'apellido',
  'telefono',
  'whatsapp',
  'email',
  'obra_social',
];

function decryptPacienteListRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of PACIENTE_LIST_DECRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = decrypt(out[field]);
    }
  }
  return out;
}

function decryptPacienteListRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(decryptPacienteListRow);
}

/** Campos de evoluciones_clinicas que se cifran */
const EVOLUCION_ENCRYPT_FIELDS = ['motivo_consulta', 'diagnostico', 'tratamiento', 'observaciones'];

function decryptEvolucionRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of EVOLUCION_ENCRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) out[field] = decrypt(out[field]);
  }
  if (out.paciente_nombre != null) out.paciente_nombre = decrypt(out.paciente_nombre);
  if (out.paciente_apellido != null) out.paciente_apellido = decrypt(out.paciente_apellido);
  if (out.paciente_dni != null) out.paciente_dni = decrypt(out.paciente_dni);
  return out;
}

function decryptEvolucionRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(decryptEvolucionRow);
}

/** Campos de turnos que se cifran en BD (el motivo va en claro; datos viejos con prefijo encv1: se descifran al leer). */
const TURNO_ENCRYPT_FIELDS = ['razon_cancelacion'];

function encryptTurnoRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of TURNO_ENCRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = encrypt(out[field]);
    }
  }
  return out;
}

function decryptTurnoRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of TURNO_ENCRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = decrypt(out[field]);
    }
  }
  // Motivo de turno: siempre en claro en BD (migración: scripts/migrate-decrypt-turnos-motivo.js)
  // Datos de paciente del JOIN (vienen de tabla pacientes, pueden estar cifrados)
  if (out.paciente_nombre != null) out.paciente_nombre = decrypt(out.paciente_nombre);
  if (out.paciente_apellido != null) out.paciente_apellido = decrypt(out.paciente_apellido);
  if (out.paciente_dni != null) out.paciente_dni = decrypt(out.paciente_dni);
  if (out.paciente_telefono != null) out.paciente_telefono = decrypt(out.paciente_telefono);
  if (out.paciente_whatsapp != null) out.paciente_whatsapp = decrypt(out.paciente_whatsapp);
  if (out.paciente_email != null) out.paciente_email = decrypt(out.paciente_email);
  return out;
}

function decryptTurnoRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(decryptTurnoRow);
}

/** Campos de archivos_paciente (NO se cifran por decisión del cliente: permite backups y acceso directo a los archivos) */
const ARCHIVO_ENCRYPT_FIELDS = ['nombre_archivo', 'url_archivo', 'descripcion'];

/**
 * No-op: los archivos adjuntos NO se cifran.
 * Permite backups, recuperación y acceso directo a los archivos sin depender de la clave de cifrado.
 */
function encryptArchivoRow(row) {
  return row;
}

/**
 * Descifra fila de archivo. No-op si los datos están en claro (compatibilidad con datos legacy cifrados).
 */
function decryptArchivoRow(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of ARCHIVO_ENCRYPT_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = decrypt(out[field]);
    }
  }
  if (out.paciente_id !== undefined && out.paciente_id !== null && String(out.paciente_id).startsWith(ENCRYPTION_DETERMINISTIC_PREFIX)) {
    out.paciente_id = decryptDeterministic(out.paciente_id);
  }
  if (out.paciente_nombre != null) out.paciente_nombre = decrypt(out.paciente_nombre);
  if (out.paciente_apellido != null) out.paciente_apellido = decrypt(out.paciente_apellido);
  if (out.paciente_dni != null) out.paciente_dni = decrypt(out.paciente_dni);
  return out;
}

function decryptArchivoRows(rows) {
  if (!Array.isArray(rows)) return rows;
  return rows.map(decryptArchivoRow);
}

module.exports = {
  encrypt,
  decrypt,
  encryptDeterministic,
  decryptDeterministic,
  isEncryptionEnabled,
  ENCRYPTION_PREFIX,
  ENCRYPTION_DETERMINISTIC_PREFIX,
  PACIENTE_ENCRYPT_FIELDS,
  PACIENTE_DECRYPT_FIELDS,
  encryptPacienteRow,
  decryptPacienteRow,
  decryptPacienteRows,
  decryptPacienteListRow,
  decryptPacienteListRows,
  EVOLUCION_ENCRYPT_FIELDS,
  decryptEvolucionRow,
  decryptEvolucionRows,
  TURNO_ENCRYPT_FIELDS,
  encryptTurnoRow,
  decryptTurnoRow,
  decryptTurnoRows,
  ARCHIVO_ENCRYPT_FIELDS,
  encryptArchivoRow,
  decryptArchivoRow,
  decryptArchivoRows
};

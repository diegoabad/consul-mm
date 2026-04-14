/**
 * Fechas de turnos mostradas siempre en hora de Argentina (alineado con TZ del proceso).
 */
const TZ_ARG = process.env.TZ || 'America/Argentina/Buenos_Aires';

function parseTurnoFecha(val) {
  if (val == null || val === '') return null;
  const d = new Date(typeof val === 'string' && !val.endsWith('Z') ? `${val}Z` : val);
  return Number.isNaN(d.getTime()) ? null : d;
}

function cap(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Recordatorio WhatsApp: "Lunes 15 de Enero del 2026 a las 14:30Hs" */
function formatearFechaHoraRecordatorio(val) {
  const d = parseTurnoFecha(val);
  if (!d) return val == null || val === '' ? '-' : String(val);
  try {
    const parts = new Intl.DateTimeFormat('es-AR', {
      timeZone: TZ_ARG,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const weekday = cap(get('weekday'));
    const day = get('day');
    const month = cap(get('month'));
    const year = get('year');
    let hour = get('hour');
    let minute = get('minute');
    if (hour != null && String(hour).length < 2) hour = String(hour).padStart(2, '0');
    if (minute != null && String(minute).length < 2) minute = String(minute).padStart(2, '0');
    return `${weekday} ${day} de ${month} del ${year} a las ${hour}:${minute}Hs`;
  } catch {
    return String(val);
  }
}

/** Respuestas HTML Twilio: "15 de enero a las 14:30hs" */
function formatearFechaHoraCorta(val) {
  const d = parseTurnoFecha(val);
  if (!d) return val == null || val === '' ? '-' : String(val);
  try {
    const parts = new Intl.DateTimeFormat('es-AR', {
      timeZone: TZ_ARG,
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(d);
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = get('day');
    const month = get('month');
    let hour = get('hour');
    let minute = get('minute');
    if (hour != null && String(hour).length < 2) hour = String(hour).padStart(2, '0');
    if (minute != null && String(minute).length < 2) minute = String(minute).padStart(2, '0');
    return `${day} de ${month} a las ${hour}:${minute}hs`;
  } catch {
    return String(val);
  }
}

module.exports = {
  formatearFechaHoraRecordatorio,
  formatearFechaHoraCorta,
  TZ_ARG,
};

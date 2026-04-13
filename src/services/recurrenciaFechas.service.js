/**
 * Generación pura de ocurrencias de recurrencia (UTC, alineado con almacenamiento de turnos).
 * No accede a base de datos.
 */

const MS_DIA = 86400000;

function parseDate(d) {
  return d instanceof Date ? d : new Date(d);
}

/** N-ésima aparición del día de la semana en el mes (UTC), 1..5 */
function weekOfMonthUTC(date) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const dow = date.getUTCDay();
  const dom = date.getUTCDate();
  let n = 0;
  for (let day = 1; day <= dom; day++) {
    const t = new Date(Date.UTC(y, m, day));
    if (t.getUTCDay() === dow) n += 1;
  }
  return n;
}

/** true si no hay otro mismo día de la semana después en ese mes (UTC) */
function isLastWeekdayOfMonthUTC(d) {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const dow = d.getUTCDay();
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  for (let day = d.getUTCDate() + 1; day <= lastDay; day++) {
    if (new Date(Date.UTC(y, m, day)).getUTCDay() === dow) return false;
  }
  return true;
}

/**
 * @param {number} year
 * @param {number} month0 0-11
 * @param {number|null} n 1-4 o null = última ocurrencia del dow en el mes
 * @param {number} dowUtc 0-6 (domingo-sábado)
 */
function nthWeekdayOfMonthUTC(year, month0, n, dowUtc) {
  const lastDay = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
  if (n == null) {
    for (let d = lastDay; d >= 1; d--) {
      const t = new Date(Date.UTC(year, month0, d));
      if (t.getUTCDay() === dowUtc) return t;
    }
    return null;
  }
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const t = new Date(Date.UTC(year, month0, d));
    if (t.getUTCDay() === dowUtc) {
      count += 1;
      if (count === n) return t;
    }
  }
  return null;
}

function mergeUtcTime(dayDate, template) {
  return new Date(
    Date.UTC(
      dayDate.getUTCFullYear(),
      dayDate.getUTCMonth(),
      dayDate.getUTCDate(),
      template.getUTCHours(),
      template.getUTCMinutes(),
      template.getUTCSeconds(),
      template.getUTCMilliseconds()
    )
  );
}

function monthsBetweenUTC(start, date) {
  return (
    (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (date.getUTCMonth() - start.getUTCMonth())
  );
}

/**
 * @param {object} opts
 * @param {'semanal'|'quincenal'|'mensual'} opts.frecuencia
 * @param {Date|string} opts.fecha_hora_inicio
 * @param {Date|string} opts.fecha_hora_fin
 * @param {number} [opts.dia_semana] 0-6 UTC; mensual requiere o se infiere de la primera fecha
 * @param {number|null} [opts.semana_del_mes] 1-4 o null = última
 * @param {Date|string|null} [opts.fecha_fin] tope inclusive de inicio de ocurrencia
 * @param {number|null} [opts.max_ocurrencias] tope de filas (ya acotado por caller)
 * @param {number|null} [opts.meses_max] meses desde el mes de la primera fecha (0 = solo primer mes)
 */
function generarOcurrencias(opts) {
  const frecuencia = opts.frecuencia;
  const inicio0 = parseDate(opts.fecha_hora_inicio);
  const fin0 = parseDate(opts.fecha_hora_fin);
  if (Number.isNaN(inicio0.getTime()) || Number.isNaN(fin0.getTime())) {
    throw new Error('fecha_hora_inicio y fecha_hora_fin inválidas');
  }
  const durMs = fin0.getTime() - inicio0.getTime();
  if (durMs <= 0) {
    throw new Error('La duración del turno debe ser mayor a cero');
  }

  const maxOc = opts.max_ocurrencias != null ? Math.max(1, parseInt(String(opts.max_ocurrencias), 10)) : null;
  const fechaFinTope = opts.fecha_fin != null ? parseDate(opts.fecha_fin) : null;
  const mesesMax =
    opts.meses_max != null ? Math.max(1, parseInt(String(opts.meses_max), 10)) : null;

  const startMonthAnchor = new Date(Date.UTC(inicio0.getUTCFullYear(), inicio0.getUTCMonth(), 1));

  let diaSemana = opts.dia_semana;
  let semanaDelMes = opts.semana_del_mes !== undefined ? opts.semana_del_mes : undefined;

  if (frecuencia === 'mensual') {
    if (diaSemana === undefined || diaSemana === null) {
      diaSemana = inicio0.getUTCDay();
    }
    if (semanaDelMes === undefined) {
      semanaDelMes = isLastWeekdayOfMonthUTC(inicio0) ? null : weekOfMonthUTC(inicio0);
    }
  }

  const out = [];
  let count = 0;

  const dentroDeMesesMax = (d) => {
    if (mesesMax == null) return true;
    return monthsBetweenUTC(startMonthAnchor, d) < mesesMax;
  };

  const antesDeFechaFin = (d) => {
    if (!fechaFinTope || Number.isNaN(fechaFinTope.getTime())) return true;
    return d.getTime() <= fechaFinTope.getTime();
  };

  if (frecuencia === 'semanal' || frecuencia === 'quincenal') {
    const step = frecuencia === 'semanal' ? 7 * MS_DIA : 14 * MS_DIA;
    let cur = inicio0.getTime();
    while (true) {
      const ini = new Date(cur);
      if (!dentroDeMesesMax(ini)) break;
      if (!antesDeFechaFin(ini)) break;
      out.push({ fecha_hora_inicio: new Date(cur), fecha_hora_fin: new Date(cur + durMs) });
      count += 1;
      if (maxOc != null && count >= maxOc) break;
      cur += step;
    }
    return out;
  }

  if (frecuencia === 'mensual') {
    const siguienteMensual = () => {
      const y = curInicio.getUTCFullYear();
      const m = curInicio.getUTCMonth();
      let mm = m + 1;
      let yy = y;
      if (mm > 11) {
        mm = 0;
        yy += 1;
      }
      let day = nthWeekdayOfMonthUTC(yy, mm, semanaDelMes, diaSemana);
      if (!day) {
        for (let guard = 0; guard < 36; guard++) {
          mm += 1;
          if (mm > 11) {
            mm = 0;
            yy += 1;
          }
          day = nthWeekdayOfMonthUTC(yy, mm, semanaDelMes, diaSemana);
          if (day) break;
        }
      }
      if (!day) return null;
      return mergeUtcTime(day, inicio0);
    };

    let curInicio = new Date(inicio0.getTime());
    while (true) {
      if (!dentroDeMesesMax(curInicio)) break;
      if (!antesDeFechaFin(curInicio)) break;
      out.push({
        fecha_hora_inicio: new Date(curInicio.getTime()),
        fecha_hora_fin: new Date(curInicio.getTime() + durMs)
      });
      count += 1;
      if (maxOc != null && count >= maxOc) break;

      const next = siguienteMensual();
      if (!next) break;
      curInicio = next;
    }
    return out;
  }

  throw new Error(`Frecuencia no soportada: ${frecuencia}`);
}

module.exports = {
  generarOcurrencias,
  weekOfMonthUTC,
  isLastWeekdayOfMonthUTC,
  nthWeekdayOfMonthUTC
};

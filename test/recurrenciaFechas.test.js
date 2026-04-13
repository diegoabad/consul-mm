/**
 * Tests unitarios del generador de fechas de recurrencia (sin DB).
 */

const {
  generarOcurrencias,
  weekOfMonthUTC,
  nthWeekdayOfMonthUTC
} = require('../src/services/recurrenciaFechas.service');

describe('recurrenciaFechas — semanal', () => {
  it('genera N ocurrencias cada 7 días', () => {
    const inicio = new Date('2026-03-04T15:00:00.000Z');
    const fin = new Date('2026-03-04T15:30:00.000Z');
    const r = generarOcurrencias({
      frecuencia: 'semanal',
      fecha_hora_inicio: inicio,
      fecha_hora_fin: fin,
      max_ocurrencias: 3
    });
    expect(r).toHaveLength(3);
    expect(r[0].fecha_hora_inicio.toISOString()).toBe('2026-03-04T15:00:00.000Z');
    expect(r[1].fecha_hora_inicio.toISOString()).toBe('2026-03-11T15:00:00.000Z');
    expect(r[2].fecha_hora_inicio.toISOString()).toBe('2026-03-18T15:00:00.000Z');
  });
});

describe('recurrenciaFechas — quincenal', () => {
  it('salta de a 14 días', () => {
    const inicio = new Date('2026-01-01T10:00:00.000Z');
    const fin = new Date('2026-01-01T10:20:00.000Z');
    const r = generarOcurrencias({
      frecuencia: 'quincenal',
      fecha_hora_inicio: inicio,
      fecha_hora_fin: fin,
      max_ocurrencias: 2
    });
    expect(r).toHaveLength(2);
    const diff = (r[1].fecha_hora_inicio - r[0].fecha_hora_inicio) / (14 * 86400000);
    expect(diff).toBe(1);
  });
});

describe('recurrenciaFechas — mensual (1.er miércoles)', () => {
  it('primer miércoles de marzo 2026 y siguiente mes', () => {
    const inicio = new Date('2026-03-04T12:00:00.000Z');
    const fin = new Date('2026-03-04T12:30:00.000Z');
    const r = generarOcurrencias({
      frecuencia: 'mensual',
      fecha_hora_inicio: inicio,
      fecha_hora_fin: fin,
      dia_semana: 3,
      semana_del_mes: 1,
      max_ocurrencias: 2
    });
    expect(r.length).toBe(2);
    expect(r[0].fecha_hora_inicio.getUTCMonth()).toBe(2);
    expect(r[1].fecha_hora_inicio.getUTCMonth()).toBe(3);
  });
});

describe('recurrenciaFechas — helpers', () => {
  it('nthWeekdayOfMonthUTC primer lunes feb 2026', () => {
    const d = nthWeekdayOfMonthUTC(2026, 1, 1, 1);
    expect(d.getUTCDate()).toBe(2);
    expect(d.getUTCDay()).toBe(1);
  });

  it('weekOfMonthUTC cuenta ocurrencias', () => {
    const d = new Date('2026-03-18T12:00:00.000Z');
    expect(weekOfMonthUTC(d)).toBe(3);
  });
});

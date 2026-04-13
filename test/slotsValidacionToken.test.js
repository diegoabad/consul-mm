/**
 * Digest del token de validación: mismo conjunto de intervalos en distinto orden = mismo hash
 */
const { digestSlots } = require('../src/services/slotsValidacionToken.service');

describe('slotsValidacionToken — digest', () => {
  test('mismo digest con distinto orden de slots', () => {
    const a = [
      { fecha_hora_inicio: '2026-06-01T14:00:00.000Z', fecha_hora_fin: '2026-06-01T15:00:00.000Z' },
      { fecha_hora_inicio: '2026-06-08T14:00:00.000Z', fecha_hora_fin: '2026-06-08T15:00:00.000Z' }
    ];
    const b = [a[1], a[0]];
    expect(digestSlots(a, false)).toBe(digestSlots(b, false));
  });
});

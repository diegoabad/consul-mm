-- Convierte turnos guardados en UTC a hora Argentina (America/Argentina/Buenos_Aires).
-- Ejecutar una sola vez después de desplegar el cambio que guarda en Argentina.
-- Los turnos creados después de ese cambio ya se guardan en Argentina; este script
-- corrige los que quedaron en UTC.

UPDATE turnos
SET
  fecha_hora_inicio = (fecha_hora_inicio::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires'),
  fecha_hora_fin = (fecha_hora_fin::timestamp AT TIME ZONE 'UTC' AT TIME ZONE 'America/Argentina/Buenos_Aires')
WHERE fecha_hora_inicio IS NOT NULL AND fecha_hora_fin IS NOT NULL;

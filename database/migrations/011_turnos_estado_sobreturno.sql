-- Agregar estado 'sobreturno' a turnos (turno en horario ya ocupado por otro paciente)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    WHERE t.relname = 'turnos' AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE turnos DROP CONSTRAINT %I', r.conname);
  END LOOP;
END
$$;

ALTER TABLE turnos ADD CONSTRAINT turnos_estado_check
  CHECK (estado IN ('confirmado', 'pendiente', 'cancelado', 'completado', 'ausente', 'sobreturno'));

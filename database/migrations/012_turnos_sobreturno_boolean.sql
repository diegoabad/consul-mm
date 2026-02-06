-- Agregar columna sobreturno (boolean) y quitar 'sobreturno' del estado
-- Si ya existía estado 'sobreturno' en turnos, migrar a pendiente + sobreturno = true

-- 1. Agregar columna sobreturno
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS sobreturno BOOLEAN DEFAULT false;

-- 2. Migrar turnos que tenían estado 'sobreturno' (por si se corrió 011)
UPDATE turnos SET estado = 'pendiente', sobreturno = true WHERE estado = 'sobreturno';

-- 3. Quitar constraint de estado y volver a crearlo sin 'sobreturno'
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
  CHECK (estado IN ('confirmado', 'pendiente', 'cancelado', 'completado', 'ausente'));

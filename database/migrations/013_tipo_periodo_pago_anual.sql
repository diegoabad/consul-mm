-- Añadir valor 'anual' al tipo_periodo_pago de profesionales
-- (PostgreSQL puede nombrar el CHECK como profesionales_tipo_periodo_pago_check)
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_attribute a ON a.attnum = ANY(c.conkey) AND a.attrelid = c.conrelid
  WHERE c.conrelid = 'profesionales'::regclass
    AND c.contype = 'c'
    AND a.attname = 'tipo_periodo_pago'
  LIMIT 1;
  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE profesionales DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE profesionales
ADD CONSTRAINT profesionales_tipo_periodo_pago_check
CHECK (tipo_periodo_pago IS NULL OR tipo_periodo_pago IN ('mensual', 'quincenal', 'semanal', 'anual'));

COMMENT ON COLUMN profesionales.tipo_periodo_pago IS 'Período de pago del contrato: mensual, quincenal, semanal o anual (NULL si no hay contrato)';

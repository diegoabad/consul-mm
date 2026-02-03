-- Añadir columna tipo_periodo_pago a profesionales (mensual, quincenal, semanal)
ALTER TABLE profesionales
ADD COLUMN IF NOT EXISTS tipo_periodo_pago VARCHAR(20) DEFAULT 'mensual'
CHECK (tipo_periodo_pago IN ('mensual', 'quincenal', 'semanal'));

COMMENT ON COLUMN profesionales.tipo_periodo_pago IS 'Período de pago del contrato: mensual, quincenal o semanal';

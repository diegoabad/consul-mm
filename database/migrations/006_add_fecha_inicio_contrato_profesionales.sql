-- Añadir columna fecha_inicio_contrato a profesionales (fecha de inicio del contrato)
ALTER TABLE profesionales
ADD COLUMN IF NOT EXISTS fecha_inicio_contrato DATE;

COMMENT ON COLUMN profesionales.fecha_inicio_contrato IS 'Fecha de inicio del contrato del profesional';

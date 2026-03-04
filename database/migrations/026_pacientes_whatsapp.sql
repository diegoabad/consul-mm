-- Agrega columna de número WhatsApp separado del teléfono.
-- Se usa para enviar recordatorios automáticos de turnos.
-- Si está vacío, el servicio de recordatorios usa el campo "telefono" como fallback.
ALTER TABLE pacientes
  ADD COLUMN IF NOT EXISTS whatsapp TEXT;

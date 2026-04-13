-- Migración 038: El administrador puede deshabilitar recordatorios WhatsApp por profesional
-- (independiente de la preferencia del profesional). Default true = comportamiento actual.

ALTER TABLE profesionales
  ADD COLUMN IF NOT EXISTS recordatorio_whatsapp_permitido_admin BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN profesionales.recordatorio_whatsapp_permitido_admin IS
  'Si es false, no se envían recordatorios WhatsApp para este profesional; solo el admin puede volver a habilitar.';

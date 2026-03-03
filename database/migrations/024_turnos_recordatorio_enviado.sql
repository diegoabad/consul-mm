-- Migración 024: Control de recordatorio WhatsApp enviado por turno
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS recordatorio_enviado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_enviado_at TIMESTAMP;

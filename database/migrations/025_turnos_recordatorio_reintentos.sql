-- Migración 025: Seguimiento de intentos de envío de recordatorio por turno
ALTER TABLE turnos
  ADD COLUMN IF NOT EXISTS recordatorio_intentos INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recordatorio_ultimo_error TEXT;

-- Migración 023: Configuración de recordatorios WhatsApp por profesional
ALTER TABLE profesionales
  ADD COLUMN IF NOT EXISTS recordatorio_activo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recordatorio_horas_antes INTEGER NOT NULL DEFAULT 24;

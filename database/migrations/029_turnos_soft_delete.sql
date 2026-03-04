-- Migración 029: Soft-delete para turnos
-- En lugar de borrar físicamente un turno, se marca deleted_at con la fecha de eliminación.
-- Esto preserva el historial de recordatorios enviados asociados al turno.
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

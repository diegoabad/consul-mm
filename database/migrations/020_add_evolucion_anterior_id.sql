-- Migración 020: agregar evolucion_anterior_id a evoluciones_clinicas
-- Permite marcar una evolución como corrección/aclaración de otra (sin editar ni borrar la anterior).

ALTER TABLE evoluciones_clinicas
  ADD COLUMN IF NOT EXISTS evolucion_anterior_id UUID NULL
  REFERENCES evoluciones_clinicas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_evoluciones_evolucion_anterior_id
  ON evoluciones_clinicas(evolucion_anterior_id);

COMMENT ON COLUMN evoluciones_clinicas.evolucion_anterior_id IS 'Si esta evolución es corrección o aclaración de otra, referencia a esa evolución.';

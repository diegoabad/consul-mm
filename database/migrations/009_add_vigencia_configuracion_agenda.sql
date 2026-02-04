-- Añadir vigencia a configuracion_agenda para guardar periodos de disponibilidad
-- (permite historial: al cambiar horarios se cierra el periodo actual y se abre uno nuevo)

ALTER TABLE configuracion_agenda
  ADD COLUMN IF NOT EXISTS vigencia_desde DATE NOT NULL DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS vigencia_hasta DATE;

-- Rellenar vigencia en filas existentes (usar fecha_creacion como inicio del periodo)
UPDATE configuracion_agenda
SET vigencia_desde = (fecha_creacion)::date
WHERE fecha_creacion IS NOT NULL;

-- Asegurar default para nuevas filas
ALTER TABLE configuracion_agenda
  ALTER COLUMN vigencia_desde SET DEFAULT CURRENT_DATE;

-- Quitar UNIQUE anterior (profesional_id, dia_semana, hora_inicio) para permitir varios periodos
ALTER TABLE configuracion_agenda
  DROP CONSTRAINT IF EXISTS configuracion_agenda_profesional_id_dia_semana_hora_inicio_key;

-- Un solo horario vigente por (profesional, dia, hora_inicio): solo una fila con vigencia_hasta IS NULL
CREATE UNIQUE INDEX IF NOT EXISTS idx_config_agenda_vigente_uniq
  ON configuracion_agenda(profesional_id, dia_semana, hora_inicio)
  WHERE vigencia_hasta IS NULL;

CREATE INDEX IF NOT EXISTS idx_config_agenda_vigencia ON configuracion_agenda(vigencia_desde, vigencia_hasta);

COMMENT ON COLUMN configuracion_agenda.vigencia_desde IS 'Fecha desde la que rige esta configuración';
COMMENT ON COLUMN configuracion_agenda.vigencia_hasta IS 'Fecha hasta la que rigió (NULL = vigente)';

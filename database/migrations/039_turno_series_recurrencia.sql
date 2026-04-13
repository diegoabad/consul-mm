-- Migración 039: Series de turnos recurrentes
CREATE TABLE IF NOT EXISTS turno_series (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
  paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  frecuencia VARCHAR(20) NOT NULL CHECK (frecuencia IN ('semanal', 'quincenal', 'mensual')),
  mensual_modo VARCHAR(30),
  dia_semana SMALLINT,
  semana_del_mes SMALLINT,
  hora_inicio TIME,
  hora_fin TIME,
  fecha_inicio_serie TIMESTAMP NOT NULL,
  fecha_fin TIMESTAMP,
  max_ocurrencias INT,
  creado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  terminada_en TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turno_series_profesional ON turno_series(profesional_id);
CREATE INDEX IF NOT EXISTS idx_turno_series_paciente ON turno_series(paciente_id);

ALTER TABLE turnos ADD COLUMN IF NOT EXISTS serie_id UUID REFERENCES turno_series(id) ON DELETE SET NULL;
ALTER TABLE turnos ADD COLUMN IF NOT EXISTS serie_secuencia INT;

CREATE INDEX IF NOT EXISTS idx_turnos_serie_fecha ON turnos(serie_id, fecha_hora_inicio) WHERE deleted_at IS NULL;

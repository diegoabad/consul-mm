-- Crear tabla excepciones_agenda (días puntuales en que el profesional atiende)
CREATE TABLE IF NOT EXISTS excepciones_agenda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_turno_minutos INTEGER DEFAULT 30,
    observaciones VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(profesional_id, fecha, hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_excepciones_agenda_profesional_id ON excepciones_agenda(profesional_id);
CREATE INDEX IF NOT EXISTS idx_excepciones_agenda_fecha ON excepciones_agenda(fecha);

DROP TRIGGER IF EXISTS trigger_actualizar_excepciones_agenda ON excepciones_agenda;
CREATE TRIGGER trigger_actualizar_excepciones_agenda
    BEFORE UPDATE ON excepciones_agenda
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

COMMENT ON TABLE excepciones_agenda IS 'Excepciones de agenda: días puntuales en que el profesional atiende (además o en lugar de su agenda semanal)';

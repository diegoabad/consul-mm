-- Asignación: admin/secretaria asignan profesionales a un paciente; el profesional solo ve pacientes asignados.
CREATE TABLE IF NOT EXISTS paciente_profesional (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    asignado_por_usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    fecha_asignacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(paciente_id, profesional_id)
);

CREATE INDEX IF NOT EXISTS idx_paciente_profesional_paciente ON paciente_profesional(paciente_id);
CREATE INDEX IF NOT EXISTS idx_paciente_profesional_profesional ON paciente_profesional(profesional_id);

COMMENT ON TABLE paciente_profesional IS 'Asignación de profesionales a pacientes; el profesional solo ve pacientes donde está asignado.';

-- Derivación: un profesional da acceso a otro para ver sus evoluciones/notas/archivos/turnos de ese paciente.
CREATE TABLE IF NOT EXISTS paciente_profesional_compartido (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    profesional_id_owner UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    profesional_id_compartido UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    fecha_compartido TIMESTAMP DEFAULT NOW(),
    UNIQUE(paciente_id, profesional_id_owner, profesional_id_compartido),
    CHECK (profesional_id_owner != profesional_id_compartido)
);

CREATE INDEX IF NOT EXISTS idx_paciente_compartido_paciente ON paciente_profesional_compartido(paciente_id);
CREATE INDEX IF NOT EXISTS idx_paciente_compartido_owner ON paciente_profesional_compartido(profesional_id_owner);
CREATE INDEX IF NOT EXISTS idx_paciente_compartido_compartido ON paciente_profesional_compartido(profesional_id_compartido);

COMMENT ON TABLE paciente_profesional_compartido IS 'Un profesional comparte con otro el acceso a ver sus evoluciones, notas, archivos y turnos de ese paciente (derivación).';

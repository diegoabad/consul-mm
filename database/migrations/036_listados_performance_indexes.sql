-- Índices para acelerar ORDER BY y filtros en listados (pacientes, usuarios, profesionales).
-- Nota: paciente_profesional(profesional_id) ya está en 010_paciente_profesional_asignacion_compartido.sql

CREATE INDEX IF NOT EXISTS idx_pacientes_fecha_creacion_desc ON pacientes (fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_usuarios_fecha_creacion_desc ON usuarios (fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_profesionales_fecha_creacion_desc ON profesionales (fecha_creacion DESC);

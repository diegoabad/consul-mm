-- ============================================
-- MIGRACIÓN: Agregar usuario_id a archivos_paciente y hacer profesional_id nullable
-- ============================================
-- Permite que cualquier usuario (profesional, secretaria, administrador) pueda subir archivos.
-- Si el usuario es profesional se guarda también profesional_id; si no, profesional_id queda NULL.

-- Paso 1: Agregar columna usuario_id (nullable al inicio)
ALTER TABLE archivos_paciente
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE SET NULL;

-- Paso 2: Migrar datos existentes: obtener usuario_id desde profesionales
UPDATE archivos_paciente a
SET usuario_id = p.usuario_id
FROM profesionales p
WHERE a.profesional_id = p.id
AND a.usuario_id IS NULL;

-- Paso 3: Hacer usuario_id NOT NULL (todos los existentes tienen ya usuario_id por el UPDATE)
ALTER TABLE archivos_paciente ALTER COLUMN usuario_id SET NOT NULL;

-- Paso 4: Hacer profesional_id nullable (para subidas de secretaria/administrador)
ALTER TABLE archivos_paciente ALTER COLUMN profesional_id DROP NOT NULL;

-- Paso 5: Índice para usuario_id
CREATE INDEX IF NOT EXISTS idx_archivos_paciente_usuario_id ON archivos_paciente(usuario_id);

COMMENT ON COLUMN archivos_paciente.usuario_id IS 'Usuario que subió el archivo (puede ser profesional, secretaria o administrador)';

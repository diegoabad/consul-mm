-- ============================================
-- MIGRACIÓN: Cambiar notas_paciente de profesional_id a usuario_id
-- ============================================
-- Esta migración cambia la tabla notas_paciente para que use usuario_id
-- en lugar de profesional_id. Si el schema ya tiene usuario_id (sin profesional_id), se omite la migración de datos.

-- Paso 1: Agregar columna usuario_id (temporalmente nullable) si no existe
ALTER TABLE notas_paciente 
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- Paso 2 y 3: Solo si existe profesional_id, migrar datos y eliminar columna
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'notas_paciente' AND column_name = 'profesional_id'
    ) THEN
        -- Migrar datos existentes
        UPDATE notas_paciente n
        SET usuario_id = p.usuario_id
        FROM profesionales p
        WHERE n.profesional_id = p.id AND n.usuario_id IS NULL;
        -- Verificar que no queden NULL
        IF EXISTS (SELECT 1 FROM notas_paciente WHERE usuario_id IS NULL) THEN
            RAISE EXCEPTION 'No se pueden migrar todos los registros. Hay notas sin usuario_id asociado.';
        END IF;
        ALTER TABLE notas_paciente ALTER COLUMN usuario_id SET NOT NULL;
        DROP INDEX IF EXISTS idx_notas_paciente_profesional_id;
        ALTER TABLE notas_paciente DROP COLUMN IF EXISTS profesional_id;
    END IF;
END $$;

-- Paso 4: Asegurar NOT NULL en usuario_id (por si la tabla vino del schema sin profesional_id)
ALTER TABLE notas_paciente ALTER COLUMN usuario_id SET NOT NULL;

-- Paso 5: Crear índice para usuario_id
CREATE INDEX IF NOT EXISTS idx_notas_paciente_usuario_id ON notas_paciente(usuario_id);

-- Paso 6: Actualizar comentarios
COMMENT ON COLUMN notas_paciente.usuario_id IS 'ID del usuario que creó la nota (puede ser cualquier tipo de usuario)';

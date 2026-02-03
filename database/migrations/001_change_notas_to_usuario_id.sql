-- ============================================
-- MIGRACIÓN: Cambiar notas_paciente de profesional_id a usuario_id
-- ============================================
-- Esta migración cambia la tabla notas_paciente para que use usuario_id
-- en lugar de profesional_id, permitiendo que cualquier usuario pueda crear notas.

-- Paso 1: Agregar columna usuario_id (temporalmente nullable)
ALTER TABLE notas_paciente 
ADD COLUMN IF NOT EXISTS usuario_id UUID REFERENCES usuarios(id) ON DELETE CASCADE;

-- Paso 2: Migrar datos existentes: obtener usuario_id desde profesionales
UPDATE notas_paciente n
SET usuario_id = p.usuario_id
FROM profesionales p
WHERE n.profesional_id = p.id
AND n.usuario_id IS NULL;

-- Paso 3: Hacer usuario_id NOT NULL (solo si todos los registros tienen usuario_id)
-- Primero verificamos que no haya NULLs
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM notas_paciente WHERE usuario_id IS NULL) THEN
        RAISE EXCEPTION 'No se pueden migrar todos los registros. Hay notas sin usuario_id asociado.';
    END IF;
END $$;

ALTER TABLE notas_paciente 
ALTER COLUMN usuario_id SET NOT NULL;

-- Paso 4: Eliminar la columna profesional_id y su índice
DROP INDEX IF EXISTS idx_notas_paciente_profesional_id;
ALTER TABLE notas_paciente DROP COLUMN IF EXISTS profesional_id;

-- Paso 5: Crear nuevo índice para usuario_id
CREATE INDEX IF NOT EXISTS idx_notas_paciente_usuario_id ON notas_paciente(usuario_id);

-- Paso 6: Actualizar comentarios
COMMENT ON COLUMN notas_paciente.usuario_id IS 'ID del usuario que creó la nota (puede ser cualquier tipo de usuario)';

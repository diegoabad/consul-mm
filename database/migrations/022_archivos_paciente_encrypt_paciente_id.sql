-- =============================================================================
-- Migración 022: Permitir cifrado de paciente_id en archivos_paciente
--
-- Oculta el vínculo paciente-archivo en la BD. Con DATA_ENCRYPTION_KEY,
-- paciente_id se guarda cifrado (determinístico para permitir búsqueda).
--
-- Se elimina la FK a pacientes; la integridad se mantiene a nivel aplicación.
-- =============================================================================

-- Eliminar FK para poder cambiar el tipo de columna
ALTER TABLE archivos_paciente DROP CONSTRAINT IF EXISTS archivos_paciente_paciente_id_fkey;

-- Cambiar UUID a TEXT para almacenar valor cifrado (encv1d:...)
ALTER TABLE archivos_paciente ALTER COLUMN paciente_id TYPE TEXT USING paciente_id::text;

COMMENT ON COLUMN archivos_paciente.paciente_id IS 'ID del paciente (cifrado si DATA_ENCRYPTION_KEY está definida; texto plano si no)';

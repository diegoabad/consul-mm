-- Permitir almacenar datos cifrados (más largos que VARCHAR). Si usás DATA_ENCRYPTION_KEY, los valores se guardan cifrados.
-- Pacientes: campos sensibles pasan a TEXT para soportar el prefijo + base64 del cifrado.
ALTER TABLE pacientes ALTER COLUMN dni TYPE TEXT USING dni::TEXT;
ALTER TABLE pacientes ALTER COLUMN nombre TYPE TEXT USING nombre::TEXT;
ALTER TABLE pacientes ALTER COLUMN apellido TYPE TEXT USING apellido::TEXT;
ALTER TABLE pacientes ALTER COLUMN fecha_nacimiento TYPE TEXT USING fecha_nacimiento::TEXT;
ALTER TABLE pacientes ALTER COLUMN telefono TYPE TEXT USING telefono::TEXT;
ALTER TABLE pacientes ALTER COLUMN email TYPE TEXT USING email::TEXT;
ALTER TABLE pacientes ALTER COLUMN direccion TYPE TEXT USING direccion::TEXT;
ALTER TABLE pacientes ALTER COLUMN obra_social TYPE TEXT USING obra_social::TEXT;
ALTER TABLE pacientes ALTER COLUMN numero_afiliado TYPE TEXT USING numero_afiliado::TEXT;
ALTER TABLE pacientes ALTER COLUMN contacto_emergencia_nombre TYPE TEXT USING contacto_emergencia_nombre::TEXT;
ALTER TABLE pacientes ALTER COLUMN contacto_emergencia_telefono TYPE TEXT USING contacto_emergencia_telefono::TEXT;
-- plan puede existir por migración 017
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pacientes' AND column_name = 'plan') THEN
    ALTER TABLE pacientes ALTER COLUMN plan TYPE TEXT USING plan::TEXT;
  END IF;
END $$;

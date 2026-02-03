-- Seed de especialidades médicas (ejecutar después de schema.sql)
-- Inserta especialidades por defecto si no existen
INSERT INTO especialidades (nombre, descripcion, activo)
VALUES
  ('Cardiología', NULL, true),
  ('Clínica Médica', NULL, true),
  ('Traumatología', NULL, true),
  ('Psicología', NULL, true),
  ('Pediatría', NULL, true),
  ('Ginecología', NULL, true),
  ('Dermatología', NULL, true),
  ('Neurología', NULL, true),
  ('Oftalmología', NULL, true),
  ('Otorrinolaringología', NULL, true)
ON CONFLICT (nombre) DO NOTHING;

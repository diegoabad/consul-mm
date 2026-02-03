-- Seed de obras sociales (ejecutar después de schema.sql)
INSERT INTO obras_sociales (nombre, codigo, descripcion, activo)
VALUES
  ('OSDE', NULL, NULL, true),
  ('Swiss Medical', NULL, NULL, true),
  ('Medicus', NULL, NULL, true),
  ('Prevención Salud', NULL, NULL, true),
  ('Obra Social del Personal de la Industria', NULL, NULL, true)
ON CONFLICT (nombre) DO NOTHING;

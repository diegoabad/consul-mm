-- Campo opcional plan en pacientes (ej. plan de la obra social)
ALTER TABLE pacientes ADD COLUMN IF NOT EXISTS plan VARCHAR(100);

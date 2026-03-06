-- Eliminar columnas de búsqueda (dni_hash, nombre_search, apellido_search).
-- Ya no se usan: dni, nombre, apellido están en texto plano para búsqueda directa.
ALTER TABLE pacientes DROP COLUMN IF EXISTS dni_hash;
ALTER TABLE pacientes DROP COLUMN IF EXISTS nombre_search;
ALTER TABLE pacientes DROP COLUMN IF EXISTS apellido_search;

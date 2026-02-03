-- ACTIVATE_USERS.SQL - Script para activar usuarios existentes
-- Ejecutar: psql -U postgres -d consultorio -f database/activate_users.sql
-- 
-- Este script activa todos los usuarios que están inactivos
-- Útil si los usuarios fueron creados directamente en la BD o desactivados

-- Activar todos los usuarios inactivos
UPDATE usuarios 
SET activo = true 
WHERE activo = false OR activo IS NULL;

-- Verificar usuarios activos
SELECT id, email, rol, activo 
FROM usuarios 
ORDER BY fecha_creacion DESC;

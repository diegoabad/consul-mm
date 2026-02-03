-- Crear tablas especialidades y obras_sociales si no existen
-- (por si la BD se creó con una versión anterior del schema)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabla especialidades
CREATE TABLE IF NOT EXISTS especialidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_especialidades_nombre ON especialidades(nombre);
CREATE INDEX IF NOT EXISTS idx_especialidades_activo ON especialidades(activo);
DROP TRIGGER IF EXISTS trigger_actualizar_especialidades ON especialidades;
CREATE TRIGGER trigger_actualizar_especialidades
  BEFORE UPDATE ON especialidades FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- Tabla obras_sociales
CREATE TABLE IF NOT EXISTS obras_sociales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    codigo VARCHAR(50),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_obras_sociales_nombre ON obras_sociales(nombre);
CREATE INDEX IF NOT EXISTS idx_obras_sociales_activo ON obras_sociales(activo);
DROP TRIGGER IF EXISTS trigger_actualizar_obras_sociales ON obras_sociales;
CREATE TRIGGER trigger_actualizar_obras_sociales
  BEFORE UPDATE ON obras_sociales FOR EACH ROW
  EXECUTE FUNCTION actualizar_fecha_actualizacion();

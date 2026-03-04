-- Foro Profesional: tablas para temas y posts
-- Temas creados solo por admin. Usuarios responden en temas existentes.
-- Texto plano, sin links externos, sin imágenes en posts.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla: foro_tema
CREATE TABLE IF NOT EXISTS foro_tema (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    titulo VARCHAR(255) NOT NULL,
    descripcion TEXT,
    imagen_url VARCHAR(500),
    creado_por UUID NOT NULL REFERENCES usuarios(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT true,
    orden INTEGER DEFAULT 0,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foro_tema_activo ON foro_tema(activo);
CREATE INDEX IF NOT EXISTS idx_foro_tema_orden ON foro_tema(orden);

-- Tabla: foro_post
CREATE TABLE IF NOT EXISTS foro_post (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tema_id UUID NOT NULL REFERENCES foro_tema(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    moderado BOOLEAN DEFAULT false,
    fecha_creacion TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_foro_post_tema_id ON foro_post(tema_id);
CREATE INDEX IF NOT EXISTS idx_foro_post_usuario_id ON foro_post(usuario_id);

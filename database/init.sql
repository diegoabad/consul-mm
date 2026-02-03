-- INIT.SQL - Script para inicializar la base de datos
-- Ejecutar: psql -U postgres -f database/init.sql

-- Crear base de datos si no existe
SELECT 'CREATE DATABASE consultorio'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'consultorio')\gexec

-- Conectar a la base de datos
\c consultorio

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS usuarios (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol VARCHAR(50) NOT NULL,
    activo BOOLEAN DEFAULT true,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de permisos_usuario
CREATE TABLE IF NOT EXISTS permisos_usuario (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso VARCHAR(100) NOT NULL,
    permitido BOOLEAN NOT NULL DEFAULT true,
    creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(usuario_id, permiso)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);
CREATE INDEX IF NOT EXISTS idx_permisos_usuario_id ON permisos_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_permiso ON permisos_usuario(permiso);

-- ============================================
-- BASE DE DATOS: PLATAFORMA CONSULTORIOS MÉDICOS
-- ============================================
-- SCHEMA.SQL - Script para crear las tablas (asumiendo que la BD ya existe)
-- Ejecutar: psql -U postgres -d consultorio -f database/schema.sql

-- Crear extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. TABLA: usuarios
-- ============================================
CREATE TABLE IF NOT EXISTS usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    rol VARCHAR(20) NOT NULL CHECK (rol IN ('administrador', 'profesional', 'secretaria')),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email);
CREATE INDEX IF NOT EXISTS idx_usuarios_rol ON usuarios(rol);
CREATE INDEX IF NOT EXISTS idx_usuarios_activo ON usuarios(activo);

-- ============================================
-- 2. TABLA: permisos_usuario
-- ============================================
CREATE TABLE IF NOT EXISTS permisos_usuario (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    permiso VARCHAR(100) NOT NULL,
    activo BOOLEAN DEFAULT true,
    fecha_asignacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(usuario_id, permiso)
);

-- Índices para permisos_usuario
CREATE INDEX IF NOT EXISTS idx_permisos_usuario_usuario_id ON permisos_usuario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_permisos_usuario_activo ON permisos_usuario(activo);

-- ============================================
-- 3. TABLA: profesionales
-- ============================================
CREATE TABLE IF NOT EXISTS profesionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID UNIQUE NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    matricula VARCHAR(50) UNIQUE,
    especialidad VARCHAR(100),
    estado_pago VARCHAR(20) DEFAULT 'al_dia' CHECK (estado_pago IN ('al_dia', 'pendiente', 'moroso')),
    bloqueado BOOLEAN DEFAULT false,
    razon_bloqueo TEXT,
    fecha_ultimo_pago DATE,
    monto_mensual DECIMAL(10, 2),
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para profesionales
CREATE INDEX IF NOT EXISTS idx_profesionales_usuario_id ON profesionales(usuario_id);
CREATE INDEX IF NOT EXISTS idx_profesionales_matricula ON profesionales(matricula);
CREATE INDEX IF NOT EXISTS idx_profesionales_estado_pago ON profesionales(estado_pago);
CREATE INDEX IF NOT EXISTS idx_profesionales_bloqueado ON profesionales(bloqueado);

-- ============================================
-- 4. TABLA: pacientes
-- ============================================
CREATE TABLE IF NOT EXISTS pacientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dni VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    email VARCHAR(255),
    direccion TEXT,
    obra_social VARCHAR(100),
    numero_afiliado VARCHAR(50),
    contacto_emergencia_nombre VARCHAR(100),
    contacto_emergencia_telefono VARCHAR(20),
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para pacientes
CREATE INDEX IF NOT EXISTS idx_pacientes_dni ON pacientes(dni);
CREATE INDEX IF NOT EXISTS idx_pacientes_nombre_apellido ON pacientes(nombre, apellido);
CREATE INDEX IF NOT EXISTS idx_pacientes_activo ON pacientes(activo);

-- ============================================
-- 5. TABLA: notas_paciente
-- ============================================
CREATE TABLE IF NOT EXISTS notas_paciente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    contenido TEXT NOT NULL,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para notas_paciente
CREATE INDEX IF NOT EXISTS idx_notas_paciente_paciente_id ON notas_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_notas_paciente_usuario_id ON notas_paciente(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notas_paciente_fecha_creacion ON notas_paciente(fecha_creacion DESC);

-- ============================================
-- 6. TABLA: turnos
-- ============================================
CREATE TABLE IF NOT EXISTS turnos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    fecha_hora_inicio TIMESTAMP NOT NULL,
    fecha_hora_fin TIMESTAMP NOT NULL,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('confirmado', 'pendiente', 'cancelado', 'completado', 'ausente')),
    motivo TEXT,
    observaciones TEXT,
    cancelado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL,
    razon_cancelacion TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para turnos
CREATE INDEX IF NOT EXISTS idx_turnos_profesional_id ON turnos(profesional_id);
CREATE INDEX IF NOT EXISTS idx_turnos_paciente_id ON turnos(paciente_id);
CREATE INDEX IF NOT EXISTS idx_turnos_fecha_hora_inicio ON turnos(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_turnos_estado ON turnos(estado);
CREATE INDEX IF NOT EXISTS idx_turnos_profesional_fecha ON turnos(profesional_id, fecha_hora_inicio);

-- ============================================
-- 7. TABLA: evoluciones_clinicas
-- ============================================
CREATE TABLE IF NOT EXISTS evoluciones_clinicas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    turno_id UUID REFERENCES turnos(id) ON DELETE SET NULL,
    fecha_consulta TIMESTAMP NOT NULL,
    motivo_consulta TEXT,
    diagnostico TEXT,
    tratamiento TEXT,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para evoluciones_clinicas
CREATE INDEX IF NOT EXISTS idx_evoluciones_paciente_id ON evoluciones_clinicas(paciente_id);
CREATE INDEX IF NOT EXISTS idx_evoluciones_profesional_id ON evoluciones_clinicas(profesional_id);
CREATE INDEX IF NOT EXISTS idx_evoluciones_turno_id ON evoluciones_clinicas(turno_id);
CREATE INDEX IF NOT EXISTS idx_evoluciones_fecha_consulta ON evoluciones_clinicas(fecha_consulta DESC);

-- ============================================
-- 8. TABLA: archivos_paciente
-- ============================================
CREATE TABLE IF NOT EXISTS archivos_paciente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    paciente_id UUID NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    nombre_archivo VARCHAR(255) NOT NULL,
    tipo_archivo VARCHAR(100),
    url_archivo TEXT NOT NULL,
    tamanio_bytes BIGINT,
    descripcion TEXT,
    fecha_subida TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para archivos_paciente
CREATE INDEX IF NOT EXISTS idx_archivos_paciente_id ON archivos_paciente(paciente_id);
CREATE INDEX IF NOT EXISTS idx_archivos_profesional_id ON archivos_paciente(profesional_id);
CREATE INDEX IF NOT EXISTS idx_archivos_fecha_subida ON archivos_paciente(fecha_subida DESC);

-- ============================================
-- 9. TABLA: configuracion_agenda
-- ============================================
CREATE TABLE IF NOT EXISTS configuracion_agenda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    dia_semana INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_turno_minutos INTEGER DEFAULT 30,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(profesional_id, dia_semana, hora_inicio)
);

-- Índices para configuracion_agenda
CREATE INDEX IF NOT EXISTS idx_config_agenda_profesional_id ON configuracion_agenda(profesional_id);
CREATE INDEX IF NOT EXISTS idx_config_agenda_dia_semana ON configuracion_agenda(dia_semana);
CREATE INDEX IF NOT EXISTS idx_config_agenda_activo ON configuracion_agenda(activo);

-- ============================================
-- 10. TABLA: bloques_no_disponibles
-- ============================================
CREATE TABLE IF NOT EXISTS bloques_no_disponibles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    fecha_hora_inicio TIMESTAMP NOT NULL,
    fecha_hora_fin TIMESTAMP NOT NULL,
    motivo VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para bloques_no_disponibles
CREATE INDEX IF NOT EXISTS idx_bloques_profesional_id ON bloques_no_disponibles(profesional_id);
CREATE INDEX IF NOT EXISTS idx_bloques_fecha_inicio ON bloques_no_disponibles(fecha_hora_inicio);
CREATE INDEX IF NOT EXISTS idx_bloques_fecha_fin ON bloques_no_disponibles(fecha_hora_fin);

-- ============================================
-- 10.1 TABLA: excepciones_agenda
-- ============================================
CREATE TABLE IF NOT EXISTS excepciones_agenda (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    duracion_turno_minutos INTEGER DEFAULT 30,
    observaciones VARCHAR(255),
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(profesional_id, fecha, hora_inicio)
);

CREATE INDEX IF NOT EXISTS idx_excepciones_agenda_profesional_id ON excepciones_agenda(profesional_id);
CREATE INDEX IF NOT EXISTS idx_excepciones_agenda_fecha ON excepciones_agenda(fecha);

-- ============================================
-- 11. TABLA: pagos_profesionales
-- ============================================
CREATE TABLE IF NOT EXISTS pagos_profesionales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profesional_id UUID NOT NULL REFERENCES profesionales(id) ON DELETE CASCADE,
    periodo DATE NOT NULL,
    monto DECIMAL(10, 2) NOT NULL,
    fecha_pago TIMESTAMP,
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'vencido')),
    metodo_pago VARCHAR(50),
    comprobante_url TEXT,
    observaciones TEXT,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    UNIQUE(profesional_id, periodo)
);

-- Índices para pagos_profesionales
CREATE INDEX IF NOT EXISTS idx_pagos_profesional_id ON pagos_profesionales(profesional_id);
CREATE INDEX IF NOT EXISTS idx_pagos_periodo ON pagos_profesionales(periodo);
CREATE INDEX IF NOT EXISTS idx_pagos_estado ON pagos_profesionales(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_fecha_pago ON pagos_profesionales(fecha_pago);

-- ============================================
-- 12. TABLA: notificaciones_email
-- ============================================
CREATE TABLE IF NOT EXISTS notificaciones_email (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    destinatario_email VARCHAR(255) NOT NULL,
    asunto VARCHAR(255) NOT NULL,
    contenido TEXT NOT NULL,
    tipo VARCHAR(50),
    estado VARCHAR(20) DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'enviado', 'fallido')),
    error_mensaje TEXT,
    relacionado_tipo VARCHAR(50),
    relacionado_id UUID,
    fecha_envio TIMESTAMP,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para notificaciones_email
CREATE INDEX IF NOT EXISTS idx_notificaciones_destinatario ON notificaciones_email(destinatario_email);
CREATE INDEX IF NOT EXISTS idx_notificaciones_estado ON notificaciones_email(estado);
CREATE INDEX IF NOT EXISTS idx_notificaciones_tipo ON notificaciones_email(tipo);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha_creacion ON notificaciones_email(fecha_creacion DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_relacionado ON notificaciones_email(relacionado_tipo, relacionado_id);

-- ============================================
-- TRIGGERS PARA ACTUALIZAR fecha_actualizacion
-- ============================================

-- Función genérica para actualizar fecha_actualizacion
CREATE OR REPLACE FUNCTION actualizar_fecha_actualizacion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.fecha_actualizacion = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a todas las tablas relevantes
DROP TRIGGER IF EXISTS trigger_actualizar_usuarios ON usuarios;
CREATE TRIGGER trigger_actualizar_usuarios
    BEFORE UPDATE ON usuarios
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_profesionales ON profesionales;
CREATE TRIGGER trigger_actualizar_profesionales
    BEFORE UPDATE ON profesionales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_pacientes ON pacientes;
CREATE TRIGGER trigger_actualizar_pacientes
    BEFORE UPDATE ON pacientes
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_notas ON notas_paciente;
CREATE TRIGGER trigger_actualizar_notas
    BEFORE UPDATE ON notas_paciente
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_evoluciones ON evoluciones_clinicas;
CREATE TRIGGER trigger_actualizar_evoluciones
    BEFORE UPDATE ON evoluciones_clinicas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_archivos ON archivos_paciente;
CREATE TRIGGER trigger_actualizar_archivos
    BEFORE UPDATE ON archivos_paciente
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_turnos ON turnos;
CREATE TRIGGER trigger_actualizar_turnos
    BEFORE UPDATE ON turnos
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_config_agenda ON configuracion_agenda;
CREATE TRIGGER trigger_actualizar_config_agenda
    BEFORE UPDATE ON configuracion_agenda
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_bloques ON bloques_no_disponibles;
CREATE TRIGGER trigger_actualizar_bloques
    BEFORE UPDATE ON bloques_no_disponibles
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_excepciones_agenda ON excepciones_agenda;
CREATE TRIGGER trigger_actualizar_excepciones_agenda
    BEFORE UPDATE ON excepciones_agenda
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_pagos ON pagos_profesionales;
CREATE TRIGGER trigger_actualizar_pagos
    BEFORE UPDATE ON pagos_profesionales
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

DROP TRIGGER IF EXISTS trigger_actualizar_notificaciones ON notificaciones_email;
CREATE TRIGGER trigger_actualizar_notificaciones
    BEFORE UPDATE ON notificaciones_email
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- ============================================
-- COMENTARIOS EN LAS TABLAS
-- ============================================

COMMENT ON TABLE usuarios IS 'Almacena todos los usuarios del sistema con autenticación';
COMMENT ON TABLE permisos_usuario IS 'Permisos especiales asignados a usuarios específicos';
COMMENT ON TABLE profesionales IS 'Información extendida de los profesionales médicos';
COMMENT ON TABLE pacientes IS 'Datos personales y de contacto de los pacientes';
COMMENT ON TABLE notas_paciente IS 'Notas administrativas sobre pacientes';
COMMENT ON TABLE evoluciones_clinicas IS 'Historial clínico y evoluciones de los pacientes';
COMMENT ON TABLE archivos_paciente IS 'Archivos adjuntos de pacientes (estudios, imágenes, etc)';
COMMENT ON TABLE turnos IS 'Gestión de citas médicas';
COMMENT ON TABLE configuracion_agenda IS 'Configuración de horarios de trabajo por profesional';
COMMENT ON TABLE bloques_no_disponibles IS 'Bloqueos de agenda (vacaciones, ausencias, etc)';
COMMENT ON TABLE excepciones_agenda IS 'Excepciones de agenda: días puntuales en que el profesional atiende (además o en lugar de su agenda semanal)';
COMMENT ON TABLE pagos_profesionales IS 'Registro de pagos mensuales de profesionales';
COMMENT ON TABLE notificaciones_email IS 'Log de notificaciones por email enviadas';

-- ============================================
-- 13. TABLA: especialidades
-- ============================================
CREATE TABLE IF NOT EXISTS especialidades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para especialidades
CREATE INDEX IF NOT EXISTS idx_especialidades_nombre ON especialidades(nombre);
CREATE INDEX IF NOT EXISTS idx_especialidades_activo ON especialidades(activo);

-- ============================================
-- 14. TABLA: obras_sociales
-- ============================================
CREATE TABLE IF NOT EXISTS obras_sociales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre VARCHAR(100) UNIQUE NOT NULL,
    codigo VARCHAR(50),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    fecha_creacion TIMESTAMP DEFAULT NOW(),
    fecha_actualizacion TIMESTAMP DEFAULT NOW()
);

-- Índices para obras_sociales
CREATE INDEX IF NOT EXISTS idx_obras_sociales_nombre ON obras_sociales(nombre);
CREATE INDEX IF NOT EXISTS idx_obras_sociales_activo ON obras_sociales(activo);

-- Triggers para actualizar fecha_actualizacion
CREATE TRIGGER trigger_actualizar_especialidades BEFORE UPDATE ON especialidades FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();
CREATE TRIGGER trigger_actualizar_obras_sociales BEFORE UPDATE ON obras_sociales FOR EACH ROW EXECUTE FUNCTION actualizar_fecha_actualizacion();

-- Comentarios
COMMENT ON TABLE especialidades IS 'Especialidades médicas disponibles';
COMMENT ON TABLE obras_sociales IS 'Obras sociales disponibles para pacientes';

-- ============================================
-- FIN DEL SCRIPT
-- ============================================

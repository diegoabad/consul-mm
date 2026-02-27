-- =============================================================================
-- Tabla logs: todos los datos que guardamos
-- =============================================================================
-- origen   : 'front' | 'back' — de dónde proviene el log
-- mensaje  : texto principal (obligatorio) — descripción del error o evento
-- stack    : stack trace del error (opcional)
--
-- FRONT (origen='front'):
--   usuario_id : ID del usuario logueado (si hay sesión)
--   rol        : administrador | profesional | secretaria
--   pantalla   : nombre de la vista (ej. "ObrasSociales", "Logs")
--   accion     : acción que disparó el log (ej. "ver_listado", "0 obras sociales registradas")
--   ruta, metodo, params : null en front
--
-- BACK (origen='back'):
--   ruta   : ruta HTTP (ej. /api/turnos)
--   metodo : GET | POST | PUT | DELETE | etc.
--   params : JSON con query + body (sanitizado)
--   pantalla, accion : null en back
--
-- Orígenes: errorHandler.middleware, turnos.controller (email fallido),
--           POST /api/logs (frontend), scripts/create-test-log.js
-- =============================================================================

CREATE TABLE IF NOT EXISTS logs (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  origen VARCHAR(10) NOT NULL CHECK (origen IN ('front', 'back')),

  -- Front: usuario logueado, pantalla, acción
  usuario_id UUID NULL REFERENCES usuarios(id) ON DELETE SET NULL,
  rol VARCHAR(20) NULL,
  pantalla VARCHAR(500) NULL,
  accion VARCHAR(255) NULL,

  -- Back: ruta, método, parámetros
  ruta VARCHAR(500) NULL,
  metodo VARCHAR(10) NULL,
  params TEXT NULL,

  -- Común: mensaje y stack
  mensaje TEXT NOT NULL,
  stack TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_logs_origen ON logs(origen);
CREATE INDEX IF NOT EXISTS idx_logs_usuario_id ON logs(usuario_id) WHERE usuario_id IS NOT NULL;

COMMENT ON TABLE logs IS 'Errores y eventos capturados desde frontend y backend. Ver log.model.js para documentación completa de los campos.';

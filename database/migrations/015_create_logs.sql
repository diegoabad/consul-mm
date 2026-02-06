-- Tabla única de logs: errores de front y back diferenciados por columna origen
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

COMMENT ON TABLE logs IS 'Errores capturados desde el frontend (React) y desde el backend (API), diferenciados por columna origen';

-- Índices compuestos para optimizar consultas del foro
CREATE INDEX IF NOT EXISTS idx_foro_post_tema_parent ON foro_post(tema_id, parent_id);

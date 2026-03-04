-- Permitir responder a una respuesta específica
ALTER TABLE foro_post ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES foro_post(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_foro_post_parent_id ON foro_post(parent_id);

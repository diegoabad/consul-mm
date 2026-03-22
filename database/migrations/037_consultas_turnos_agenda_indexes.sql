-- Índices adicionales alineados con consultas frecuentes (turnos, excepciones, bloques, agenda, recordatorios).
-- Idempotente: IF NOT EXISTS / DROP IF EXISTS.

-- Si se aplicó 036 con índice duplicado sobre profesional_id (010 ya crea idx_paciente_profesional_profesional)
DROP INDEX IF EXISTS idx_paciente_profesional_profesional_id;

-- Pantalla Turnos: profesional + rango de fechas + excluir borrados lógicos (findAllPaginated, findAll)
CREATE INDEX IF NOT EXISTS idx_turnos_prof_fecha_vivos
  ON turnos (profesional_id, fecha_hora_inicio DESC)
  WHERE deleted_at IS NULL;

-- Excepciones por profesional y rango de fechas (findByProfesionalAndDateRange, calendario)
CREATE INDEX IF NOT EXISTS idx_excepciones_profesional_fecha
  ON excepciones_agenda (profesional_id, fecha);

-- Bloques por profesional y solapamiento temporal (findByProfesional con rango)
CREATE INDEX IF NOT EXISTS idx_bloques_profesional_fecha_inicio
  ON bloques_no_disponibles (profesional_id, fecha_hora_inicio DESC);

-- Carga de agenda por profesional y activo (findByProfesional, listados)
CREATE INDEX IF NOT EXISTS idx_config_agenda_profesional_activo
  ON configuracion_agenda (profesional_id, activo);

-- Cron recordatorios WhatsApp (findParaRecordatorio): reduce escaneo de turnos no enviados
CREATE INDEX IF NOT EXISTS idx_turnos_recordatorio_pendiente
  ON turnos (fecha_hora_inicio)
  WHERE deleted_at IS NULL
    AND recordatorio_enviado = false
    AND recordatorio_intentos < 3
    AND estado IN ('pendiente', 'confirmado');

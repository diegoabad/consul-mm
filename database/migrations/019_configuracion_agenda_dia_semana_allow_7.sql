-- Permitir dia_semana = 7 en configuracion_agenda para el placeholder "sin días fijos"
-- (el profesional tiene agenda desde una fecha pero sin horarios por día; usa Habilitar en Turnos para agregar fechas).
-- Antes: CHECK (dia_semana >= 0 AND dia_semana <= 6). Sin este cambio, insertar dia_semana = 7 falla.

ALTER TABLE configuracion_agenda
  DROP CONSTRAINT IF EXISTS configuracion_agenda_dia_semana_check;

ALTER TABLE configuracion_agenda
  ADD CONSTRAINT configuracion_agenda_dia_semana_check
  CHECK (dia_semana >= 0 AND dia_semana <= 7);

COMMENT ON COLUMN configuracion_agenda.dia_semana IS '0=Dom, 1=Lu, ..., 6=Sa. 7=placeholder sin días fijos (no genera slots por día).';

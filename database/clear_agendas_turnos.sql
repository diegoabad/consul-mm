-- Borrar todos los turnos y datos de agendas.
-- Las evoluciones_clinicas que referencian turnos quedarán con turno_id = NULL.

DELETE FROM turnos;
DELETE FROM configuracion_agenda;
DELETE FROM excepciones_agenda;
DELETE FROM bloques_no_disponibles;

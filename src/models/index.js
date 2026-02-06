/**
 * INDEX.JS - Exporta todos los modelos
 * 
 * Este archivo centraliza la exportación de todos los modelos
 * para facilitar su importación en otras partes de la aplicación.
 * 
 * IMPORTA:
 * - Todos los modelos individuales
 * 
 * EXPORTA:
 * - Objeto con todos los modelos exportados
 * 
 * ESTRUCTURA:
 * 1. Importar todos los modelos
 * 2. Exportar objeto con todos los modelos
 */

const usuarioModel = require('./usuario.model');
const profesionalModel = require('./profesional.model');
const permisoModel = require('./permiso.model');
const pacienteModel = require('./paciente.model');
const turnoModel = require('./turno.model');
const agendaModel = require('./agenda.model');
const excepcionAgendaModel = require('./excepcionAgenda.model');
const bloqueModel = require('./bloque.model');
const evolucionModel = require('./evolucion.model');
const archivoModel = require('./archivo.model');
const notaModel = require('./nota.model');
const pagoModel = require('./pago.model');
const notificacionModel = require('./notificacion.model');
const logModel = require('./log.model');

module.exports = {
  usuarioModel,
  profesionalModel,
  permisoModel,
  pacienteModel,
  turnoModel,
  agendaModel,
  excepcionAgendaModel,
  bloqueModel,
  evolucionModel,
  archivoModel,
  notaModel,
  pagoModel,
  notificacionModel,
  logModel
};

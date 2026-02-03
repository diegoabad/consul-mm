/**
 * RESPONSE.JS - Utilidades para construir respuestas estándar
 * 
 * Este archivo contiene funciones para construir respuestas consistentes en toda la API.
 */

/**
 * Construir respuesta estándar
 * @param {boolean} success - Indica si la operación fue exitosa
 * @param {any} data - Datos a retornar (opcional)
 * @param {string} message - Mensaje descriptivo (opcional)
 * @param {any} error - Información de error (opcional)
 * @returns {object} Objeto de respuesta estándar
 */
const buildResponse = (success, data = null, message = '', error = null) => {
  const response = {
    success,
    ...(data !== null && { data }),
    ...(message && { message }),
    ...(error && { error })
  };
  return response;
};

module.exports = {
  buildResponse
};

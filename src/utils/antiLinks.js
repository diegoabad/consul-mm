/**
 * Validación anti-links: detecta URLs en texto plano
 * Los posts del foro no permiten links externos
 */

const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+|\.(com|org|net|ar|es|io|co)[^\s]*/i;

/**
 * Verifica si el texto contiene URLs o dominios
 * @param {string} texto
 * @returns {{ valido: boolean, mensaje?: string }}
 */
function validarSinLinks(texto) {
  if (!texto || typeof texto !== 'string') {
    return { valido: true };
  }
  const trimmed = texto.trim();
  if (!trimmed) return { valido: true };

  if (URL_PATTERN.test(trimmed)) {
    return {
      valido: false,
      mensaje: 'No se permiten enlaces externos en el contenido'
    };
  }
  return { valido: true };
}

module.exports = { validarSinLinks };

/**
 * Configuración de conexión a PostgreSQL.
 * Todo se lee de variables de entorno (.env). Soporta:
 * - DATABASE_URL (ej. Render, Azure) o
 * - DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
 * Los valores por defecto (localhost, 5432, consultorio, postgres) solo se usan si la variable no está definida.
 */
function getDbConfig() {
  const url = process.env.DATABASE_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        host: parsed.hostname,
        port: parseInt(parsed.port || '5432', 10),
        database: parsed.pathname.slice(1).replace(/\/.*$/, ''),
        user: decodeURIComponent(parsed.username),
        password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
        ssl: process.env.DATABASE_SSL !== 'false' && (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1')
          ? { rejectUnauthorized: false }
          : false
      };
    } catch (e) {
      throw new Error('DATABASE_URL inválida: ' + e.message);
    }
  }
  const host = process.env.DB_HOST || 'localhost';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  // Azure PostgreSQL y otros servicios en la nube requieren SSL. Si DB_SSL=false, se desactiva.
  const useSsl = process.env.DB_SSL !== 'false' && !isLocal;
  return {
    host,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'consultorio',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    ...(useSsl && {
      ssl: { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' }
    })
  };
}

module.exports = { getDbConfig };

/**
 * Configuración de conexión a PostgreSQL.
 * Soporta DATABASE_URL (ej. Render) o variables DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD.
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
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME || 'consultorio',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
  };
}

module.exports = { getDbConfig };

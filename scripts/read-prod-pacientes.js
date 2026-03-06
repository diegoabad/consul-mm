/**
 * Conecta a la DB y lee la tabla pacientes (solo lectura, no modifica nada).
 * Para conectar a producción, pasá DATABASE_URL o PROD_DATABASE_URL:
 *
 *   PROD_DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/read-prod-pacientes.js
 *
 * O definí PROD_DATABASE_URL en .env (sin tocar el resto).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

const connStr = process.env.PROD_DATABASE_URL || process.env.DATABASE_URL;
const useProd = !!connStr;

const config = useProd
  ? { connectionString: connStr, ssl: connStr.includes('sslmode=require') ? { rejectUnauthorized: true } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'consultorio',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD
    };

async function run() {
  const pool = new Pool(config);
  console.log('Conectando a:', useProd ? connStr.replace(/:[^:@]+@/, ':****@') : `${config.host}:${config.port}/${config.database}`);

  try {
    const res = await pool.query(
      `SELECT id, dni, nombre, apellido, fecha_nacimiento, telefono, email, activo, fecha_creacion
       FROM pacientes
       ORDER BY fecha_creacion DESC
       LIMIT 20`
    );
    console.log('\n✓ Conexión exitosa. Primeros', res.rows.length, 'pacientes:\n');
    console.table(res.rows.map((r) => ({
      id: r.id?.slice(0, 8) + '...',
      dni: r.dni?.slice?.(0, 15) || r.dni,
      nombre: r.nombre?.slice?.(0, 20) || r.nombre,
      apellido: r.apellido?.slice?.(0, 20) || r.apellido,
      activo: r.activo
    })));
    const count = await pool.query('SELECT COUNT(*)::int as n FROM pacientes');
    console.log('\nTotal de pacientes en la tabla:', count.rows[0].n);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

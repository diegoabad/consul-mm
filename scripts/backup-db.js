/**
 * Backup completo de la base de datos (schema + datos).
 * Solo lectura, no modifica la DB.
 *
 * Uso con DB de producción:
 *   PROD_DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" node scripts/backup-db.js
 *
 * O con .env local: node scripts/backup-db.js
 *
 * Genera: backup_YYYYMMDD_HHmmss.sql en api/backups/
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

const BACKUP_DIR = path.join(__dirname, '../backups');

async function run() {
  const pool = new Pool(config);
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15);
  const filename = `backup_${timestamp}.sql`;
  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  console.log('Conectando a:', useProd ? connStr.replace(/:[^:@]+@/, ':****@') : `${config.host}:${config.port}/${config.database}`);
  console.log('Generando backup...\n');

  let sql = `-- Backup generado: ${new Date().toISOString()}\n`;
  sql += `-- Conexión: ${useProd ? 'producción' : 'local'}\n\n`;

  try {
    const tables = await pool.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    for (const { tablename } of tables.rows) {
      const cols = await pool.query(`
        SELECT column_name, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tablename]);

      const colNames = cols.rows.map((c) => c.column_name).join(', ');
      const res = await pool.query(`SELECT * FROM "${tablename}"`);
      sql += `-- Tabla: ${tablename} (${res.rows.length} filas)\n`;

      for (const row of res.rows) {
        const values = cols.rows.map((c) => {
          const v = row[c.column_name];
          if (v === null) return 'NULL';
          if (typeof v === 'boolean') return v ? 'true' : 'false';
          if (typeof v === 'number') return String(v);
          if (v instanceof Date) return `'${v.toISOString()}'`;
          return `'${String(v).replace(/'/g, "''")}'`;
        });
        sql += `INSERT INTO "${tablename}" (${colNames}) VALUES (${values.join(', ')});\n`;
      }
      sql += '\n';
      console.log(`  ${tablename}: ${res.rows.length} filas`);
    }

    fs.writeFileSync(filepath, sql, 'utf8');
    const size = (fs.statSync(filepath).size / 1024).toFixed(1);
    console.log(`\n✓ Backup guardado: ${filepath} (${size} KB)`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();

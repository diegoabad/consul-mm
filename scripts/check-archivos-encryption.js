/**
 * Verifica si archivos_paciente está listo para encriptación (migración 022, tipo columna).
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const col = await pool.query(
      `SELECT column_name, data_type FROM information_schema.columns 
       WHERE table_name = 'archivos_paciente' AND column_name = 'paciente_id'`
    );
    const mig = await pool.query(
      `SELECT version FROM schema_migrations WHERE version = '022_archivos_paciente_encrypt_paciente_id'`
    );
    console.log('\n=== Estado encriptación archivos_paciente ===\n');
    console.log('Columna paciente_id:', col.rows[0] ? `${col.rows[0].data_type}` : 'no encontrada');
    console.log('Migración 022 aplicada:', mig.rows.length > 0 ? 'SÍ' : 'NO');
    if (col.rows[0] && col.rows[0].data_type === 'uuid') {
      console.log('\n⚠️  paciente_id sigue siendo UUID. Ejecutá el bootstrap/migraciones para aplicar 022.');
    } else if (col.rows[0] && col.rows[0].data_type === 'text') {
      console.log('\n✓ Listo para encriptar paciente_id (columna TEXT).');
    }
    console.log('');
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

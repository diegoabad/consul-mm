/**
 * Configura la base de datos remota (ej. Render): ejecuta schema + migraciones.
 * La base de datos ya debe existir (Render la crea al crear el servicio).
 *
 * Requiere .env con DATABASE_URL (o DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD).
 * Ejecutar desde la carpeta api: npm run setup-remote
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDbConfig } = require('../src/config/db-config');

const pool = new Pool(getDbConfig());

async function runSqlFile(client, filePath, label) {
  if (!fs.existsSync(filePath)) {
    console.log(`⏭️  ${label}: archivo no encontrado, omitiendo.`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  console.log(`✅ ${label}`);
}

async function run() {
  const client = await pool.connect();
  const base = path.join(__dirname, '../database');
  const migrations = path.join(base, 'migrations');

  try {
    console.log('🔧 Configurando base de datos remota...\n');

    const tableCheck = await client.query(`
      SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usuarios' LIMIT 1
    `);
    const schemaAlreadyApplied = tableCheck.rows.length > 0;

    if (!schemaAlreadyApplied) {
      console.log('📋 Ejecutando schema.sql...');
      await runSqlFile(client, path.join(base, 'schema.sql'), 'Schema aplicado');
    } else {
      console.log('⏭️  Schema ya aplicado, omitiendo.');
    }

    console.log('\n📋 Migraciones:');
    const colCheck = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'notas_paciente' AND column_name IN ('usuario_id', 'profesional_id')
    `);
    const hasProfesionalId = colCheck.rows.some(r => r.column_name === 'profesional_id');
    if (hasProfesionalId) {
      await runSqlFile(client, path.join(migrations, '001_change_notas_to_usuario_id.sql'), '001');
    } else {
      console.log('⏭️  001 omitida (notas_paciente ya usa usuario_id)');
    }
    await runSqlFile(client, path.join(migrations, '002_turnos_estado_ausente.sql'), '002');

    const espObrasPath = path.join(migrations, '005_create_especialidades_obras_tables.sql');
    if (fs.existsSync(espObrasPath)) {
      await client.query(fs.readFileSync(espObrasPath, 'utf8'));
      console.log('✅ 005 (especialidades/obras tablas)');
    }
    await runSqlFile(client, path.join(migrations, '003_seed_especialidades.sql'), '003 seed especialidades');
    await runSqlFile(client, path.join(migrations, '004_seed_obras_sociales.sql'), '004 seed obras sociales');

    await runSqlFile(client, path.join(migrations, '006_add_fecha_inicio_contrato_profesionales.sql'), '006');
    await runSqlFile(client, path.join(migrations, '007_add_tipo_periodo_pago_profesionales.sql'), '007');

    console.log('\n🎉 Base de datos remota configurada correctamente.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

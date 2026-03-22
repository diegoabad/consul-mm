/**
 * BOOTSTRAP-DB.JS - Inicialización automática de la base de datos al arrancar
 *
 * Si la DB está vacía o recién creada:
 * 1. Crea la base de datos (solo local, si no existe).
 * 2. Aplica schema.sql.
 * 3. Ejecuta todas las migraciones en orden.
 * 4. Crea el usuario administrador inicial si ADMIN_EMAIL y ADMIN_PASSWORD están definidos.
 *
 * No modifica una DB ya inicializada (usa la tabla schema_migrations).
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { getDbConfig } = require('./db-config');
const logger = require('../utils/logger');

const MIGRATIONS_ORDER = [
  '001_change_notas_to_usuario_id.sql',
  '002_turnos_estado_ausente.sql',
  '005_create_especialidades_obras_tables.sql',
  '003_seed_especialidades.sql',
  '004_seed_obras_sociales.sql',
  '006_add_fecha_inicio_contrato_profesionales.sql',
  '007_add_tipo_periodo_pago_profesionales.sql',
  '008_create_excepciones_agenda.sql',
  '009_add_vigencia_configuracion_agenda.sql',
  '010_paciente_profesional_asignacion_compartido.sql',
  '011_turnos_estado_sobreturno.sql',
  '012_turnos_sobreturno_boolean.sql',
  '013_tipo_periodo_pago_anual.sql',
  '014_profesionales_tipo_periodo_pago_allow_null.sql',
  '015_create_logs.sql',
  '016_archivos_paciente_usuario_id.sql',
  '017_add_plan_pacientes.sql',
  '018_turnos_utc_to_argentina.sql',
  '019_configuracion_agenda_dia_semana_allow_7.sql',
  '020_add_evolucion_anterior_id.sql',
  '021_pacientes_notas_evoluciones_text_for_encryption.sql',
  '022_archivos_paciente_encrypt_paciente_id.sql',
  '023_profesionales_recordatorio_config.sql',
  '024_turnos_recordatorio_enviado.sql',
  '025_turnos_recordatorio_reintentos.sql',
  '026_pacientes_whatsapp.sql',
  '027_pacientes_contacto_emergencia_2.sql',
  '028_pacientes_notificaciones_activas.sql',
  '029_turnos_soft_delete.sql',
  '030_foro_profesional.sql',
  '031_foro_post_parent_id.sql',
  '032_foro_post_indexes.sql',
  '035_drop_pacientes_search_columns.sql',
  '036_listados_performance_indexes.sql',
  '037_consultas_turnos_agenda_indexes.sql',
];

const SALT_ROUNDS = 10;

/**
 * Crea la base de datos si no existe (solo cuando no se usa DATABASE_URL).
 */
async function ensureDatabaseExists() {
  if (process.env.DATABASE_URL) return;
  const dbName = process.env.DB_NAME || 'consultorio';
  const pool = new Pool({
    ...getDbConfig(),
    database: 'postgres',
  });
  const client = await pool.connect();
  try {
    await client.query(`CREATE DATABASE ${dbName}`);
    logger.info(`Base de datos '${dbName}' creada`);
  } catch (e) {
    if (e.code !== '42P04') throw e;
    logger.info(`Base de datos '${dbName}' ya existe`);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Ejecuta un archivo SQL.
 */
async function runSqlFile(client, filePath, label) {
  if (!fs.existsSync(filePath)) {
    logger.warn(`${label}: archivo no encontrado, omitiendo.`);
    return;
  }
  const sql = fs.readFileSync(filePath, 'utf8');
  await client.query(sql);
  logger.info(`Bootstrap: ${label}`);
}

/**
 * ¿La tabla usuarios existe?
 */
async function hasUsuariosTable(client) {
  const r = await client.query(`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'usuarios' LIMIT 1
  `);
  return r.rows.length > 0;
}

/**
 * ¿La migración ya está aplicada?
 */
async function isMigrationApplied(client, version) {
  const r = await client.query(
    'SELECT 1 FROM schema_migrations WHERE version = $1 LIMIT 1',
    [version]
  );
  return r.rows.length > 0;
}

/**
 * Crea el usuario administrador inicial desde env (ADMIN_EMAIL, ADMIN_PASSWORD, opcional ADMIN_NOMBRE, ADMIN_APELLIDO).
 */
async function seedAdminIfConfigured(client) {
  const email = process.env.ADMIN_EMAIL && process.env.ADMIN_EMAIL.trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) return;
  const nombre = (process.env.ADMIN_NOMBRE || 'Administrador').trim();
  const apellido = (process.env.ADMIN_APELLIDO || 'Sistema').trim();

  const existing = await client.query(
    'SELECT id FROM usuarios WHERE email = $1 LIMIT 1',
    [email]
  );
  if (existing.rows.length > 0) {
    logger.info('Bootstrap: usuario admin ya existe, no se crea otro');
    return;
  }

  const password_hash = await bcrypt.hash(password, SALT_ROUNDS);
  await client.query(
    `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol, activo)
     VALUES ($1, $2, $3, $4, 'administrador', true)`,
    [email, password_hash, nombre, apellido]
  );
  logger.info(`Bootstrap: usuario administrador creado (${email})`);
}

/**
 * Bootstrap completo: crear DB si hace falta, schema, migraciones, admin.
 * Si SKIP_BOOTSTRAP=1 no hace nada (útil si las migraciones se corren aparte).
 * Con FORCE_MIGRATIONS_ON_STARTUP=1 se ejecuta igual el bootstrap (verificar y aplicar migraciones pendientes).
 */
async function bootstrap() {
  const skipBootstrap = process.env.SKIP_BOOTSTRAP === '1' || process.env.SKIP_BOOTSTRAP === 'true';
  const forceMigrations = process.env.FORCE_MIGRATIONS_ON_STARTUP === '1' || process.env.FORCE_MIGRATIONS_ON_STARTUP === 'true';
  if (skipBootstrap && !forceMigrations) {
    logger.info('Bootstrap omitido (SKIP_BOOTSTRAP está definido). Para aplicar migraciones al arrancar, definir FORCE_MIGRATIONS_ON_STARTUP=1');
    return;
  }
  if (skipBootstrap && forceMigrations) {
    logger.info('FORCE_MIGRATIONS_ON_STARTUP=1: verificando y aplicando migraciones pendientes al arrancar.');
  }
  try {
    await ensureDatabaseExists();
  } catch (e) {
    logger.error('Bootstrap: no se pudo crear la base de datos', e.message);
    throw e;
  }

  const pool = new Pool(getDbConfig());
  const client = await pool.connect();

  try {
    const baseDir = path.join(__dirname, '../../database');
    const schemaPath = path.join(baseDir, 'schema.sql');
    const migrationsDir = path.join(baseDir, 'migrations');

    const usuariosExists = await hasUsuariosTable(client);

    if (!usuariosExists) {
      logger.info('Bootstrap: aplicando schema.sql...');
      await runSqlFile(client, schemaPath, 'schema');
      await client.query(
        "INSERT INTO schema_migrations (version) VALUES ('schema') ON CONFLICT (version) DO NOTHING"
      );
    } else {
      // DB ya tenía schema (ej. setup manual): asegurar que exista la tabla de control
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version VARCHAR(100) PRIMARY KEY,
          applied_at TIMESTAMP DEFAULT NOW()
        )
      `);
    }

    logger.info('Bootstrap: verificando migraciones pendientes...');
    const appliedNow = [];
    for (const filename of MIGRATIONS_ORDER) {
      const version = filename.replace('.sql', '');
      const applied = await isMigrationApplied(client, version);
      if (applied) continue;
      const filePath = path.join(migrationsDir, filename);
      await runSqlFile(client, filePath, version);
      await client.query(
        'INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT (version) DO NOTHING',
        [version]
      );
      appliedNow.push(version);
    }
    if (appliedNow.length > 0) {
      logger.info(`Bootstrap: migraciones aplicadas (${appliedNow.length} pendientes): ${appliedNow.join(', ')}`);
    } else {
      logger.info('Bootstrap: migraciones al día (ninguna pendiente).');
    }

    await seedAdminIfConfigured(client);
  } finally {
    client.release();
    await pool.end();
  }
}

/**
 * Devuelve el estado de las migraciones (cuáles están aplicadas y cuáles pendientes).
 * No aplica nada; solo consulta schema_migrations.
 * Útil para GET /api/health o para verificar sin reiniciar el servidor.
 */
async function getMigrationsStatus() {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(100) PRIMARY KEY,
        applied_at TIMESTAMP DEFAULT NOW()
      )
    `);
    const r = await client.query('SELECT version FROM schema_migrations');
    const appliedSet = new Set(r.rows.map((row) => row.version));
    const expected = MIGRATIONS_ORDER.map((f) => f.replace('.sql', ''));
    const pending = expected.filter((v) => !appliedSet.has(v));
    return { applied: expected.filter((v) => appliedSet.has(v)), pending, upToDate: pending.length === 0 };
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports = { bootstrap, getMigrationsStatus, MIGRATIONS_ORDER };

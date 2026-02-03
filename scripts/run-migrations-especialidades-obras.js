/**
 * Crea las tablas especialidades y obras_sociales (si no existen) y ejecuta los seeds.
 * Ejecutar desde la carpeta api: node scripts/run-migrations-especialidades-obras.js
 * Requiere .env con DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDbConfig } = require('../src/config/db-config');

const pool = new Pool(getDbConfig());

const migrationsDir = path.join(__dirname, '../database/migrations');

async function run() {
  const client = await pool.connect();
  try {
    // 1. Crear tablas especialidades y obras_sociales si no existen
    const createTablesPath = path.join(migrationsDir, '005_create_especialidades_obras_tables.sql');
    if (!fs.existsSync(createTablesPath)) {
      console.error('❌ No se encontró 005_create_especialidades_obras_tables.sql');
      process.exit(1);
    }
    console.log('📋 Creando tablas especialidades y obras_sociales (si no existen)...');
    const createSql = fs.readFileSync(createTablesPath, 'utf8');
    await client.query(createSql);
    console.log('✅ Tablas listas.');

    // 2. Seed especialidades
    const seedEspPath = path.join(migrationsDir, '003_seed_especialidades.sql');
    if (fs.existsSync(seedEspPath)) {
      console.log('📋 Insertando especialidades por defecto...');
      const seedEsp = fs.readFileSync(seedEspPath, 'utf8');
      await client.query(seedEsp);
      console.log('✅ Especialidades cargadas.');
    }

    // 3. Seed obras_sociales
    const seedObrasPath = path.join(migrationsDir, '004_seed_obras_sociales.sql');
    if (fs.existsSync(seedObrasPath)) {
      console.log('📋 Insertando obras sociales por defecto...');
      const seedObras = fs.readFileSync(seedObrasPath, 'utf8');
      await client.query(seedObras);
      console.log('✅ Obras sociales cargadas.');
    }

    console.log('\n🎉 Migraciones aplicadas correctamente.');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

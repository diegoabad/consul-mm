/**
 * SETUP-DB.JS - Script para crear la base de datos y tablas
 * 
 * Ejecutar: node scripts/setup-db.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { getDbConfig } = require('../src/config/db-config');

async function setupDatabase() {
  const hasUrl = !!process.env.DATABASE_URL;
  let pool;
  let client;

  try {
    console.log('🔧 Configurando base de datos...');

    if (!hasUrl) {
      // Local: conectar a postgres para crear la BD si no existe
      const dbName = process.env.DB_NAME || 'consultorio';
      pool = new Pool({
        ...getDbConfig(),
        database: 'postgres'
      });
      client = await pool.connect();
      try {
        await client.query(`CREATE DATABASE ${dbName}`);
        console.log(`✅ Base de datos '${dbName}' creada exitosamente`);
      } catch (error) {
        if (error.code === '42P04') {
          console.log(`ℹ️  La base de datos '${dbName}' ya existe`);
        } else {
          throw error;
        }
      }
      client.release();
      await pool.end();
    }

    // Conectar a la base de datos (local o DATABASE_URL)
    const dbPool = new Pool(getDbConfig());
    const dbClient = await dbPool.connect();

    try {
      const schemaPath = path.join(__dirname, '../database/schema.sql');
      const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
      console.log('📋 Creando tablas...');
      await dbClient.query(schemaSQL);
      console.log('✅ Tablas creadas exitosamente');
      console.log('\n🎉 Base de datos configurada correctamente!');
      console.log(hasUrl ? '\n📝 Ejecuta las migraciones: npm run setup-remote' : '\n📝 Puedes iniciar el servidor con: npm run dev');
    } finally {
      dbClient.release();
      await dbPool.end();
    }
  } catch (error) {
    console.error('❌ Error configurando base de datos:', error.message);
    process.exit(1);
  }
}

setupDatabase();

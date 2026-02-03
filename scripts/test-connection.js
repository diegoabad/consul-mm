/**
 * TEST-CONNECTION.JS - Script para probar la conexión a PostgreSQL
 * 
 * Ejecutar: node scripts/test-connection.js
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

async function testConnection() {
  const config = getDbConfig();
  console.log('🔍 Verificando configuración...\n');
  console.log('Configuración de conexión:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  Database: ${config.database}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Password: ${config.password ? '***' : 'NO CONFIGURADA'}\n`);

  const dbPool = new Pool(config);
  try {
    console.log('📡 Conectando a PostgreSQL...');
    const dbClient = await dbPool.connect();
    console.log('✅ Conexión exitosa a la base de datos!');

    const tablesResult = await dbClient.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    if (tablesResult.rows.length > 0) {
      console.log('\n📊 Tablas encontradas:');
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('\n⚠️  No se encontraron tablas en la base de datos');
      console.log('   Ejecuta: npm run setup-db (local) o npm run setup-remote (Render)');
    }

    dbClient.release();
  } catch (error) {
    console.error('\n❌ Error conectando:', error.message);
    if (error.code === '3D000') {
      console.error(`\n💡 La base de datos '${config.database}' no existe.`);
      console.error('   Local: npm run setup-db');
      console.error('   Render: la BD ya existe; ejecuta npm run setup-remote');
    } else {
      console.error('\n💡 Verifica: credenciales en .env, que PostgreSQL esté accesible y que uses la URL externa si es Render.');
    }
    process.exit(1);
  } finally {
    await dbPool.end();
  }
}

testConnection();

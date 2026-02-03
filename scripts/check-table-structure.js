/**
 * CHECK-TABLE-STRUCTURE.JS - Script para verificar la estructura de las tablas
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

async function checkStructure() {
  const pool = new Pool(getDbConfig());

  try {
    const client = await pool.connect();
    
    console.log('📊 Estructura de la tabla usuarios:\n');
    
    const result = await client.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = 'usuarios'
      ORDER BY ordinal_position
    `);
    
    console.log('Columnas:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkStructure();

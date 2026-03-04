const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');
const fs = require('fs');

async function run() {
  const pool = new Pool(getDbConfig());
  const client = await pool.connect();
  const sql = fs.readFileSync(path.join(__dirname, '../database/migrations/032_foro_post_indexes.sql'), 'utf8');
  await client.query(sql);
  await client.query("INSERT INTO schema_migrations (version) VALUES ('032_foro_post_indexes') ON CONFLICT (version) DO NOTHING");
  client.release();
  await pool.end();
  console.log('Migration 032 applied');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});

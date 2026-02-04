/**
 * Script para ver configuraciones de agenda y vigencia (vigencia_desde / vigencia_hasta).
 * Útil para diagnosticar por qué un día no figura habilitado en el calendario.
 *
 * Ejecutar desde la carpeta api: node scripts/ver-agenda-vigencia.js [profesional_id]
 * Sin argumentos: lista todas las configuraciones.
 * Con profesional_id (UUID): filtra por ese profesional.
 */

require('dotenv').config();
const { Pool } = require('pg');
const { getDbConfig } = require('../src/config/db-config');

const pool = new Pool(getDbConfig());

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

async function run() {
  const profesionalId = process.argv[2];
  const client = await pool.connect();
  try {
    let sql = `
      SELECT ca.id, ca.profesional_id, ca.dia_semana, ca.hora_inicio, ca.hora_fin,
             ca.activo, ca.vigencia_desde, ca.vigencia_hasta, ca.fecha_creacion,
             u.nombre || ' ' || u.apellido AS profesional_nombre
      FROM configuracion_agenda ca
      INNER JOIN profesionales p ON ca.profesional_id = p.id
      INNER JOIN usuarios u ON p.usuario_id = u.id
    `;
    const params = [];
    if (profesionalId) {
      sql += ' WHERE ca.profesional_id = $1';
      params.push(profesionalId);
    }
    sql += ' ORDER BY ca.profesional_id, ca.vigencia_desde DESC, ca.dia_semana';

    const result = await client.query(sql, params);
    const rows = result.rows;

    if (rows.length === 0) {
      console.log(profesionalId ? 'No hay configuraciones para ese profesional.' : 'No hay configuraciones de agenda.');
      return;
    }

    console.log('Configuraciones de agenda (vigencia_desde / vigencia_hasta):\n');
    for (const r of rows) {
      const dia = DIAS[r.dia_semana] ?? r.dia_semana;
      const vigente = r.vigencia_hasta == null ? '(vigente)' : `hasta ${r.vigencia_hasta}`;
      console.log(`  ${r.id.slice(0, 8)}… | ${r.profesional_nombre} | ${dia} ${r.hora_inicio}-${r.hora_fin} | activo=${r.activo}`);
      console.log(`    vigencia_desde: ${r.vigencia_desde} | vigencia_hasta: ${r.vigencia_hasta ?? 'NULL'} ${vigente}`);
      console.log(`    fecha_creacion: ${r.fecha_creacion}`);
      console.log('');
    }
    console.log(`Total: ${rows.length} fila(s).`);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();

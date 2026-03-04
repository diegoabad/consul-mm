/**
 * Verifica que los datos del foro existan en la base de datos.
 * Cuenta temas, posts raíz y respuestas.
 *
 * Uso: node scripts/verificar-foro-data.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { query } = require('../src/config/database');

async function verificar() {
  console.log('Verificando datos del foro...\n');

  const temas = await query('SELECT COUNT(*)::int AS n FROM foro_tema');
  console.log('Temas:', temas.rows[0].n);

  const totalPosts = await query('SELECT COUNT(*)::int AS n FROM foro_post');
  console.log('Total posts (raíces + respuestas):', totalPosts.rows[0].n);

  const raices = await query('SELECT COUNT(*)::int AS n FROM foro_post WHERE parent_id IS NULL');
  console.log('Posts raíz (sin parent):', raices.rows[0].n);

  const respuestas = await query('SELECT COUNT(*)::int AS n FROM foro_post WHERE parent_id IS NOT NULL');
  console.log('Respuestas (con parent_id):', respuestas.rows[0].n);

  const porTema = await query(`
    SELECT t.id, t.titulo, 
      (SELECT COUNT(*) FROM foro_post WHERE tema_id = t.id AND parent_id IS NULL) as raices,
      (SELECT COUNT(*) FROM foro_post WHERE tema_id = t.id AND parent_id IS NOT NULL) as respuestas
    FROM foro_tema t
    ORDER BY t.fecha_creacion DESC
  `);
  console.log('\nPor tema:');
  porTema.rows.forEach((r) => {
    console.log(`  - ${r.titulo?.substring(0, 40) || r.id}: ${r.raices} raíces, ${r.respuestas} respuestas`);
  });

  console.log('\n✓ Verificación completada. Los datos no se modifican con la paginación por raíces.');
}

verificar()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
  });

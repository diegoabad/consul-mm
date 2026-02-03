/**
 * CREAR-USUARIOS-PRUEBA.JS - Script para crear usuarios de prueba
 * 
 * Este script crea usuarios de cada tipo para desarrollo y testing.
 * Ejecutar con: node test/crear-usuarios-prueba.js
 */

require('dotenv').config({ path: '.env' });
const { query } = require('../src/config/database');
const bcrypt = require('bcrypt');
const { ROLES } = require('../src/utils/constants');

async function limpiarBaseDatos() {
  console.log('🧹 Limpiando base de datos...');
  
  const tables = [
    'notificaciones_email',
    'pagos_profesionales',
    'bloques_no_disponibles',
    'configuracion_agenda',
    'archivos_paciente',
    'evoluciones_clinicas',
    'notas_paciente',
    'turnos',
    'pacientes',
    'profesionales',
    'permisos_usuario',
    'usuarios',
  ];

  try {
    // Desactivar temporalmente las restricciones de foreign key
    await query('SET session_replication_role = replica;');

    for (const table of tables) {
      await query(`TRUNCATE TABLE ${table} CASCADE;`);
      console.log(`  ✅ ${table} limpiada`);
    }

    // Reactivar las restricciones
    await query('SET session_replication_role = DEFAULT;');
    console.log('✅ Base de datos limpiada completamente\n');
  } catch (error) {
    console.error('❌ Error al limpiar base de datos:', error.message);
    throw error;
  }
}

async function crearUsuariosPrueba() {
  console.log('👥 Creando usuarios de prueba...\n');

  const usuariosPrueba = [
    {
      email: 'admin@consultorio.com',
      password: 'Admin123!',
      nombre: 'Administrador',
      apellido: 'Sistema',
      rol: ROLES.ADMINISTRADOR,
      activo: true,
    },
    {
      email: 'profesional@consultorio.com',
      password: 'Profesional123!',
      nombre: 'Dr. Juan',
      apellido: 'Pérez',
      rol: ROLES.PROFESIONAL,
      activo: true,
    },
    {
      email: 'secretaria@consultorio.com',
      password: 'Secretaria123!',
      nombre: 'María',
      apellido: 'González',
      rol: ROLES.SECRETARIA,
      activo: true,
    },
    {
      email: 'jefe.secretaria@consultorio.com',
      password: 'JefeSecretaria123!',
      nombre: 'Ana',
      apellido: 'Martínez',
      rol: ROLES.JEFE_SECRETARIA,
      activo: true,
    },
  ];

  const usuariosCreados = [];

  for (const usuarioData of usuariosPrueba) {
    try {
      // Verificar si el usuario ya existe
      const existe = await query(
        'SELECT id FROM usuarios WHERE email = $1',
        [usuarioData.email]
      );

      if (existe.rows.length > 0) {
        console.log(`  ⚠️  Usuario ${usuarioData.email} ya existe, actualizando contraseña...`);
        
        // Actualizar contraseña
        const passwordHash = await bcrypt.hash(usuarioData.password, 10);
        await query(
          'UPDATE usuarios SET password_hash = $1, activo = $2 WHERE email = $3',
          [passwordHash, usuarioData.activo, usuarioData.email]
        );

        const result = await query(
          'SELECT id, email, nombre, apellido, rol, activo FROM usuarios WHERE email = $1',
          [usuarioData.email]
        );
        usuariosCreados.push({
          ...result.rows[0],
          password: usuarioData.password,
        });
      } else {
        // Crear nuevo usuario
        const passwordHash = await bcrypt.hash(usuarioData.password, 10);
        const result = await query(
          `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol, activo)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, email, nombre, apellido, rol, activo;`,
          [
            usuarioData.email,
            passwordHash,
            usuarioData.nombre,
            usuarioData.apellido,
            usuarioData.rol,
            usuarioData.activo,
          ]
        );

        usuariosCreados.push({
          ...result.rows[0],
          password: usuarioData.password,
        });
      }

      console.log(`  ✅ ${usuarioData.rol}: ${usuarioData.email}`);
    } catch (error) {
      console.error(`  ❌ Error al crear usuario ${usuarioData.email}:`, error.message);
    }
  }

  return usuariosCreados;
}

async function main() {
  try {
    console.log('🚀 Iniciando setup de base de datos...\n');

    // Limpiar base de datos
    await limpiarBaseDatos();

    // Crear usuarios
    const usuariosCreados = await crearUsuariosPrueba();

    // Mostrar credenciales
    console.log('\n' + '='.repeat(60));
    console.log('📋 CREDENCIALES DE USUARIOS PARA LOGIN');
    console.log('='.repeat(60));
    console.log('');

    usuariosCreados.forEach((usuario) => {
      console.log(`🔹 ${usuario.rol.toUpperCase()}`);
      console.log(`   📧 Email:    ${usuario.email}`);
      console.log(`   🔑 Password: ${usuario.password}`);
      console.log(`   👤 Nombre:   ${usuario.nombre} ${usuario.apellido}`);
      console.log(`   🆔 ID:       ${usuario.id}`);
      console.log('');
    });

    console.log('='.repeat(60));
    console.log('✅ Setup completado exitosamente!');
    console.log('='.repeat(60));
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error durante el setup:', error);
    process.exit(1);
  }
}

// Ejecutar si se llama directamente
if (require.main === module) {
  main();
}

module.exports = { limpiarBaseDatos, crearUsuariosPrueba };

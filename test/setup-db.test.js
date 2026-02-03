/**
 * SETUP-DB.TEST.JS - Tests para limpiar y configurar la base de datos
 * 
 * Estos tests son útiles para preparar el entorno de desarrollo
 * y crear usuarios de prueba de cada tipo.
 */

const { query } = require('../src/config/database');
const bcrypt = require('bcrypt');
const { ROLES } = require('../src/utils/constants');

describe('Setup Database Tests', () => {
  describe('Limpiar Base de Datos', () => {
    it('debe limpiar todas las tablas en el orden correcto', async () => {
      // Orden de eliminación: primero las tablas con foreign keys, luego las principales
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

      // Desactivar temporalmente las restricciones de foreign key
      await query('SET session_replication_role = replica;');

      try {
        for (const table of tables) {
          await query(`TRUNCATE TABLE ${table} CASCADE;`);
          console.log(`✅ Tabla ${table} limpiada`);
        }
      } finally {
        // Reactivar las restricciones
        await query('SET session_replication_role = DEFAULT;');
      }

      // Verificar que las tablas están vacías
      for (const table of tables) {
        const result = await query(`SELECT COUNT(*) as count FROM ${table};`);
        expect(parseInt(result.rows[0].count)).toBe(0);
      }
    });
  });

  describe('Crear Usuarios de Prueba', () => {
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

    it('debe crear usuarios de cada tipo con sus credenciales', async () => {
      const usuariosCreados = [];

      for (const usuarioData of usuariosPrueba) {
        // Hash de la contraseña
        const passwordHash = await bcrypt.hash(usuarioData.password, 10);

        // Insertar usuario
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

        const usuario = result.rows[0];
        usuariosCreados.push({
          ...usuario,
          password: usuarioData.password, // Incluir contraseña en texto plano para referencia
        });

        console.log(`✅ Usuario creado: ${usuario.email} (${usuario.rol})`);
      }

      // Verificar que todos los usuarios fueron creados
      expect(usuariosCreados.length).toBe(4);

      // Mostrar credenciales
      console.log('\n📋 CREDENCIALES DE USUARIOS CREADOS:');
      console.log('=====================================');
      usuariosCreados.forEach((usuario) => {
        console.log(`\n${usuario.rol.toUpperCase()}:`);
        console.log(`  Email: ${usuario.email}`);
        console.log(`  Contraseña: ${usuario.password}`);
        console.log(`  Nombre: ${usuario.nombre} ${usuario.apellido}`);
        console.log(`  ID: ${usuario.id}`);
      });
      console.log('\n=====================================\n');

      // Verificar que se pueden consultar
      for (const usuarioData of usuariosPrueba) {
        const result = await query(
          'SELECT * FROM usuarios WHERE email = $1',
          [usuarioData.email]
        );
        expect(result.rows.length).toBe(1);
        expect(result.rows[0].email).toBe(usuarioData.email);
        expect(result.rows[0].rol).toBe(usuarioData.rol);
        expect(result.rows[0].activo).toBe(true);
      }
    });
  });

  describe('Setup Completo (Limpiar + Crear Usuarios)', () => {
    it('debe limpiar la DB y crear usuarios de prueba', async () => {
      // Paso 1: Limpiar
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

      await query('SET session_replication_role = replica;');
      try {
        for (const table of tables) {
          await query(`TRUNCATE TABLE ${table} CASCADE;`);
        }
      } finally {
        await query('SET session_replication_role = DEFAULT;');
      }

      console.log('✅ Base de datos limpiada');

      // Paso 2: Crear usuarios
      const usuariosPrueba = [
        {
          email: 'admin@consultorio.com',
          password: 'Admin123!',
          nombre: 'Administrador',
          apellido: 'Sistema',
          rol: ROLES.ADMINISTRADOR,
        },
        {
          email: 'profesional@consultorio.com',
          password: 'Profesional123!',
          nombre: 'Dr. Juan',
          apellido: 'Pérez',
          rol: ROLES.PROFESIONAL,
        },
        {
          email: 'secretaria@consultorio.com',
          password: 'Secretaria123!',
          nombre: 'María',
          apellido: 'González',
          rol: ROLES.SECRETARIA,
        },
        {
          email: 'jefe.secretaria@consultorio.com',
          password: 'JefeSecretaria123!',
          nombre: 'Ana',
          apellido: 'Martínez',
          rol: ROLES.JEFE_SECRETARIA,
        },
      ];

      for (const usuarioData of usuariosPrueba) {
        const passwordHash = await bcrypt.hash(usuarioData.password, 10);
        await query(
          `INSERT INTO usuarios (email, password_hash, nombre, apellido, rol, activo)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            usuarioData.email,
            passwordHash,
            usuarioData.nombre,
            usuarioData.apellido,
            usuarioData.rol,
            true,
          ]
        );
      }

      console.log('✅ Usuarios de prueba creados');

      // Mostrar resumen
      console.log('\n📋 CREDENCIALES PARA LOGIN:');
      console.log('=====================================');
      usuariosPrueba.forEach((usuario) => {
        console.log(`${usuario.rol.toUpperCase()}:`);
        console.log(`  📧 Email: ${usuario.email}`);
        console.log(`  🔑 Contraseña: ${usuario.password}`);
      });
      console.log('=====================================\n');
    });
  });
});

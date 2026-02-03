/**
 * USUARIOS.TEST.JS - Tests de usuarios
 * 
 * Tests para los endpoints de usuarios:
 * - GET /api/usuarios
 * - GET /api/usuarios/:id
 * - POST /api/usuarios
 * - PUT /api/usuarios/:id
 * - DELETE /api/usuarios/:id
 * - PATCH /api/usuarios/:id/activate
 * - PATCH /api/usuarios/:id/deactivate
 * - PATCH /api/usuarios/:id/password
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders, createTestUser } = require('./helpers/testHelpers');

describe('Usuarios Endpoints', () => {
  let adminToken;
  let secretariaToken;
  let testUserId;
  let testUser2Id;
  
  beforeAll(async () => {
    // Crear tokens para diferentes roles
    try {
      // Admin
      let adminUser = await usuarioModel.findByEmail('admin@test.com');
      if (!adminUser) {
        adminUser = await usuarioModel.create({
          email: 'admin@test.com',
          password: 'admin123',
          nombre: 'Admin',
          apellido: 'Test',
          telefono: '1234567890',
          rol: ROLES.ADMINISTRADOR,
          activo: true
        });
      }
      adminToken = generateToken({
        id: adminUser.id,
        email: adminUser.email,
        rol: adminUser.rol
      });
      
      // Secretaria
      let secretariaUser = await usuarioModel.findByEmail('secretaria@test.com');
      if (!secretariaUser) {
        secretariaUser = await usuarioModel.create({
          email: 'secretaria@test.com',
          password: 'secretaria123',
          nombre: 'Secretaria',
          apellido: 'Test',
          telefono: '1234567890',
          rol: ROLES.SECRETARIA,
          activo: true
        });
      }
      secretariaToken = generateToken({
        id: secretariaUser.id,
        email: secretariaUser.email,
        rol: secretariaUser.rol
      });
    } catch (error) {
      console.error('Error creando usuarios para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar usuarios de prueba
    if (testUserId) {
      try {
        await usuarioModel.delete(testUserId);
      } catch (error) {
        console.error('Error limpiando usuario de prueba:', error);
      }
    }
    if (testUser2Id) {
      try {
        await usuarioModel.delete(testUser2Id);
      } catch (error) {
        console.error('Error limpiando usuario de prueba 2:', error);
      }
    }
  });
  
  describe('GET /api/usuarios', () => {
    it('debería listar todos los usuarios (admin)', async () => {
      const response = await request(app)
        .get('/api/usuarios')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar usuarios por rol', async () => {
      const response = await request(app)
        .get('/api/usuarios?rol=ADMINISTRADOR')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].rol).toBe(ROLES.ADMINISTRADOR);
      }
    });
    
    it('debería fallar sin permisos (secretaria)', async () => {
      const response = await request(app)
        .get('/api/usuarios')
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/usuarios/:id', () => {
    it('debería obtener un usuario por ID (admin)', async () => {
      // Primero crear un usuario de prueba
      const newUser = await usuarioModel.create(createTestUser({
        email: `test${Date.now()}@example.com`
      }));
      testUserId = newUser.id;
      
      const response = await request(app)
        .get(`/api/usuarios/${testUserId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUserId);
    });
    
    it('debería retornar 404 si el usuario no existe', async () => {
      // Usar un UUID válido que no existe
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/usuarios/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/usuarios', () => {
    it('debería crear un nuevo usuario (admin)', async () => {
      const newUser = createTestUser({
        email: `test${Date.now()}@example.com`,
        rol: ROLES.PROFESIONAL
      });
      
      const response = await request(app)
        .post('/api/usuarios')
        .set(authHeaders(adminToken))
        .send(newUser)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(newUser.email);
      
      testUser2Id = response.body.data.id;
    });
    
    it('debería fallar si el email ya existe', async () => {
      const newUser = createTestUser({
        email: 'admin@test.com'
      });
      
      const response = await request(app)
        .post('/api/usuarios')
        .set(authHeaders(adminToken))
        .send(newUser)
        .expect(409);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/usuarios/:id', () => {
    it('debería actualizar un usuario (admin)', async () => {
      if (!testUserId) {
        const newUser = await usuarioModel.create(createTestUser({
          email: `test${Date.now()}@example.com`
        }));
        testUserId = newUser.id;
      }
      
      const response = await request(app)
        .put(`/api/usuarios/${testUserId}`)
        .set(authHeaders(adminToken))
        .send({
          activo: false
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.activo).toBe(false);
    });
  });
  
  describe('PATCH /api/usuarios/:id/activate', () => {
    it('debería activar un usuario (admin)', async () => {
      if (!testUserId) {
        const newUser = await usuarioModel.create(createTestUser({
          email: `test${Date.now()}@example.com`,
          activo: false
        }));
        testUserId = newUser.id;
      }
      
      const response = await request(app)
        .patch(`/api/usuarios/${testUserId}/activate`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.activo).toBe(true);
    });
  });
  
  describe('PATCH /api/usuarios/:id/deactivate', () => {
    it('debería desactivar un usuario (admin)', async () => {
      if (!testUserId) {
        const newUser = await usuarioModel.create(createTestUser({
          email: `test${Date.now()}@example.com`
        }));
        testUserId = newUser.id;
      }
      
      const response = await request(app)
        .patch(`/api/usuarios/${testUserId}/deactivate`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.activo).toBe(false);
    });
  });
  
  describe('PATCH /api/usuarios/:id/password', () => {
    it('debería actualizar la contraseña de un usuario', async () => {
      if (!testUserId) {
        const newUser = await usuarioModel.create(createTestUser({
          email: `test${Date.now()}@example.com`
        }));
        testUserId = newUser.id;
      }
      
      const response = await request(app)
        .patch(`/api/usuarios/${testUserId}/password`)
        .set(authHeaders(adminToken))
        .send({
          newPassword: 'newpassword123',
          confirmPassword: 'newpassword123'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar si las contraseñas no coinciden', async () => {
      if (!testUserId) {
        const newUser = await usuarioModel.create(createTestUser({
          email: `test${Date.now()}@example.com`
        }));
        testUserId = newUser.id;
      }
      
      const response = await request(app)
        .patch(`/api/usuarios/${testUserId}/password`)
        .set(authHeaders(adminToken))
        .send({
          newPassword: 'newpassword123',
          confirmPassword: 'differentpassword'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/usuarios/:id', () => {
    it('debería eliminar un usuario (soft delete)', async () => {
      // Crear usuario para eliminar
      const newUser = await usuarioModel.create(createTestUser({
        email: `test${Date.now()}@example.com`
      }));
      const userIdToDelete = newUser.id;
      
      const response = await request(app)
        .delete(`/api/usuarios/${userIdToDelete}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verificar que el usuario esté desactivado
      const deletedUser = await usuarioModel.findById(userIdToDelete);
      expect(deletedUser.activo).toBe(false);
    });
  });
});

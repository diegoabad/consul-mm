/**
 * AUTH.TEST.JS - Tests de autenticación
 * 
 * Tests para los endpoints de autenticación:
 * - POST /api/auth/login
 * - POST /api/auth/register
 * - GET /api/auth/profile
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders, createTestUser } = require('./helpers/testHelpers');

describe('Auth Endpoints', () => {
  let adminToken;
  let testUserId;
  let adminUserId;
  
  beforeAll(async () => {
    // Crear usuario administrador para tests
    try {
      const adminUser = await usuarioModel.findByEmail('admin@test.com');
      if (!adminUser) {
        const newAdmin = await usuarioModel.create({
          email: 'admin@test.com',
          password: 'admin123',
          nombre: 'Admin',
          apellido: 'Test',
          telefono: '1234567890',
          rol: ROLES.ADMINISTRADOR,
          activo: true
        });
        adminUserId = newAdmin.id;
        adminToken = generateToken({
          id: newAdmin.id,
          email: newAdmin.email,
          rol: newAdmin.rol
        });
      } else {
        adminUserId = adminUser.id;
        adminToken = generateToken({
          id: adminUser.id,
          email: adminUser.email,
          rol: adminUser.rol
        });
      }
    } catch (error) {
      console.error('Error creando usuario admin para tests:', error);
      // Si falla, crear un token mock para que los tests puedan continuar
      // pero fallarán si la BD no está disponible
      adminToken = generateToken({
        id: 1,
        email: 'admin@test.com',
        rol: ROLES.ADMINISTRADOR
      });
    }
  });
  
  afterAll(async () => {
    // Limpiar usuario de prueba si existe
    if (testUserId) {
      try {
        await usuarioModel.delete(testUserId);
      } catch (error) {
        console.error('Error limpiando usuario de prueba:', error);
      }
    }
  });
  
  describe('POST /api/auth/login', () => {
    it('debería hacer login exitoso con credenciales válidas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'admin123'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user).toHaveProperty('email');
      expect(response.body.data.user).toHaveProperty('rol');
    });
    
    it('debería fallar con credenciales inválidas', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Credenciales inválidas');
    });
    
    it('debería fallar con email que no existe', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'password123'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el usuario está desactivado', async () => {
      // Crear un usuario inactivo
      const inactiveUser = await usuarioModel.create({
        email: `inactive${Date.now()}@test.com`,
        password: 'test123',
        nombre: 'Inactive',
        apellido: 'User',
        telefono: '1234567890',
        rol: ROLES.SECRETARIA,
        activo: false
      });
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: inactiveUser.email,
          password: 'test123'
        })
        .expect(401);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('desactivado');
      
      // Limpiar
      await usuarioModel.delete(inactiveUser.id);
    });
    
    it('debería validar que email y password sean requeridos', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('details');
    });
  });
  
  describe('POST /api/auth/register', () => {
    it('debería crear un nuevo usuario (solo admin)', async () => {
      const userData = createTestUser({
        email: `test${Date.now()}@example.com`,
        rol: ROLES.SECRETARIA
      });
      // Remover 'activo' ya que no está permitido en el schema de registro
      const { activo, ...newUser } = userData;
      
      const response = await request(app)
        .post('/api/auth/register')
        .set(authHeaders(adminToken))
        .send(newUser)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.email).toBe(newUser.email);
      expect(response.body.data.rol).toBe(newUser.rol);
      
      testUserId = response.body.data.id;
    });
    
    it('debería fallar sin autenticación', async () => {
      const userData = createTestUser();
      // Remover 'activo' ya que no está permitido en el schema de registro
      const { activo, ...newUser } = userData;
      
      const response = await request(app)
        .post('/api/auth/register')
        .send(newUser)
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el email ya existe', async () => {
      const userData = createTestUser({
        email: 'admin@test.com'
      });
      // Remover 'activo' ya que no está permitido en el schema de registro
      const { activo, ...newUser } = userData;
      
      const response = await request(app)
        .post('/api/auth/register')
        .set(authHeaders(adminToken))
        .send(newUser)
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ya está registrado');
    });
    
    it('debería validar campos requeridos', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set(authHeaders(adminToken))
        .send({})
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/auth/profile', () => {
    it('debería obtener el perfil del usuario autenticado', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('email');
      expect(response.body.data).toHaveProperty('rol');
    });
    
    it('debería fallar sin token', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar con token inválido', async () => {
      const response = await request(app)
        .get('/api/auth/profile')
        .set(authHeaders('invalid_token'))
        .expect(401);
      
      expect(response.body.success).toBe(false);
    });
  });
});

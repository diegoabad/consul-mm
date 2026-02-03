/**
 * NOTIFICACIONES.TEST.JS - Tests de notificaciones por email
 * 
 * Tests para los endpoints de notificaciones:
 * - GET /api/notificaciones
 * - GET /api/notificaciones/pending
 * - GET /api/notificaciones/destinatario/:email
 * - GET /api/notificaciones/:id
 * - POST /api/notificaciones
 * - PUT /api/notificaciones/:id
 * - POST /api/notificaciones/:id/send
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const notificacionModel = require('../src/models/notificacion.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

// Mock del servicio de email para evitar envíos reales en tests
jest.mock('../src/services/email.service', () => ({
  sendEmail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' })
}));

describe('Notificaciones Endpoints', () => {
  let adminToken;
  let jefeSecretariaToken;
  let profesionalToken;
  let secretariaToken;
  let testNotificacionId;
  
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
      
      // Jefe de Secretaria
      let jefeSecretariaUser = await usuarioModel.findByEmail('jefesecretaria@test.com');
      if (!jefeSecretariaUser) {
        jefeSecretariaUser = await usuarioModel.create({
          email: 'jefesecretaria@test.com',
          password: 'jefe123',
          nombre: 'Jefe',
          apellido: 'Secretaria',
          telefono: '1234567890',
          rol: ROLES.JEFE_SECRETARIA,
          activo: true
        });
      }
      jefeSecretariaToken = generateToken({
        id: jefeSecretariaUser.id,
        email: jefeSecretariaUser.email,
        rol: jefeSecretariaUser.rol
      });
      
      // Profesional
      let profesionalUser = await usuarioModel.findByEmail('profesional@test.com');
      if (!profesionalUser) {
        profesionalUser = await usuarioModel.create({
          email: 'profesional@test.com',
          password: 'profesional123',
          nombre: 'Profesional',
          apellido: 'Test',
          telefono: '1234567890',
          rol: ROLES.PROFESIONAL,
          activo: true
        });
      }
      profesionalToken = generateToken({
        id: profesionalUser.id,
        email: profesionalUser.email,
        rol: profesionalUser.rol
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
      console.error('Error creando datos para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    if (testNotificacionId) {
      try {
        // Las notificaciones no se eliminan, solo se marcan
      } catch (error) {
        console.error('Error limpiando notificación de prueba:', error);
      }
    }
  });
  
  describe('GET /api/notificaciones', () => {
    it('debería listar todas las notificaciones (admin)', async () => {
      const response = await request(app)
        .get('/api/notificaciones')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por destinatario_email', async () => {
      const response = await request(app)
        .get('/api/notificaciones?destinatario_email=test@example.com')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por estado', async () => {
      const response = await request(app)
        .get('/api/notificaciones?estado=pendiente')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a jefe_secretaria (tiene permiso notificaciones.leer)', async () => {
      const response = await request(app)
        .get('/api/notificaciones')
        .set(authHeaders(jefeSecretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar si un profesional intenta acceder (no tiene permiso notificaciones.leer)', async () => {
      await request(app)
        .get('/api/notificaciones')
        .set(authHeaders(profesionalToken))
        .expect(403);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/notificaciones')
        .expect(401);
    });
  });
  
  describe('GET /api/notificaciones/pending', () => {
    it('debería obtener notificaciones pendientes (admin)', async () => {
      const response = await request(app)
        .get('/api/notificaciones/pending')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a jefe_secretaria', async () => {
      const response = await request(app)
        .get('/api/notificaciones/pending')
        .set(authHeaders(jefeSecretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/notificaciones/pending')
        .expect(401);
    });
  });
  
  describe('GET /api/notificaciones/destinatario/:email', () => {
    it('debería obtener notificaciones de un destinatario (admin)', async () => {
      const response = await request(app)
        .get('/api/notificaciones/destinatario/test@example.com')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 400 si el email es inválido', async () => {
      const response = await request(app)
        .get('/api/notificaciones/destinatario/invalid-email')
        .set(authHeaders(adminToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir acceso a jefe_secretaria', async () => {
      const response = await request(app)
        .get('/api/notificaciones/destinatario/test@example.com')
        .set(authHeaders(jefeSecretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/notificaciones/destinatario/test@example.com')
        .expect(401);
    });
  });
  
  describe('GET /api/notificaciones/:id', () => {
    it('debería obtener una notificación por ID (admin)', async () => {
      // Primero crear una notificación de prueba
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test Subject',
        contenido: 'Test Content',
        tipo: 'test'
      });
      testNotificacionId = notificacion.id;
      
      const response = await request(app)
        .get(`/api/notificaciones/${testNotificacionId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testNotificacionId);
    });
    
    it('debería retornar 404 si la notificación no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/notificaciones/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir acceso a jefe_secretaria', async () => {
      if (testNotificacionId) {
        const response = await request(app)
          .get(`/api/notificaciones/${testNotificacionId}`)
          .set(authHeaders(jefeSecretariaToken))
          .expect(200);
        
        expect(response.body.success).toBe(true);
      }
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get(`/api/notificaciones/${testNotificacionId || '00000000-0000-0000-0000-000000000000'}`)
        .expect(401);
    });
  });
  
  describe('POST /api/notificaciones', () => {
    it('debería crear una nueva notificación (admin)', async () => {
      const response = await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(adminToken))
        .send({
          destinatario_email: 'newtest@example.com',
          asunto: 'Nueva Notificación',
          contenido: 'Contenido de la notificación',
          tipo: 'test'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.estado).toBe('pendiente');
      
      if (!testNotificacionId) {
        testNotificacionId = response.body.data.id;
      }
    });
    
    it('debería retornar 400 si faltan campos requeridos', async () => {
      const response = await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(adminToken))
        .send({
          destinatario_email: 'test@example.com'
          // Falta asunto y contenido
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería retornar 400 si el email es inválido', async () => {
      const response = await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(adminToken))
        .send({
          destinatario_email: 'invalid-email',
          asunto: 'Test',
          contenido: 'Test'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir crear con relacionado_tipo y relacionado_id', async () => {
      const response = await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(adminToken))
        .send({
          destinatario_email: 'test@example.com',
          asunto: 'Notificación Relacionada',
          contenido: 'Contenido',
          tipo: 'turno',
          relacionado_tipo: 'turno',
          relacionado_id: '00000000-0000-0000-0000-000000000000'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar si un profesional intenta crear (no tiene permiso notificaciones.crear)', async () => {
      await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(profesionalToken))
        .send({
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Test'
        })
        .expect(403);
    });
    
    it('debería fallar si una secretaria intenta crear (no tiene permiso notificaciones.crear)', async () => {
      await request(app)
        .post('/api/notificaciones')
        .set(authHeaders(secretariaToken))
        .send({
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Test'
        })
        .expect(403);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .post('/api/notificaciones')
        .send({
          destinatario_email: 'test@example.com',
          asunto: 'Test',
          contenido: 'Test'
        })
        .expect(401);
    });
  });
  
  describe('PUT /api/notificaciones/:id', () => {
    it('debería actualizar una notificación (admin)', async () => {
      if (!testNotificacionId) {
        // Crear una notificación si no existe
        const notificacion = await notificacionModel.create({
          destinatario_email: 'test@example.com',
          asunto: 'Test Subject',
          contenido: 'Test Content',
          tipo: 'test'
        });
        testNotificacionId = notificacion.id;
      }
      
      const response = await request(app)
        .put(`/api/notificaciones/${testNotificacionId}`)
        .set(authHeaders(adminToken))
        .send({
          asunto: 'Asunto Actualizado',
          contenido: 'Contenido Actualizado'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.asunto).toBe('Asunto Actualizado');
    });
    
    it('debería retornar 404 si la notificación no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/notificaciones/${fakeId}`)
        .set(authHeaders(adminToken))
        .send({
          asunto: 'Test'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería retornar 400 si intenta actualizar una notificación ya enviada', async () => {
      // Crear y marcar como enviada
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Test',
        tipo: 'test'
      });
      await notificacionModel.markAsSent(notificacion.id, new Date());
      
      const response = await request(app)
        .put(`/api/notificaciones/${notificacion.id}`)
        .set(authHeaders(adminToken))
        .send({
          asunto: 'Actualizado'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si un profesional intenta actualizar (no tiene permiso notificaciones.crear)', async () => {
      if (testNotificacionId) {
        await request(app)
          .put(`/api/notificaciones/${testNotificacionId}`)
          .set(authHeaders(profesionalToken))
          .send({
            asunto: 'Test'
          })
          .expect(403);
      }
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .put(`/api/notificaciones/${testNotificacionId || '00000000-0000-0000-0000-000000000000'}`)
        .send({
          asunto: 'Test'
        })
        .expect(401);
    });
  });
  
  describe('POST /api/notificaciones/:id/send', () => {
    it('debería enviar una notificación (admin)', async () => {
      // Crear una notificación pendiente
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test Subject',
        contenido: 'Test Content',
        tipo: 'test'
      });
      const notificacionId = notificacion.id;
      
      const response = await request(app)
        .post(`/api/notificaciones/${notificacionId}/send`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.estado).toBe('enviado');
      expect(response.body.data.fecha_envio).toBeDefined();
    });
    
    it('debería enviar una notificación (jefe_secretaria)', async () => {
      // Crear una notificación pendiente
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test Subject',
        contenido: 'Test Content',
        tipo: 'test'
      });
      const notificacionId = notificacion.id;
      
      const response = await request(app)
        .post(`/api/notificaciones/${notificacionId}/send`)
        .set(authHeaders(jefeSecretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.estado).toBe('enviado');
    });
    
    it('debería retornar 404 si la notificación no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post(`/api/notificaciones/${fakeId}/send`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería retornar 400 si la notificación ya fue enviada', async () => {
      // Crear y marcar como enviada
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Test',
        tipo: 'test'
      });
      await notificacionModel.markAsSent(notificacion.id, new Date());
      
      const response = await request(app)
        .post(`/api/notificaciones/${notificacion.id}/send`)
        .set(authHeaders(adminToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si un profesional intenta enviar (no tiene permiso notificaciones.enviar)', async () => {
      // Crear una notificación pendiente
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Test',
        tipo: 'test'
      });
      
      await request(app)
        .post(`/api/notificaciones/${notificacion.id}/send`)
        .set(authHeaders(profesionalToken))
        .expect(403);
    });
    
    it('debería fallar si una secretaria intenta enviar (no tiene permiso notificaciones.enviar)', async () => {
      // Crear una notificación pendiente
      const notificacion = await notificacionModel.create({
        destinatario_email: 'test@example.com',
        asunto: 'Test',
        contenido: 'Test',
        tipo: 'test'
      });
      
      await request(app)
        .post(`/api/notificaciones/${notificacion.id}/send`)
        .set(authHeaders(secretariaToken))
        .expect(403);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .post(`/api/notificaciones/${testNotificacionId || '00000000-0000-0000-0000-000000000000'}/send`)
        .expect(401);
    });
  });
});

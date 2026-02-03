/**
 * PAGOS.TEST.JS - Tests de pagos de profesionales
 * 
 * Tests para los endpoints de pagos:
 * - GET /api/pagos
 * - GET /api/pagos/pending
 * - GET /api/pagos/overdue
 * - GET /api/pagos/profesional/:id
 * - GET /api/pagos/:id
 * - POST /api/pagos
 * - PUT /api/pagos/:id
 * - PATCH /api/pagos/:id/pay
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const profesionalModel = require('../src/models/profesional.model');
const pagoModel = require('../src/models/pago.model');
const { ROLES, ESTADOS_PAGO } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Pagos Endpoints', () => {
  let adminToken;
  let profesionalToken;
  let secretariaToken;
  let jefeSecretariaToken;
  let profesionalUserId;
  let profesionalId;
  let testProfesionalId;
  let testUsuarioId;
  let testPagoId;
  
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
      profesionalUserId = profesionalUser.id;
      profesionalToken = generateToken({
        id: profesionalUser.id,
        email: profesionalUser.email,
        rol: profesionalUser.rol
      });
      
      // Crear profesional asociado al usuario profesional si no existe
      let profesional = await profesionalModel.findByUserId(profesionalUserId);
      if (!profesional) {
        profesional = await profesionalModel.create({
          usuario_id: profesionalUserId,
          matricula: 'MAT001',
          especialidad: 'Cardiología',
          estado_pago: 'al_dia',
          bloqueado: false
        });
      }
      profesionalId = profesional.id;
      
      // Crear un profesional de prueba para tests
      const testUser = await usuarioModel.create({
        email: `testprof${Date.now()}@test.com`,
        password: 'test123',
        nombre: 'Test',
        apellido: 'Profesional',
        telefono: '1234567890',
        rol: ROLES.PROFESIONAL,
        activo: true
      });
      testUsuarioId = testUser.id;
      
      const testProfesional = await profesionalModel.create({
        usuario_id: testUsuarioId,
        matricula: `MAT${Date.now()}`,
        especialidad: 'Pediatría',
        estado_pago: 'al_dia',
        bloqueado: false
      });
      testProfesionalId = testProfesional.id;
    } catch (error) {
      console.error('Error creando datos para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    if (testPagoId) {
      try {
        const pago = await pagoModel.findById(testPagoId);
        if (pago) {
          // No hay delete, pero podemos limpiar si es necesario
        }
      } catch (error) {
        console.error('Error limpiando pago de prueba:', error);
      }
    }
    if (testProfesionalId) {
      try {
        await profesionalModel.delete(testProfesionalId);
      } catch (error) {
        console.error('Error limpiando profesional de prueba:', error);
      }
    }
    if (testUsuarioId) {
      try {
        await usuarioModel.delete(testUsuarioId);
      } catch (error) {
        console.error('Error limpiando usuario de prueba:', error);
      }
    }
  });
  
  describe('GET /api/pagos', () => {
    it('debería listar todos los pagos (admin)', async () => {
      const response = await request(app)
        .get('/api/pagos')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por profesional_id', async () => {
      const response = await request(app)
        .get(`/api/pagos?profesional_id=${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por estado', async () => {
      const response = await request(app)
        .get(`/api/pagos?estado=${ESTADOS_PAGO.PENDIENTE}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales (tienen permiso pagos.leer)', async () => {
      const response = await request(app)
        .get('/api/pagos')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería permitir acceso a secretarias (tienen permiso pagos.leer)', async () => {
      const response = await request(app)
        .get('/api/pagos')
        .set(authHeaders(secretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/pagos')
        .expect(401);
    });
  });
  
  describe('GET /api/pagos/pending', () => {
    it('debería obtener pagos pendientes (admin)', async () => {
      const response = await request(app)
        .get('/api/pagos/pending')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales', async () => {
      const response = await request(app)
        .get('/api/pagos/pending')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/pagos/pending')
        .expect(401);
    });
  });
  
  describe('GET /api/pagos/overdue', () => {
    it('debería obtener pagos vencidos (admin)', async () => {
      const response = await request(app)
        .get('/api/pagos/overdue')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales', async () => {
      const response = await request(app)
        .get('/api/pagos/overdue')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/pagos/overdue')
        .expect(401);
    });
  });
  
  describe('GET /api/pagos/profesional/:id', () => {
    it('debería obtener pagos de un profesional (admin)', async () => {
      const response = await request(app)
        .get(`/api/pagos/profesional/${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el profesional no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/pagos/profesional/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir acceso a profesionales', async () => {
      const response = await request(app)
        .get(`/api/pagos/profesional/${profesionalId}`)
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get(`/api/pagos/profesional/${testProfesionalId}`)
        .expect(401);
    });
  });
  
  describe('GET /api/pagos/:id', () => {
    it('debería obtener un pago por ID (admin)', async () => {
      // Primero crear un pago de prueba
      const periodo = new Date('2024-01-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      testPagoId = pago.id;
      
      const response = await request(app)
        .get(`/api/pagos/${testPagoId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.id).toBe(testPagoId);
    });
    
    it('debería retornar 404 si el pago no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/pagos/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir acceso a profesionales', async () => {
      if (testPagoId) {
        const response = await request(app)
          .get(`/api/pagos/${testPagoId}`)
          .set(authHeaders(profesionalToken))
          .expect(200);
        
        expect(response.body.success).toBe(true);
      }
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get(`/api/pagos/${testPagoId || '00000000-0000-0000-0000-000000000000'}`)
        .expect(401);
    });
  });
  
  describe('POST /api/pagos', () => {
    it('debería crear un nuevo pago (admin)', async () => {
      const periodo = new Date('2024-02-01');
      const response = await request(app)
        .post('/api/pagos')
        .set(authHeaders(adminToken))
        .send({
          profesional_id: testProfesionalId,
          periodo: periodo.toISOString().split('T')[0],
          monto: 6000.00,
          estado: ESTADOS_PAGO.PENDIENTE,
          observaciones: 'Pago mensual febrero'
        })
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.monto).toBe('6000.00');
      
      // Guardar ID para limpieza
      if (!testPagoId) {
        testPagoId = response.body.data.id;
      }
    });
    
    it('debería retornar 400 si el profesional no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const periodo = new Date('2024-03-01');
      const response = await request(app)
        .post('/api/pagos')
        .set(authHeaders(adminToken))
        .send({
          profesional_id: fakeId,
          periodo: periodo.toISOString().split('T')[0],
          monto: 5000.00
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería retornar 400 si ya existe un pago para el mismo profesional y periodo', async () => {
      const periodo = new Date('2024-04-01');
      
      // Crear primer pago
      await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      
      // Intentar crear otro pago para el mismo periodo
      const response = await request(app)
        .post('/api/pagos')
        .set(authHeaders(adminToken))
        .send({
          profesional_id: testProfesionalId,
          periodo: periodo.toISOString().split('T')[0],
          monto: 6000.00
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si un profesional intenta crear (no tiene permiso pagos.crear)', async () => {
      const periodo = new Date('2024-05-01');
      await request(app)
        .post('/api/pagos')
        .set(authHeaders(profesionalToken))
        .send({
          profesional_id: testProfesionalId,
          periodo: periodo.toISOString().split('T')[0],
          monto: 5000.00
        })
        .expect(403);
    });
    
    it('debería fallar si una secretaria intenta crear (no tiene permiso pagos.crear)', async () => {
      const periodo = new Date('2024-06-01');
      await request(app)
        .post('/api/pagos')
        .set(authHeaders(secretariaToken))
        .send({
          profesional_id: testProfesionalId,
          periodo: periodo.toISOString().split('T')[0],
          monto: 5000.00
        })
        .expect(403);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .post('/api/pagos')
        .send({
          profesional_id: testProfesionalId,
          periodo: '2024-07-01',
          monto: 5000.00
        })
        .expect(401);
    });
  });
  
  describe('PUT /api/pagos/:id', () => {
    it('debería actualizar un pago (admin)', async () => {
      if (!testPagoId) {
        // Crear un pago si no existe
        const periodo = new Date('2024-08-01');
        const pago = await pagoModel.create({
          profesional_id: testProfesionalId,
          periodo: periodo,
          monto: 5000.00,
          estado: ESTADOS_PAGO.PENDIENTE
        });
        testPagoId = pago.id;
      }
      
      const response = await request(app)
        .put(`/api/pagos/${testPagoId}`)
        .set(authHeaders(adminToken))
        .send({
          monto: 7000.00,
          observaciones: 'Monto actualizado'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.monto).toBe('7000.00');
    });
    
    it('debería retornar 404 si el pago no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/pagos/${fakeId}`)
        .set(authHeaders(adminToken))
        .send({
          monto: 8000.00
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si un profesional intenta actualizar (no tiene permiso pagos.actualizar)', async () => {
      if (testPagoId) {
        await request(app)
          .put(`/api/pagos/${testPagoId}`)
          .set(authHeaders(profesionalToken))
          .send({
            monto: 9000.00
          })
          .expect(403);
      }
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .put(`/api/pagos/${testPagoId || '00000000-0000-0000-0000-000000000000'}`)
        .send({
          monto: 10000.00
        })
        .expect(401);
    });
  });
  
  describe('PATCH /api/pagos/:id/pay', () => {
    it('debería marcar un pago como pagado (admin)', async () => {
      // Crear un pago pendiente
      const periodo = new Date('2024-09-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      const pagoId = pago.id;
      
      const response = await request(app)
        .patch(`/api/pagos/${pagoId}/pay`)
        .set(authHeaders(adminToken))
        .send({
          metodo_pago: 'Transferencia bancaria',
          comprobante_url: 'https://example.com/comprobante.pdf'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.estado).toBe(ESTADOS_PAGO.PAGADO);
      expect(response.body.data.fecha_pago).toBeDefined();
    });
    
    it('debería marcar un pago como pagado (jefe_secretaria)', async () => {
      // Crear un pago pendiente
      const periodo = new Date('2024-10-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      const pagoId = pago.id;
      
      const response = await request(app)
        .patch(`/api/pagos/${pagoId}/pay`)
        .set(authHeaders(jefeSecretariaToken))
        .send({
          metodo_pago: 'Efectivo'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.estado).toBe(ESTADOS_PAGO.PAGADO);
    });
    
    it('debería retornar 404 si el pago no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .patch(`/api/pagos/${fakeId}/pay`)
        .set(authHeaders(adminToken))
        .send({
          metodo_pago: 'Transferencia'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería retornar 400 si el pago ya está pagado', async () => {
      // Crear un pago ya pagado
      const periodo = new Date('2024-11-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PAGADO,
        fecha_pago: new Date()
      });
      const pagoId = pago.id;
      
      const response = await request(app)
        .patch(`/api/pagos/${pagoId}/pay`)
        .set(authHeaders(adminToken))
        .send({
          metodo_pago: 'Transferencia'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si un profesional intenta marcar como pagado (no tiene permiso pagos.marcar_pagado)', async () => {
      // Crear un pago pendiente
      const periodo = new Date('2024-12-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      const pagoId = pago.id;
      
      await request(app)
        .patch(`/api/pagos/${pagoId}/pay`)
        .set(authHeaders(profesionalToken))
        .send({
          metodo_pago: 'Transferencia'
        })
        .expect(403);
    });
    
    it('debería fallar si una secretaria intenta marcar como pagado (no tiene permiso pagos.marcar_pagado)', async () => {
      // Crear un pago pendiente
      const periodo = new Date('2025-01-01');
      const pago = await pagoModel.create({
        profesional_id: testProfesionalId,
        periodo: periodo,
        monto: 5000.00,
        estado: ESTADOS_PAGO.PENDIENTE
      });
      const pagoId = pago.id;
      
      await request(app)
        .patch(`/api/pagos/${pagoId}/pay`)
        .set(authHeaders(secretariaToken))
        .send({
          metodo_pago: 'Transferencia'
        })
        .expect(403);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .patch(`/api/pagos/${testPagoId || '00000000-0000-0000-0000-000000000000'}/pay`)
        .send({
          metodo_pago: 'Transferencia'
        })
        .expect(401);
    });
  });
});

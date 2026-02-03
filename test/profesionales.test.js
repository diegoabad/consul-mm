/**
 * PROFESIONALES.TEST.JS - Tests de profesionales
 * 
 * Tests para los endpoints de profesionales:
 * - GET /api/profesionales
 * - GET /api/profesionales/blocked
 * - GET /api/profesionales/:id
 * - POST /api/profesionales
 * - PUT /api/profesionales/:id
 * - DELETE /api/profesionales/:id
 * - PATCH /api/profesionales/:id/block
 * - PATCH /api/profesionales/:id/unblock
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const profesionalModel = require('../src/models/profesional.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Profesionales Endpoints', () => {
  let adminToken;
  let secretariaToken;
  let profesionalToken;
  let profesionalUserId;
  let profesionalId;
  let testProfesionalId;
  let testUsuarioId;
  
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
      
      // Profesional (usuario con rol profesional)
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
    } catch (error) {
      console.error('Error creando usuarios para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar profesionales de prueba
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
  
  describe('GET /api/profesionales', () => {
    it('debería listar todos los profesionales (admin)', async () => {
      const response = await request(app)
        .get('/api/profesionales')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar profesionales por especialidad', async () => {
      // Usar encodeURIComponent para manejar caracteres especiales
      const especialidad = encodeURIComponent('Cardiología');
      const response = await request(app)
        .get(`/api/profesionales?especialidad=${especialidad}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].especialidad).toContain('Cardiología');
      }
    });
    
    it('debería filtrar profesionales bloqueados', async () => {
      const response = await request(app)
        .get('/api/profesionales?bloqueado=true')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      // Si hay resultados, todos deben estar bloqueados
      response.body.data.forEach(prof => {
        expect(prof.bloqueado).toBe(true);
      });
    });
    
    it('debería fallar sin permisos (secretaria sin permiso)', async () => {
      const response = await request(app)
        .get('/api/profesionales')
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/profesionales/blocked', () => {
    it('debería obtener profesionales bloqueados (admin)', async () => {
      const response = await request(app)
        .get('/api/profesionales/blocked')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .get('/api/profesionales/blocked')
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/profesionales/:id', () => {
    it('debería obtener un profesional por ID (admin)', async () => {
      const response = await request(app)
        .get(`/api/profesionales/${profesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(profesionalId);
      expect(response.body.data).toHaveProperty('usuario_id');
      expect(response.body.data).toHaveProperty('email');
    });
    
    it('debería retornar 404 si el profesional no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/profesionales/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/profesionales', () => {
    it('debería crear un nuevo profesional (admin)', async () => {
      // Primero crear un usuario con rol profesional
      const nuevoUsuario = await usuarioModel.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        nombre: 'Test',
        apellido: 'Profesional',
        telefono: '1234567890',
        rol: ROLES.PROFESIONAL,
        activo: true
      });
      testUsuarioId = nuevoUsuario.id;
      
      const nuevoProfesional = {
        usuario_id: nuevoUsuario.id,
        matricula: `MAT${Date.now()}`,
        especialidad: 'Pediatría',
        estado_pago: 'al_dia',
        bloqueado: false
      };
      
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(adminToken))
        .send(nuevoProfesional)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.matricula).toBe(nuevoProfesional.matricula);
      expect(response.body.data.especialidad).toBe(nuevoProfesional.especialidad);
      
      testProfesionalId = response.body.data.id;
    });
    
    it('debería fallar si el usuario no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(adminToken))
        .send({
          usuario_id: fakeUUID,
          matricula: 'MAT999',
          especialidad: 'Neurología'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el usuario no tiene rol profesional', async () => {
      // Crear usuario con rol secretaria
      const usuarioSecretaria = await usuarioModel.create({
        email: `secretaria${Date.now()}@example.com`,
        password: 'password123',
        nombre: 'Secretaria',
        apellido: 'Test',
        telefono: '1234567890',
        rol: ROLES.SECRETARIA,
        activo: true
      });
      
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(adminToken))
        .send({
          usuario_id: usuarioSecretaria.id,
          matricula: 'MAT888',
          especialidad: 'Neurología'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('rol "profesional"');
      
      // Limpiar
      await usuarioModel.delete(usuarioSecretaria.id);
    });
    
    it('debería fallar si el usuario ya tiene un profesional asociado', async () => {
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(adminToken))
        .send({
          usuario_id: profesionalUserId,
          matricula: 'MAT777',
          especialidad: 'Neurología'
        })
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ya tiene un profesional asociado');
    });
    
    it('debería fallar si la matrícula ya está en uso', async () => {
      const nuevoUsuario = await usuarioModel.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        nombre: 'Test',
        apellido: 'Profesional',
        telefono: '1234567890',
        rol: ROLES.PROFESIONAL,
        activo: true
      });
      
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(adminToken))
        .send({
          usuario_id: nuevoUsuario.id,
          matricula: 'MAT001', // Matrícula ya en uso
          especialidad: 'Neurología'
        })
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('matrícula ya está en uso');
      
      // Limpiar
      await usuarioModel.delete(nuevoUsuario.id);
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .post('/api/profesionales')
        .set(authHeaders(secretariaToken))
        .send({
          usuario_id: profesionalUserId,
          matricula: 'MAT666',
          especialidad: 'Neurología'
        })
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/profesionales/:id', () => {
    it('debería actualizar un profesional (admin)', async () => {
      const response = await request(app)
        .put(`/api/profesionales/${profesionalId}`)
        .set(authHeaders(adminToken))
        .send({
          especialidad: 'Cardiología Intervencionista',
          monto_mensual: 50000
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.especialidad).toBe('Cardiología Intervencionista');
      expect(response.body.data.monto_mensual).toBe('50000.00');
    });
    
    it('debería fallar si el profesional no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/profesionales/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .send({
          especialidad: 'Neurología'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si la matrícula ya está en uso', async () => {
      // Crear otro profesional con matrícula diferente
      const nuevoUsuario = await usuarioModel.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        nombre: 'Test',
        apellido: 'Profesional',
        telefono: '1234567890',
        rol: ROLES.PROFESIONAL,
        activo: true
      });
      
      const otroProfesional = await profesionalModel.create({
        usuario_id: nuevoUsuario.id,
        matricula: 'MAT999',
        especialidad: 'Dermatología'
      });
      
      // Intentar actualizar con matrícula existente
      const response = await request(app)
        .put(`/api/profesionales/${profesionalId}`)
        .set(authHeaders(adminToken))
        .send({
          matricula: 'MAT999'
        })
        .expect(409);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('matrícula ya está en uso');
      
      // Limpiar
      await profesionalModel.delete(otroProfesional.id);
      await usuarioModel.delete(nuevoUsuario.id);
    });
  });
  
  describe('PATCH /api/profesionales/:id/block', () => {
    it('debería bloquear un profesional (admin)', async () => {
      // Asegurarse de que el profesional no esté bloqueado
      if (profesionalId) {
        await profesionalModel.unblock(profesionalId);
      }
      
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/block`)
        .set(authHeaders(adminToken))
        .send({
          razon_bloqueo: 'Impago mensual'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.bloqueado).toBe(true);
      expect(response.body.data.razon_bloqueo).toBe('Impago mensual');
    });
    
    it('debería fallar si el profesional ya está bloqueado', async () => {
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/block`)
        .set(authHeaders(adminToken))
        .send({
          razon_bloqueo: 'Otra razón'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ya está bloqueado');
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/block`)
        .set(authHeaders(secretariaToken))
        .send({
          razon_bloqueo: 'Impago'
        })
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PATCH /api/profesionales/:id/unblock', () => {
    it('debería desbloquear un profesional (admin)', async () => {
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/unblock`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.bloqueado).toBe(false);
      expect(response.body.data.razon_bloqueo).toBeNull();
    });
    
    it('debería fallar si el profesional no está bloqueado', async () => {
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/unblock`)
        .set(authHeaders(adminToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('no está bloqueado');
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .patch(`/api/profesionales/${profesionalId}/unblock`)
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/profesionales/:id', () => {
    it('debería eliminar un profesional (admin)', async () => {
      // Crear profesional para eliminar
      const nuevoUsuario = await usuarioModel.create({
        email: `test${Date.now()}@example.com`,
        password: 'password123',
        nombre: 'Test',
        apellido: 'Profesional',
        telefono: '1234567890',
        rol: ROLES.PROFESIONAL,
        activo: true
      });
      
      const profesionalAEliminar = await profesionalModel.create({
        usuario_id: nuevoUsuario.id,
        matricula: `MAT${Date.now()}`,
        especialidad: 'Oftalmología'
      });
      
      const response = await request(app)
        .delete(`/api/profesionales/${profesionalAEliminar.id}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verificar que el profesional fue eliminado
      const profesionalEliminado = await profesionalModel.findById(profesionalAEliminar.id);
      expect(profesionalEliminado).toBeNull();
      
      // Limpiar usuario
      await usuarioModel.delete(nuevoUsuario.id);
    });
    
    it('debería fallar si el profesional no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/profesionales/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .delete(`/api/profesionales/${profesionalId}`)
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
});

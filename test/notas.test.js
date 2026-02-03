/**
 * NOTAS.TEST.JS - Tests de notas de paciente
 * 
 * Tests para los endpoints de notas:
 * - GET /api/notas
 * - GET /api/notas/paciente/:id
 * - GET /api/notas/profesional/:id
 * - GET /api/notas/:id
 * - POST /api/notas
 * - PUT /api/notas/:id
 * - DELETE /api/notas/:id
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const pacienteModel = require('../src/models/paciente.model');
const profesionalModel = require('../src/models/profesional.model');
const notaModel = require('../src/models/nota.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Notas Endpoints', () => {
  let adminToken;
  let profesionalToken;
  let secretariaToken;
  let jefeSecretariaToken;
  let profesionalUserId;
  let profesionalId;
  let testPacienteId;
  let testProfesionalId;
  let testUsuarioId;
  let testNotaId;
  
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
      
      // Crear un paciente de prueba
      const dni = String(Date.now()).slice(-8).padStart(8, '0');
      const testPaciente = await pacienteModel.create({
        dni: dni,
        nombre: 'Test',
        apellido: 'Paciente',
        activo: true
      });
      testPacienteId = testPaciente.id;
    } catch (error) {
      console.error('Error creando datos para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    if (testNotaId) {
      try {
        await notaModel.delete(testNotaId);
      } catch (error) {
        console.error('Error limpiando nota de prueba:', error);
      }
    }
    if (testPacienteId) {
      try {
        await pacienteModel.delete(testPacienteId);
      } catch (error) {
        console.error('Error limpiando paciente de prueba:', error);
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
  
  describe('GET /api/notas', () => {
    it('debería listar todas las notas (admin)', async () => {
      const response = await request(app)
        .get('/api/notas')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por paciente_id', async () => {
      const response = await request(app)
        .get(`/api/notas?paciente_id=${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por profesional_id', async () => {
      const response = await request(app)
        .get(`/api/notas?profesional_id=${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales (tienen permiso notas.leer)', async () => {
      const response = await request(app)
        .get('/api/notas')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería permitir acceso a secretarias (tienen permiso notas.leer)', async () => {
      const response = await request(app)
        .get('/api/notas')
        .set(authHeaders(secretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/notas')
        .expect(401);
    });
  });
  
  describe('GET /api/notas/paciente/:id', () => {
    it('debería obtener notas de un paciente', async () => {
      const response = await request(app)
        .get(`/api/notas/paciente/${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/notas/paciente/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/notas/profesional/:id', () => {
    it('debería obtener notas de un profesional', async () => {
      const response = await request(app)
        .get(`/api/notas/profesional/${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el profesional no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/notas/profesional/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/notas/:id', () => {
    it('debería obtener una nota por ID', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba para obtener por ID'
      });
      testNotaId = nota.id;
      
      const response = await request(app)
        .get(`/api/notas/${testNotaId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testNotaId);
    });
    
    it('debería retornar 404 si la nota no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/notas/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/notas', () => {
    it('debería crear una nueva nota (profesional)', async () => {
      const notaData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota creada por profesional de prueba'
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(profesionalToken))
        .send(notaData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.paciente_id).toBe(testPacienteId);
      expect(response.body.data.profesional_id).toBe(testProfesionalId);
      expect(response.body.data.contenido).toBe('Nota creada por profesional de prueba');
      
      // Limpiar
      if (response.body.data.id) {
        await notaModel.delete(response.body.data.id);
      }
    });
    
    it('debería crear una nota (secretaria)', async () => {
      const notaData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota creada por secretaria'
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(secretariaToken))
        .send(notaData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      // Limpiar
      if (response.body.data.id) {
        await notaModel.delete(response.body.data.id);
      }
    });
    
    it('debería fallar si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const notaData = {
        paciente_id: fakeId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba'
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(adminToken))
        .send(notaData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el paciente está inactivo', async () => {
      // Desactivar paciente
      await pacienteModel.deactivate(testPacienteId);
      
      const notaData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba'
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(adminToken))
        .send(notaData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Reactivar paciente
      await pacienteModel.activate(testPacienteId);
    });
    
    it('debería fallar si el profesional está bloqueado', async () => {
      // Bloquear profesional
      await profesionalModel.block(testProfesionalId, 'Test bloqueo');
      
      const notaData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba'
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(adminToken))
        .send(notaData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Desbloquear profesional
      await profesionalModel.unblock(testProfesionalId);
    });
    
    it('debería validar que el contenido no esté vacío', async () => {
      const notaData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: ''
      };
      
      const response = await request(app)
        .post('/api/notas')
        .set(authHeaders(adminToken))
        .send(notaData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/notas/:id', () => {
    it('debería actualizar una nota', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Contenido inicial'
      });
      
      const updateData = {
        contenido: 'Contenido actualizado'
      };
      
      const response = await request(app)
        .put(`/api/notas/${nota.id}`)
        .set(authHeaders(profesionalToken))
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.contenido).toBe('Contenido actualizado');
      
      // Limpiar
      await notaModel.delete(nota.id);
    });
    
    it('debería retornar 404 si la nota no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        contenido: 'Actualizado'
      };
      
      const response = await request(app)
        .put(`/api/notas/${fakeId}`)
        .set(authHeaders(adminToken))
        .send(updateData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/notas/:id', () => {
    it('debería eliminar una nota (jefe secretaria)', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota para eliminar'
      });
      
      const response = await request(app)
        .delete(`/api/notas/${nota.id}`)
        .set(authHeaders(jefeSecretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería eliminar una nota (admin)', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota para eliminar por admin'
      });
      
      const response = await request(app)
        .delete(`/api/notas/${nota.id}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería retornar 404 si la nota no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/notas/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería eliminar una nota (profesional tiene notas.eliminar)', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba para eliminar por profesional'
      });
      
      const response = await request(app)
        .delete(`/api/notas/${nota.id}`)
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin permisos (secretaria no tiene notas.eliminar)', async () => {
      // Crear nota de prueba
      const nota = await notaModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        contenido: 'Nota de prueba'
      });
      
      await request(app)
        .delete(`/api/notas/${nota.id}`)
        .set(authHeaders(secretariaToken))
        .expect(403);
      
      // Limpiar
      await notaModel.delete(nota.id);
    });
  });
});

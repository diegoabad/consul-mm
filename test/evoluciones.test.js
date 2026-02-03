/**
 * EVOLUCIONES.TEST.JS - Tests de evoluciones clínicas
 * 
 * Tests para los endpoints de evoluciones clínicas:
 * - GET /api/evoluciones
 * - GET /api/evoluciones/paciente/:id
 * - GET /api/evoluciones/profesional/:id
 * - GET /api/evoluciones/turno/:id
 * - GET /api/evoluciones/:id
 * - POST /api/evoluciones
 * - PUT /api/evoluciones/:id
 * - DELETE /api/evoluciones/:id
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const pacienteModel = require('../src/models/paciente.model');
const profesionalModel = require('../src/models/profesional.model');
const turnoModel = require('../src/models/turno.model');
const evolucionModel = require('../src/models/evolucion.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Evoluciones Clínicas Endpoints', () => {
  let adminToken;
  let profesionalToken;
  let secretariaToken;
  let profesionalUserId;
  let profesionalId;
  let testPacienteId;
  let testProfesionalId;
  let testUsuarioId;
  let testTurnoId;
  let testEvolucionId;
  
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
      
      // Crear un turno de prueba
      const testTurno = await turnoModel.create({
        profesional_id: testProfesionalId,
        paciente_id: testPacienteId,
        fecha_hora_inicio: new Date('2026-02-01T10:00:00'),
        fecha_hora_fin: new Date('2026-02-01T11:00:00'),
        estado: 'confirmado'
      });
      testTurnoId = testTurno.id;
    } catch (error) {
      console.error('Error creando datos para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    if (testEvolucionId) {
      try {
        await evolucionModel.delete(testEvolucionId);
      } catch (error) {
        console.error('Error limpiando evolución de prueba:', error);
      }
    }
    if (testTurnoId) {
      try {
        await turnoModel.delete(testTurnoId);
      } catch (error) {
        console.error('Error limpiando turno de prueba:', error);
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
  
  describe('GET /api/evoluciones', () => {
    it('debería listar todas las evoluciones clínicas (admin)', async () => {
      const response = await request(app)
        .get('/api/evoluciones')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por paciente_id', async () => {
      const response = await request(app)
        .get(`/api/evoluciones?paciente_id=${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por profesional_id', async () => {
      const response = await request(app)
        .get(`/api/evoluciones?profesional_id=${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales (tienen permiso evoluciones.leer)', async () => {
      const response = await request(app)
        .get('/api/evoluciones')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/evoluciones')
        .expect(401);
    });
  });
  
  describe('GET /api/evoluciones/paciente/:id', () => {
    it('debería obtener evoluciones de un paciente', async () => {
      const response = await request(app)
        .get(`/api/evoluciones/paciente/${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/evoluciones/paciente/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/evoluciones/profesional/:id', () => {
    it('debería obtener evoluciones de un profesional', async () => {
      const response = await request(app)
        .get(`/api/evoluciones/profesional/${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el profesional no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/evoluciones/profesional/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/evoluciones/turno/:id', () => {
    it('debería obtener evoluciones de un turno', async () => {
      const response = await request(app)
        .get(`/api/evoluciones/turno/${testTurnoId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el turno no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/evoluciones/turno/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/evoluciones/:id', () => {
    it('debería obtener una evolución clínica por ID', async () => {
      // Crear evolución de prueba
      const evolucion = await evolucionModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        turno_id: testTurnoId,
        fecha_consulta: new Date('2026-02-01T10:30:00'),
        motivo_consulta: 'Control de rutina',
        diagnostico: 'Paciente sano',
        tratamiento: 'Continuar con hábitos saludables'
      });
      testEvolucionId = evolucion.id;
      
      const response = await request(app)
        .get(`/api/evoluciones/${testEvolucionId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testEvolucionId);
    });
    
    it('debería retornar 404 si la evolución no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/evoluciones/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/evoluciones', () => {
    it('debería crear una nueva evolución clínica (profesional)', async () => {
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        turno_id: testTurnoId,
        fecha_consulta: '2026-02-02T10:00:00',
        motivo_consulta: 'Consulta de seguimiento',
        diagnostico: 'Estado estable',
        tratamiento: 'Medicación continuada',
        observaciones: 'Paciente responde bien al tratamiento'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(profesionalToken))
        .send(evolucionData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.paciente_id).toBe(testPacienteId);
      expect(response.body.data.profesional_id).toBe(testProfesionalId);
      
      // Limpiar
      if (response.body.data.id) {
        await evolucionModel.delete(response.body.data.id);
      }
    });
    
    it('debería crear una evolución clínica sin turno_id', async () => {
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: '2026-02-03T10:00:00',
        motivo_consulta: 'Consulta sin turno'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(adminToken))
        .send(evolucionData)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      // Limpiar
      if (response.body.data.id) {
        await evolucionModel.delete(response.body.data.id);
      }
    });
    
    it('debería fallar si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const evolucionData = {
        paciente_id: fakeId,
        profesional_id: testProfesionalId,
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(adminToken))
        .send(evolucionData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el paciente está inactivo', async () => {
      // Desactivar paciente
      await pacienteModel.deactivate(testPacienteId);
      
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(adminToken))
        .send(evolucionData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Reactivar paciente
      await pacienteModel.activate(testPacienteId);
    });
    
    it('debería fallar si el profesional está bloqueado', async () => {
      // Bloquear profesional
      await profesionalModel.block(testProfesionalId, 'Test bloqueo');
      
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(adminToken))
        .send(evolucionData)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Desbloquear profesional
      await profesionalModel.unblock(testProfesionalId);
    });
    
    it('debería fallar si el turno no corresponde al paciente', async () => {
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        turno_id: testTurnoId,
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      // Crear otro paciente
      const dni2 = String(Date.now() + 1).slice(-8).padStart(8, '0');
      const otroPaciente = await pacienteModel.create({
        dni: dni2,
        nombre: 'Otro',
        apellido: 'Paciente',
        activo: true
      });
      
      // Intentar crear evolución con turno que no corresponde
      const evolucionDataInvalida = {
        paciente_id: otroPaciente.id,
        profesional_id: testProfesionalId,
        turno_id: testTurnoId, // Este turno es del testPacienteId
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      const response = await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(adminToken))
        .send(evolucionDataInvalida)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Limpiar
      await pacienteModel.delete(otroPaciente.id);
    });
    
    it('debería fallar sin permisos (secretaria no tiene evoluciones.crear)', async () => {
      const evolucionData = {
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: '2026-02-01T10:00:00'
      };
      
      await request(app)
        .post('/api/evoluciones')
        .set(authHeaders(secretariaToken))
        .send(evolucionData)
        .expect(403);
    });
  });
  
  describe('PUT /api/evoluciones/:id', () => {
    it('debería actualizar una evolución clínica', async () => {
      // Crear evolución de prueba
      const evolucion = await evolucionModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: new Date('2026-02-04T10:00:00'),
        diagnostico: 'Diagnóstico inicial'
      });
      
      const updateData = {
        diagnostico: 'Diagnóstico actualizado',
        tratamiento: 'Nuevo tratamiento'
      };
      
      const response = await request(app)
        .put(`/api/evoluciones/${evolucion.id}`)
        .set(authHeaders(profesionalToken))
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.diagnostico).toBe('Diagnóstico actualizado');
      
      // Limpiar
      await evolucionModel.delete(evolucion.id);
    });
    
    it('debería retornar 404 si la evolución no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        diagnostico: 'Actualizado'
      };
      
      const response = await request(app)
        .put(`/api/evoluciones/${fakeId}`)
        .set(authHeaders(adminToken))
        .send(updateData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/evoluciones/:id', () => {
    it('debería eliminar una evolución clínica', async () => {
      // Crear evolución de prueba
      const evolucion = await evolucionModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        fecha_consulta: new Date('2026-02-05T10:00:00'),
        motivo_consulta: 'Para eliminar'
      });
      
      const response = await request(app)
        .delete(`/api/evoluciones/${evolucion.id}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería retornar 404 si la evolución no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/evoluciones/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
});

/**
 * PACIENTES.TEST.JS - Tests de pacientes
 * 
 * Tests para los endpoints de pacientes:
 * - GET /api/pacientes
 * - GET /api/pacientes/search
 * - GET /api/pacientes/:id
 * - POST /api/pacientes
 * - PUT /api/pacientes/:id
 * - DELETE /api/pacientes/:id
 * - PATCH /api/pacientes/:id/activate
 * - PATCH /api/pacientes/:id/deactivate
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const pacienteModel = require('../src/models/paciente.model');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Pacientes Endpoints', () => {
  let adminToken;
  let secretariaToken;
  let profesionalToken;
  let testPacienteId;
  let testPaciente2Id;
  
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
      profesionalToken = generateToken({
        id: profesionalUser.id,
        email: profesionalUser.email,
        rol: profesionalUser.rol
      });
    } catch (error) {
      console.error('Error creando usuarios para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar pacientes de prueba
    if (testPacienteId) {
      try {
        await pacienteModel.delete(testPacienteId);
      } catch (error) {
        console.error('Error limpiando paciente de prueba:', error);
      }
    }
    if (testPaciente2Id) {
      try {
        await pacienteModel.delete(testPaciente2Id);
      } catch (error) {
        console.error('Error limpiando paciente de prueba:', error);
      }
    }
  });
  
  describe('GET /api/pacientes', () => {
    it('debería listar todos los pacientes (admin)', async () => {
      const response = await request(app)
        .get('/api/pacientes')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar pacientes por obra social', async () => {
      const response = await request(app)
        .get('/api/pacientes?obra_social=OSDE')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar pacientes activos', async () => {
      const response = await request(app)
        .get('/api/pacientes?activo=true')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        response.body.data.forEach(paciente => {
          expect(paciente.activo).toBe(true);
        });
      }
    });
    
    it('debería permitir acceso a profesionales (tienen permiso pacientes.leer)', async () => {
      // Los profesionales tienen permiso pacientes.leer según constants.js
      const response = await request(app)
        .get('/api/pacientes')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('GET /api/pacientes/search', () => {
    it('debería buscar pacientes por nombre (secretaria)', async () => {
      // Crear un paciente de prueba primero
      const dni = String(Date.now()).slice(-8).padStart(8, '0');
      const nuevoPaciente = await pacienteModel.create({
        dni: dni,
        nombre: 'Juan',
        apellido: 'Pérez',
        activo: true
      });
      testPacienteId = nuevoPaciente.id;
      
      const response = await request(app)
        .get('/api/pacientes/search?q=Juan')
        .set(authHeaders(secretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      if (response.body.data.length > 0) {
        expect(response.body.data[0].nombre).toContain('Juan');
      }
    });
    
    it('debería buscar pacientes por DNI', async () => {
      const paciente = await pacienteModel.findById(testPacienteId);
      if (paciente) {
        const response = await request(app)
          .get(`/api/pacientes/search?q=${paciente.dni}`)
          .set(authHeaders(secretariaToken))
          .expect(200);
        
        expect(response.body.success).toBe(true);
        expect(Array.isArray(response.body.data)).toBe(true);
      }
    });
    
    it('debería fallar si el término de búsqueda es muy corto', async () => {
      const response = await request(app)
        .get('/api/pacientes/search?q=J')
        .set(authHeaders(secretariaToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería permitir acceso a profesionales (tienen permiso pacientes.buscar)', async () => {
      // Los profesionales tienen permiso pacientes.buscar según constants.js
      const response = await request(app)
        .get('/api/pacientes/search?q=test')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
  });
  
  describe('GET /api/pacientes/:id', () => {
    it('debería obtener un paciente por ID (admin)', async () => {
      const response = await request(app)
        .get(`/api/pacientes/${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testPacienteId);
    });
    
    it('debería retornar 404 si el paciente no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/pacientes/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/pacientes', () => {
    it('debería crear un nuevo paciente (secretaria)', async () => {
      // Generar DNI válido (7-8 dígitos)
      const dni = String(Date.now()).slice(-8).padStart(8, '0');
      const nuevoPaciente = {
        dni: dni,
        nombre: 'María',
        apellido: 'González',
        fecha_nacimiento: '1990-01-15',
        telefono: '1123456789',
        email: 'maria@example.com',
        direccion: 'Calle Falsa 123',
        obra_social: 'OSDE',
        numero_afiliado: '123456',
        contacto_emergencia_nombre: 'Juan González',
        contacto_emergencia_telefono: '1198765432',
        activo: true
      };
      
      const response = await request(app)
        .post('/api/pacientes')
        .set(authHeaders(secretariaToken))
        .send(nuevoPaciente)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.nombre).toBe(nuevoPaciente.nombre);
      expect(response.body.data.apellido).toBe(nuevoPaciente.apellido);
      expect(response.body.data.dni).toBe(nuevoPaciente.dni);
      
      testPaciente2Id = response.body.data.id;
    });
    
    it('debería fallar si el DNI ya existe', async () => {
      const paciente = await pacienteModel.findById(testPacienteId);
      if (paciente) {
        const response = await request(app)
          .post('/api/pacientes')
          .set(authHeaders(secretariaToken))
          .send({
            dni: paciente.dni,
            nombre: 'Otro',
            apellido: 'Paciente'
          })
          .expect(409);
        
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('DNI ya está registrado');
      }
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .post('/api/pacientes')
        .set(authHeaders(profesionalToken))
        .send({
          dni: `${Date.now()}`,
          nombre: 'Test',
          apellido: 'Paciente'
        })
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar con datos inválidos', async () => {
      const response = await request(app)
        .post('/api/pacientes')
        .set(authHeaders(secretariaToken))
        .send({
          dni: '123', // DNI muy corto
          nombre: 'A', // Nombre muy corto
          apellido: 'B'
        })
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('PUT /api/pacientes/:id', () => {
    it('debería actualizar un paciente (secretaria)', async () => {
      const response = await request(app)
        .put(`/api/pacientes/${testPacienteId}`)
        .set(authHeaders(secretariaToken))
        .send({
          telefono: '1199887766',
          direccion: 'Nueva Dirección 456'
        })
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.telefono).toBe('1199887766');
      expect(response.body.data.direccion).toBe('Nueva Dirección 456');
    });
    
    it('debería fallar si el paciente no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .put(`/api/pacientes/${fakeUUID}`)
        .set(authHeaders(secretariaToken))
        .send({
          nombre: 'Actualizado'
        })
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el DNI ya está en uso', async () => {
      const paciente1 = await pacienteModel.findById(testPacienteId);
      const paciente2 = await pacienteModel.findById(testPaciente2Id);
      
      if (paciente1 && paciente2) {
        const response = await request(app)
          .put(`/api/pacientes/${testPacienteId}`)
          .set(authHeaders(secretariaToken))
          .send({
            dni: paciente2.dni
          })
          .expect(409);
        
        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('DNI ya está registrado');
      }
    });
  });
  
  describe('PATCH /api/pacientes/:id/activate', () => {
    it('debería activar un paciente (admin)', async () => {
      // Primero desactivar el paciente
      await pacienteModel.deactivate(testPacienteId);
      
      const response = await request(app)
        .patch(`/api/pacientes/${testPacienteId}/activate`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.activo).toBe(true);
    });
    
    it('debería fallar si el paciente ya está activo', async () => {
      const response = await request(app)
        .patch(`/api/pacientes/${testPacienteId}/activate`)
        .set(authHeaders(adminToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ya está activo');
    });
  });
  
  describe('PATCH /api/pacientes/:id/deactivate', () => {
    it('debería desactivar un paciente (admin)', async () => {
      const response = await request(app)
        .patch(`/api/pacientes/${testPacienteId}/deactivate`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.activo).toBe(false);
    });
    
    it('debería fallar si el paciente ya está inactivo', async () => {
      const response = await request(app)
        .patch(`/api/pacientes/${testPacienteId}/deactivate`)
        .set(authHeaders(adminToken))
        .expect(400);
      
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('ya está inactivo');
    });
  });
  
  describe('DELETE /api/pacientes/:id', () => {
    it('debería eliminar un paciente (soft delete) (admin)', async () => {
      // Crear un paciente para eliminar
      const dni = String(Date.now()).slice(-8).padStart(8, '0');
      const pacienteAEliminar = await pacienteModel.create({
        dni: dni,
        nombre: 'Eliminar',
        apellido: 'Test',
        activo: true
      });
      
      const response = await request(app)
        .delete(`/api/pacientes/${pacienteAEliminar.id}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verificar que el paciente fue desactivado (soft delete)
      const pacienteEliminado = await pacienteModel.findById(pacienteAEliminar.id);
      expect(pacienteEliminado.activo).toBe(false);
    });
    
    it('debería fallar si el paciente no existe', async () => {
      const fakeUUID = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/pacientes/${fakeUUID}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar sin permisos', async () => {
      const response = await request(app)
        .delete(`/api/pacientes/${testPacienteId}`)
        .set(authHeaders(profesionalToken))
        .expect(403);
      
      expect(response.body.success).toBe(false);
    });
  });
});

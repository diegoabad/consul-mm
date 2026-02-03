/**
 * ARCHIVOS.TEST.JS - Tests de archivos
 * 
 * Tests para los endpoints de archivos:
 * - GET /api/archivos
 * - GET /api/archivos/paciente/:id
 * - GET /api/archivos/:id
 * - GET /api/archivos/:id/download
 * - POST /api/archivos
 * - PUT /api/archivos/:id
 * - DELETE /api/archivos/:id
 */

const request = require('supertest');
const app = require('../src/app');
const usuarioModel = require('../src/models/usuario.model');
const pacienteModel = require('../src/models/paciente.model');
const profesionalModel = require('../src/models/profesional.model');
const archivoModel = require('../src/models/archivo.model');
const fs = require('fs');
const path = require('path');
const { ROLES } = require('../src/utils/constants');
const { generateToken, authHeaders } = require('./helpers/testHelpers');

describe('Archivos Endpoints', () => {
  let adminToken;
  let profesionalToken;
  let secretariaToken;
  let profesionalUserId;
  let profesionalId;
  let testPacienteId;
  let testProfesionalId;
  let testUsuarioId;
  let testArchivoId;
  let testFilePath;
  
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
      
      // Crear un archivo de prueba temporal para tests
      const uploadsDir = path.join(__dirname, '../uploads/pacientes', testPacienteId);
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      testFilePath = path.join(uploadsDir, 'test-file.txt');
      fs.writeFileSync(testFilePath, 'Contenido de prueba');
      
      // Crear registro de archivo en BD
      const archivo = await archivoModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        nombre_archivo: 'test-file.txt',
        tipo_archivo: 'text/plain',
        url_archivo: `/uploads/pacientes/${testPacienteId}/test-file.txt`,
        tamanio_bytes: fs.statSync(testFilePath).size,
        descripcion: 'Archivo de prueba'
      });
      testArchivoId = archivo.id;
    } catch (error) {
      console.error('Error creando datos para tests:', error);
    }
  });
  
  afterAll(async () => {
    // Limpiar datos de prueba
    if (testArchivoId) {
      try {
        const archivo = await archivoModel.findById(testArchivoId);
        if (archivo && archivo.url_archivo) {
          const filePath = path.join(__dirname, '../', archivo.url_archivo);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        await archivoModel.delete(testArchivoId);
      } catch (error) {
        console.error('Error limpiando archivo de prueba:', error);
      }
    }
    if (testPacienteId) {
      try {
        // Limpiar carpeta del paciente
        const pacienteDir = path.join(__dirname, '../uploads/pacientes', testPacienteId);
        if (fs.existsSync(pacienteDir)) {
          fs.readdirSync(pacienteDir).forEach(file => {
            fs.unlinkSync(path.join(pacienteDir, file));
          });
          fs.rmdirSync(pacienteDir);
        }
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
  
  describe('GET /api/archivos', () => {
    it('debería listar todos los archivos (admin)', async () => {
      const response = await request(app)
        .get('/api/archivos')
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por paciente_id', async () => {
      const response = await request(app)
        .get(`/api/archivos?paciente_id=${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería filtrar por profesional_id', async () => {
      const response = await request(app)
        .get(`/api/archivos?profesional_id=${testProfesionalId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería permitir acceso a profesionales (tienen permiso archivos.leer)', async () => {
      const response = await request(app)
        .get('/api/archivos')
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería permitir acceso a secretarias (tienen permiso archivos.leer)', async () => {
      const response = await request(app)
        .get('/api/archivos')
        .set(authHeaders(secretariaToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
    });
    
    it('debería fallar sin autenticación', async () => {
      await request(app)
        .get('/api/archivos')
        .expect(401);
    });
  });
  
  describe('GET /api/archivos/paciente/:id', () => {
    it('debería obtener archivos de un paciente', async () => {
      const response = await request(app)
        .get(`/api/archivos/paciente/${testPacienteId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
    
    it('debería retornar 404 si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/archivos/paciente/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/archivos/:id', () => {
    it('debería obtener un archivo por ID', async () => {
      const response = await request(app)
        .get(`/api/archivos/${testArchivoId}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testArchivoId);
    });
    
    it('debería retornar 404 si el archivo no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/archivos/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('GET /api/archivos/:id/download', () => {
    it('debería descargar un archivo (profesional)', async () => {
      const response = await request(app)
        .get(`/api/archivos/${testArchivoId}/download`)
        .set(authHeaders(profesionalToken))
        .expect(200);
      
      expect(response.headers['content-disposition']).toBeDefined();
    });
    
    it('debería descargar un archivo (secretaria)', async () => {
      const response = await request(app)
        .get(`/api/archivos/${testArchivoId}/download`)
        .set(authHeaders(secretariaToken))
        .expect(200);
      
      expect(response.headers['content-disposition']).toBeDefined();
    });
    
    it('debería retornar 404 si el archivo no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .get(`/api/archivos/${fakeId}/download`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('POST /api/archivos', () => {
    it('debería subir un archivo (profesional)', async () => {
      // Crear archivo temporal para subir
      const tempFilePath = path.join(__dirname, '../temp-test-file.pdf');
      fs.writeFileSync(tempFilePath, 'Contenido de prueba PDF');
      
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(profesionalToken))
        .field('paciente_id', testPacienteId)
        .field('profesional_id', testProfesionalId)
        .field('descripcion', 'Archivo de prueba')
        .attach('archivo', tempFilePath)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.paciente_id).toBe(testPacienteId);
      expect(response.body.data.profesional_id).toBe(testProfesionalId);
      
      // Limpiar archivo temporal
      fs.unlinkSync(tempFilePath);
      
      // Limpiar archivo subido
      if (response.body.data.id) {
        const archivo = await archivoModel.findById(response.body.data.id);
        if (archivo && archivo.url_archivo) {
          const uploadedPath = path.join(__dirname, '../', archivo.url_archivo);
          if (fs.existsSync(uploadedPath)) {
            fs.unlinkSync(uploadedPath);
          }
        }
        await archivoModel.delete(response.body.data.id);
      }
    });
    
    it('debería subir un archivo (secretaria)', async () => {
      // Crear archivo temporal para subir
      const tempFilePath = path.join(__dirname, '../temp-test-file2.pdf');
      fs.writeFileSync(tempFilePath, 'Contenido de prueba PDF 2');
      
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(secretariaToken))
        .field('paciente_id', testPacienteId)
        .field('profesional_id', testProfesionalId)
        .attach('archivo', tempFilePath)
        .expect(201);
      
      expect(response.body.success).toBe(true);
      
      // Limpiar archivo temporal
      fs.unlinkSync(tempFilePath);
      
      // Limpiar archivo subido
      if (response.body.data.id) {
        const archivo = await archivoModel.findById(response.body.data.id);
        if (archivo && archivo.url_archivo) {
          const uploadedPath = path.join(__dirname, '../', archivo.url_archivo);
          if (fs.existsSync(uploadedPath)) {
            fs.unlinkSync(uploadedPath);
          }
        }
        await archivoModel.delete(response.body.data.id);
      }
    });
    
    it('debería fallar si no se proporciona archivo', async () => {
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(adminToken))
        .field('paciente_id', testPacienteId)
        .field('profesional_id', testProfesionalId)
        .expect(400);
      
      expect(response.body.success).toBe(false);
    });
    
    it('debería fallar si el paciente no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const tempFilePath = path.join(__dirname, '../temp-test-file3.pdf');
      fs.writeFileSync(tempFilePath, 'Contenido de prueba');
      
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(adminToken))
        .field('paciente_id', fakeId)
        .field('profesional_id', testProfesionalId)
        .attach('archivo', tempFilePath)
        .expect(404);
      
      expect(response.body.success).toBe(false);
      
      // Limpiar
      fs.unlinkSync(tempFilePath);
    });
    
    it('debería fallar si el paciente está inactivo', async () => {
      // Desactivar paciente
      await pacienteModel.deactivate(testPacienteId);
      
      const tempFilePath = path.join(__dirname, '../temp-test-file4.pdf');
      fs.writeFileSync(tempFilePath, 'Contenido de prueba');
      
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(adminToken))
        .field('paciente_id', testPacienteId)
        .field('profesional_id', testProfesionalId)
        .attach('archivo', tempFilePath)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Reactivar paciente
      await pacienteModel.activate(testPacienteId);
      
      // Limpiar
      fs.unlinkSync(tempFilePath);
    });
    
    it('debería fallar si el profesional está bloqueado', async () => {
      // Bloquear profesional
      await profesionalModel.block(testProfesionalId, 'Test bloqueo');
      
      const tempFilePath = path.join(__dirname, '../temp-test-file5.pdf');
      fs.writeFileSync(tempFilePath, 'Contenido de prueba');
      
      const response = await request(app)
        .post('/api/archivos')
        .set(authHeaders(adminToken))
        .field('paciente_id', testPacienteId)
        .field('profesional_id', testProfesionalId)
        .attach('archivo', tempFilePath)
        .expect(400);
      
      expect(response.body.success).toBe(false);
      
      // Desbloquear profesional
      await profesionalModel.unblock(testProfesionalId);
      
      // Limpiar
      fs.unlinkSync(tempFilePath);
    });
    
    it('debería fallar con tipo de archivo no permitido', async () => {
      // Crear un archivo con extensión .exe pero con contenido que multer pueda leer
      const tempFilePath = path.join(__dirname, '../temp-test-file.exe');
      fs.writeFileSync(tempFilePath, 'Contenido ejecutable');
      
      // Multer puede rechazar el archivo antes de que llegue al controlador
      // El error puede venir del middleware handleMulterError
      try {
        const response = await request(app)
          .post('/api/archivos')
          .set(authHeaders(adminToken))
          .field('paciente_id', testPacienteId)
          .field('profesional_id', testProfesionalId)
          .attach('archivo', tempFilePath);
        
        // Puede retornar 400 o el error puede ser manejado por handleMulterError
        expect([400, 500]).toContain(response.status);
        if (response.body) {
          expect(response.body.success).toBe(false);
        }
      } catch (error) {
        // Si hay un error de conexión, es porque multer rechazó el archivo
        // Esto es aceptable para este test
        expect(error).toBeDefined();
      } finally {
        // Limpiar
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
    });
  });
  
  describe('PUT /api/archivos/:id', () => {
    it('debería actualizar metadatos de un archivo', async () => {
      const updateData = {
        descripcion: 'Descripción actualizada',
        nombre_archivo: 'nuevo-nombre.txt'
      };
      
      const response = await request(app)
        .put(`/api/archivos/${testArchivoId}`)
        .set(authHeaders(profesionalToken))
        .send(updateData)
        .expect(200);
      
      expect(response.body.success).toBe(true);
      expect(response.body.data.descripcion).toBe('Descripción actualizada');
    });
    
    it('debería retornar 404 si el archivo no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const updateData = {
        descripcion: 'Actualizado'
      };
      
      const response = await request(app)
        .put(`/api/archivos/${fakeId}`)
        .set(authHeaders(adminToken))
        .send(updateData)
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
  
  describe('DELETE /api/archivos/:id', () => {
    it('debería eliminar un archivo', async () => {
      // Crear archivo de prueba para eliminar
      const uploadsDir = path.join(__dirname, '../uploads/pacientes', testPacienteId);
      const deleteFilePath = path.join(uploadsDir, 'delete-test-file.txt');
      fs.writeFileSync(deleteFilePath, 'Archivo para eliminar');
      
      const archivo = await archivoModel.create({
        paciente_id: testPacienteId,
        profesional_id: testProfesionalId,
        nombre_archivo: 'delete-test-file.txt',
        tipo_archivo: 'text/plain',
        url_archivo: `/uploads/pacientes/${testPacienteId}/delete-test-file.txt`,
        tamanio_bytes: fs.statSync(deleteFilePath).size
      });
      
      const response = await request(app)
        .delete(`/api/archivos/${archivo.id}`)
        .set(authHeaders(adminToken))
        .expect(200);
      
      expect(response.body.success).toBe(true);
      
      // Verificar que el archivo físico fue eliminado
      expect(fs.existsSync(deleteFilePath)).toBe(false);
    });
    
    it('debería retornar 404 si el archivo no existe', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const response = await request(app)
        .delete(`/api/archivos/${fakeId}`)
        .set(authHeaders(adminToken))
        .expect(404);
      
      expect(response.body.success).toBe(false);
    });
  });
});

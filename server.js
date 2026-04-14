/**
 * SERVER.JS - Punto de entrada principal del servidor
 * 
 * Este archivo es el punto de entrada de la aplicación.
 * Cargamos .env desde la carpeta api para que RESEND_API_KEY y demás variables
 * se lean siempre de api/.env, sin importar desde qué directorio se ejecute.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
// Zona horaria del consultorio (agenda, validaciones con fecha “local”, logs). Render: definir TZ o queda este default.
process.env.TZ = process.env.TZ || 'America/Argentina/Buenos_Aires';

const { isEncryptionEnabled } = require('./src/utils/encryption');
// Una sola derivación scrypt al arrancar (si hay DATA_ENCRYPTION_KEY); evita picos en el primer request con muchos cifrados/descifrados.
isEncryptionEnabled();

const cron = require('node-cron');
const logger = require('./src/utils/logger');
const { bootstrap } = require('./src/config/bootstrap-db');
const { syncEncryptExistingData } = require('./src/utils/sync-encrypt-existing');
const app = require('./src/app');
const { query, closePool } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

// Cron: sync local → Storage una vez al día (ej. 3:00 AM). Variable opcional: CRON_SYNC_STORAGE (ej. "0 3 * * *")
const CRON_SYNC_STORAGE = process.env.CRON_SYNC_STORAGE || '0 3 * * *';
// Cron: recordatorios WhatsApp cada 30 minutos. Variable opcional: CRON_RECORDATORIOS (ej. "*/30 * * * *")
const CRON_RECORDATORIOS = process.env.CRON_RECORDATORIOS || '*/15 * * * *';

// Verificar conexión a la base de datos
const testConnection = async () => {
  try {
    await query('SELECT NOW()');
    logger.info('Conexión a la base de datos establecida correctamente');
  } catch (error) {
    logger.error('Error conectando a la base de datos:', error);
    process.exit(1);
  }
};

// Iniciar servidor
const startServer = async () => {
  try {
    // Inicializar DB si está vacía: schema, migraciones pendientes, usuario admin (si ADMIN_EMAIL/ADMIN_PASSWORD)
    await bootstrap();
    logger.info('Bootstrap completado; migraciones verificadas al arrancar.');
    // Verificar conexión a la base de datos
    await testConnection();
    // Cifrar datos existentes en texto plano (pacientes, evoluciones, notas, turnos)
    syncEncryptExistingData().catch((e) => logger.error('Sync encrypt al arranque:', e));
    
    // Iniciar servidor
    const archivosController = require('./src/controllers/archivos.controller');
    const server = app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);
      logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
      // Una vez al arranque: subir a Storage lo que esté solo en local y borrar de disco (local = respaldo temporal)
      setTimeout(() => {
        archivosController.syncAllLocalToStorage().catch(e => logger.error('Sync local→Storage al arranque:', e));
      }, 10000);
      // Cron diario: local → Storage (vaciar respaldo local). Por defecto todos los días a las 3:00
      const cronJob = cron.schedule(CRON_SYNC_STORAGE, () => {
        logger.info('Cron: ejecutando sync local→Storage (respaldo → Azure)');
        archivosController.syncAllLocalToStorage().catch(e => logger.error('Sync local→Storage (cron):', e));
      });

      // Cron de recordatorios WhatsApp: cada 30 minutos
      const { procesarRecordatorios } = require('./src/services/recordatorio.service');
      const cronRecordatorios = cron.schedule(CRON_RECORDATORIOS, () => {
        logger.info('Cron: procesando recordatorios WhatsApp...');
        procesarRecordatorios().catch(e => logger.error('Cron recordatorios WhatsApp:', e));
      });

      server.on('close', () => { cronJob.stop(); cronRecordatorios.stop(); });
    });
    
    // Manejo de cierre graceful
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} recibido. Cerrando servidor...`);
      
      server.close(async () => {
        logger.info('Servidor HTTP cerrado');
        
        try {
          await closePool();
          logger.info('Pool de conexiones cerrado');
          process.exit(0);
        } catch (error) {
          logger.error('Error cerrando pool:', error);
          process.exit(1);
        }
      });
      
      // Forzar cierre después de 10 segundos
      setTimeout(() => {
        logger.error('Forzando cierre del servidor...');
        process.exit(1);
      }, 10000);
    };
    
    // Escuchar señales de terminación
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
    // Manejo de errores no capturados
    process.on('uncaughtException', (error) => {
      logger.error('Excepción no capturada:', error);
      gracefulShutdown('uncaughtException');
    });
    
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Promesa rechazada no manejada:', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });
    
  } catch (error) {
    logger.error('Error iniciando servidor:', error);
    process.exit(1);
  }
};

startServer();

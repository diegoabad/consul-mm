/**
 * SERVER.JS - Punto de entrada principal del servidor
 * 
 * Este archivo es el punto de entrada de la aplicación.
 */

require('dotenv').config();
const app = require('./src/app');
const { query, closePool } = require('./src/config/database');
const logger = require('./src/utils/logger');

const PORT = process.env.PORT || 5000;

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
    // Verificar conexión a la base de datos
    await testConnection();
    
    // Iniciar servidor
    const server = app.listen(PORT, () => {
      logger.info(`Servidor iniciado en puerto ${PORT}`);
      logger.info(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
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

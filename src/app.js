/**
 * APP.JS - Configuración principal de Express
 * 
 * Este archivo configura la aplicación Express con todos los middlewares
 * y rutas necesarias para la API.
 */

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
const routes = require('./routes/index');
const errorHandler = require('./middlewares/errorHandler.middleware');
const logger = require('./utils/logger');

const app = express();

// Middlewares de seguridad (Helmet permite cross-origin para API consumida por SPA en otro dominio)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// CORS: permitir frontend en Netlify y localhost. En Render definir CORS_ORIGIN (orígenes separados por coma).
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  : null;
app.use(cors({
  origin: corsOrigins && corsOrigins.length > 0
    ? (origin, cb) => {
        if (!origin) return cb(null, true);
        if (corsOrigins.includes(origin)) return cb(null, true);
        return cb(null, false);
      }
    : true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Logger HTTP
app.use(morgan('combined', {
  stream: {
    write: (message) => logger.info(message.trim())
  }
}));

// Rate limiting (por IP; aumentado para uso normal de la SPA con muchas peticiones)
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutos
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde'
});
app.use('/api/', limiter);

// Parse JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Rutas
app.use('/api', routes);

// Middleware de error handler (debe ir al final)
app.use(errorHandler);

module.exports = app;

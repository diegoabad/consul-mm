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

// Trust proxy: detrás de Render / nginx (X-Forwarded-For para rate-limit)
app.set('trust proxy', 1);

// ─── CORS: va PRIMERO (antes de Helmet, body parser y rutas) ─────────────────
// No pongas express.json() ni router antes de esto: el preflight OPTIONS debe
// recibir cabeceras CORS sin pasar por parsers ni rutas que no existan para OPTIONS.
//
// Orígenes: CORS_ORIGIN o ALLOWED_ORIGINS (mismo formato, coma-separados).
// En Render: CORS_ORIGIN=https://tu-app.netlify.app,http://localhost:5173
// CORS_NETLIFY_PREVIEWS=true → también permite https://*.netlify.app
//
// Importante: usar array o true en `origin`, no un callback que haga cb(null, false)
// al denegar: en cors@2 eso hace next() y el OPTIONS cae en 404 sin cabeceras CORS.
const originsRaw = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '';
const corsOrigins = originsRaw
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const netlifyOriginRegex = /^https:\/\/[a-zA-Z0-9-]+\.netlify\.app$/;
const corsOriginValue =
  corsOrigins.length === 0
    ? true
    : process.env.CORS_NETLIFY_PREVIEWS === 'true'
      ? [...corsOrigins, netlifyOriginRegex]
      : corsOrigins;

const corsOptions = {
  origin: corsOriginValue,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middlewares de seguridad (Helmet permite cross-origin para API consumida por SPA en otro dominio)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Diagnóstico en Render: health en la raíz (si /api/* da 404, el Root Directory o el start no apuntan a esta API)
app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'consultorio-medico-api',
    health: '/api/health',
    hint: 'Si ves esto pero /api/health da 404, revisá en Render Root Directory=api y Start Command: npm start',
  });
});
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'consultorio-medico-api',
    message: 'Usá GET /api/health para estado de migraciones',
  });
});

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
  message: 'Demasiadas solicitudes desde esta IP, por favor intenta más tarde',
  skip: (req) => req.method === 'OPTIONS',
});
app.use('/api/', limiter);

// Parse JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Rutas
app.use('/api', routes);

// Middleware de error handler (debe ir al final)
app.use(errorHandler);

module.exports = app;

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
const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middlewares/errorHandler.middleware');
const logger = require('./utils/logger');

const app = express();

// Trust proxy: detrás de Render / nginx (X-Forwarded-For para rate-limit)
app.set('trust proxy', 1);

// ─── CORS: va PRIMERO (antes de Helmet, body parser y rutas) ─────────────────
// No pongas express.json() ni router antes de esto: el preflight OPTIONS debe
// recibir cabeceras CORS sin pasar por parsers ni rutas que no existan para OPTIONS.
//
// Orígenes: CORS_ORIGIN o ALLOWED_ORIGINS (coma-separados, sin barra final).
// CORS_NETLIFY_PREVIEWS=true → también https://*.netlify.app
// CORS_ALLOW_LOCALHOST=true → añade localhost:5173 / :3000 (front local contra API en Render)
//
// CORS_TEST_MODE=true → no aplica lista de orígenes: permite cualquier Origin (solo pruebas / debug).
// En producción real dejá false o sin definir y usá CORS_ORIGIN.
//
// Importante: array en `origin`, no callback con cb(null, false) (evita 404 en OPTIONS).
const corsTestMode = process.env.CORS_TEST_MODE === 'true';

/** Quita barra final; muchos copian la URL del navegador con "/" y CORS compara exacto */
function normalizeCorsOrigin(s) {
  if (!s || typeof s !== 'string') return s;
  let t = s.trim();
  while (t.endsWith('/')) t = t.slice(0, -1);
  return t;
}

const originsRaw = process.env.CORS_ORIGIN || process.env.ALLOWED_ORIGINS || '';
const corsOrigins = originsRaw
  .split(',')
  .map((s) => normalizeCorsOrigin(s))
  .filter(Boolean);

// Deploy previews (https://abc123--sitio.netlify.app) y producción (*.netlify.app)
const netlifyOriginRegex = /^https:\/\/.+\.netlify\.app$/i;

const includeNetlifyWildcard =
  process.env.CORS_NETLIFY_PREVIEWS === 'true' ||
  corsOrigins.some((o) => /\.netlify\.app$/i.test(o));

const localhostOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

let corsOriginValue;
if (corsTestMode) {
  corsOriginValue = true;
} else if (corsOrigins.length === 0) {
  corsOriginValue = true;
} else {
  const withNetlify = includeNetlifyWildcard ? [...corsOrigins, netlifyOriginRegex] : [...corsOrigins];
  if (process.env.CORS_ALLOW_LOCALHOST === 'true') {
    const strings = withNetlify.filter((x) => typeof x === 'string');
    const regexes = withNetlify.filter((x) => x instanceof RegExp);
    corsOriginValue = [...new Set([...strings, ...localhostOrigins]), ...regexes];
  } else {
    corsOriginValue = withNetlify;
  }
}

if (!corsTestMode && corsOrigins.length > 0) {
  logger.info(
    `CORS: ${corsOrigins.length} origen(es) explícitos${includeNetlifyWildcard ? ' + *.netlify.app (deploy previews)' : ''}. Dominio custom en Netlify: agregalo a CORS_ORIGIN (el Origin no es *.netlify.app).`
  );
}

if (corsTestMode) {
  logger.warn(
    'CORS_TEST_MODE=true: se acepta cualquier origen. No usar en producción con datos sensibles.'
  );
}

const corsOptions = {
  origin: corsOriginValue,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Requested-With',
    'If-None-Match',
    'If-Modified-Since',
  ],
  optionsSuccessStatus: 204,
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Log explícito de cada petición (método + URL). Activar con LOG_REQUEST_URLS=true (p. ej. en Render).
if (process.env.LOG_REQUEST_URLS === 'true') {
  app.use((req, _res, next) => {
    const bits = [`[entrada] ${req.method} ${req.originalUrl}`];
    if (req.headers['x-forwarded-for']) bits.push(`xff=${req.headers['x-forwarded-for']}`);
    if (req.headers['x-forwarded-host']) bits.push(`xfh=${req.headers['x-forwarded-host']}`);
    if (req.headers.origin) bits.push(`origin=${req.headers.origin}`);
    logger.info(bits.join(' | '));
    next();
  });
}

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
app.use('/auth/', limiter);

// Parse JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos desde /uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/public', express.static(path.join(__dirname, '../public')));

// Mismo router de auth en /auth/* (sin /api) por si VITE_API_URL quedó sin el prefijo /api.
// Canónico: /api/auth/login — preferible arreglar la variable de entorno.
app.use('/auth', authRoutes);

// Rutas
app.use('/api', routes);

// Middleware de error handler (debe ir al final)
app.use(errorHandler);

module.exports = app;

/**
 * UPLOAD.MIDDLEWARE.JS - Configuración de Multer para upload local
 * 
 * Este middleware configura Multer para el almacenamiento local de archivos
 * en el sistema de archivos del servidor.
 */

const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { TIPOS_ARCHIVO } = require('../utils/constants');
const logger = require('../utils/logger');

// Tamaño máximo de archivo: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB en bytes

// Directorio base para uploads
const UPLOADS_DIR = path.join(__dirname, '../../uploads');

// Asegurar que el directorio de uploads existe
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Configuración de almacenamiento en disco
 * Usamos un directorio temporal porque multer procesa el archivo
 * antes de que los campos del FormData estén disponibles en req.body
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Usar directorio temporal - el paciente_id se validará en el controlador
    // y el archivo se moverá a la carpeta correcta después
    const tempDir = path.join(UPLOADS_DIR, 'temp');
    
    // Crear directorio temporal si no existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // Nombre en disco solo uuid + extensión segura (sin nombre original para evitar problemas de codificación)
    const ext = (path.extname(file.originalname) || '').toLowerCase().replace(/[^a-z0-9.]/g, '').slice(0, 12) || '';
    cb(null, `${uuidv4()}-${Date.now()}${ext}`);
  }
});

/**
 * Filtro de tipos de archivo permitidos
 */
const fileFilter = (req, file, cb) => {
  if (TIPOS_ARCHIVO.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Tipos permitidos: ${TIPOS_ARCHIVO.join(', ')}`), false);
  }
};

/**
 * Configuración de Multer
 */
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE
  }
});

/**
 * Middleware para manejar errores de Multer
 */
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: {
          message: 'El archivo excede el tamaño máximo permitido (10MB)',
          code: 'FILE_TOO_LARGE'
        }
      });
    }
    return res.status(400).json({
      success: false,
      error: {
        message: `Error al subir archivo: ${err.message}`,
        code: 'UPLOAD_ERROR'
      }
    });
  }
  
  if (err) {
    return res.status(400).json({
      success: false,
      error: {
        message: err.message || 'Error al procesar el archivo',
        code: 'FILE_PROCESSING_ERROR'
      }
    });
  }
  
  next();
};

module.exports = {
  upload,
  handleMulterError,
  // Helpers para uso común
  uploadSingle: (fieldName) => upload.single(fieldName),
  uploadMultiple: (fieldName, maxCount = 5) => upload.array(fieldName, maxCount)
};

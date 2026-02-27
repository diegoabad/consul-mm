/**
 * AZURE-STORAGE.SERVICE.JS - Soporte opcional para Azure Blob Storage
 *
 * Si están definidas AZURE_STORAGE_CONNECTION_STRING y AZURE_STORAGE_CONTAINER_NAME,
 * los archivos adjuntos se guardan y se leen desde Blob Storage en lugar del disco local.
 * La ruta en la DB sigue siendo la misma (ej. /uploads/pacientes/xxx/file); el blob name
 * es la ruta sin la barra inicial (uploads/pacientes/xxx/file).
 */

const { BlobServiceClient } = require('@azure/storage-blob');
const logger = require('../utils/logger');

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = process.env.AZURE_STORAGE_CONTAINER_NAME || 'uploads';

let blobServiceClient = null;
let containerClient = null;

function isAzureConfigured() {
  return typeof CONNECTION_STRING === 'string' && CONNECTION_STRING.trim().length > 0;
}

async function getContainerClient() {
  if (!containerClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
    await containerClient.createIfNotExists();
  }
  return containerClient;
}

/**
 * Convierte url_archivo (ej. /uploads/pacientes/id/file.pdf) a blob name (uploads/pacientes/id/file.pdf)
 */
function toBlobName(urlArchivo) {
  if (!urlArchivo) return null;
  return urlArchivo.replace(/^\/+/, '');
}

/**
 * Subir un buffer al blob. blobPath = ej. "uploads/pacientes/paciente_id/filename.pdf"
 */
async function uploadBuffer(blobPath, buffer) {
  if (!isAzureConfigured()) return false;
  try {
    const container = await getContainerClient();
    const blockBlobClient = container.getBlockBlobClient(blobPath);
    await blockBlobClient.uploadData(buffer);
    return true;
  } catch (err) {
    logger.error('Azure Blob upload error:', err.message);
    throw err;
  }
}

/**
 * Obtener un stream de lectura del blob (para descarga).
 */
async function getReadStream(blobPath) {
  if (!isAzureConfigured()) return null;
  try {
    const container = await getContainerClient();
    const blockBlobClient = container.getBlockBlobClient(blobPath);
    const downloadResponse = await blockBlobClient.download();
    return downloadResponse.readableStreamBody;
  } catch (err) {
    logger.error('Azure Blob getReadStream error:', err.message);
    return null;
  }
}

/**
 * Eliminar un blob.
 */
async function deleteBlob(blobPath) {
  if (!isAzureConfigured()) return false;
  try {
    const container = await getContainerClient();
    const blockBlobClient = container.getBlockBlobClient(blobPath);
    await blockBlobClient.deleteIfExists();
    return true;
  } catch (err) {
    logger.error('Azure Blob delete error:', err.message);
    return false;
  }
}

module.exports = {
  isAzureConfigured,
  toBlobName,
  uploadBuffer,
  getReadStream,
  deleteBlob
};

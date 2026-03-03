/**
 * WHATSAPP.ROUTES.JS - Webhook de mensajes entrantes de WhatsApp (Twilio)
 *
 * Configurar en Twilio Console → Messaging → Sandbox (o número de producción):
 *   When a message comes in → POST https://tu-dominio.com/api/webhooks/whatsapp
 */

const express = require('express');
const router = express.Router();
const { webhookIncoming, confirmarPorUrl, cancelarPorUrl } = require('../controllers/whatsapp.controller');

// POST /api/webhooks/whatsapp - Recibir respuesta de texto del paciente (fallback sin botones)
router.post('/', webhookIncoming);

// GET /api/webhooks/turno/:id/confirmar - Botón CTA "Confirmar" de la plantilla
router.get('/turno/:id/confirmar', confirmarPorUrl);

// GET /api/webhooks/turno/:id/cancelar - Botón CTA "Cancelar" de la plantilla
router.get('/turno/:id/cancelar', cancelarPorUrl);

module.exports = router;

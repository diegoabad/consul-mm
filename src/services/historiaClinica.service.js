/**
 * HISTORIA-CLINICA.SERVICE.JS - Servicio para exportar historia clínica en PDF
 *
 * Genera un PDF con:
 * - Datos del paciente
 * - Datos del profesional(es)
 * - Diagnósticos (de evoluciones)
 * - Obra social
 * - Todas las sesiones (evoluciones) ordenadas cronológicamente
 * - Archivos adjuntos listados
 */

const path = require('path');
const PDFDocument = require('pdfkit');
const pacienteModel = require('../models/paciente.model');
const evolucionModel = require('../models/evolucion.model');
const archivoModel = require('../models/archivo.model');
const { formatDate } = require('../utils/helpers');
const logger = require('../utils/logger');

// Colores de la plataforma Cogniare
const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1d4ed8',
  textDark: '#111827',
  textGray: '#374151',
  textMuted: '#6B7280',
  border: '#E5E7EB',
  bgLight: '#F9FAFB',
  accent: '#0ea5e9',
};

/** Formatear fecha para mostrar en PDF (dd/MM/yyyy HH:mm) */
function formatFechaPDF(val) {
  if (!val) return '-';
  try {
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return '-';
  }
}

/** Formatear fecha corta (dd/MM/yyyy) */
function formatFechaCorta(val) {
  if (!val) return '-';
  try {
    const s = String(val).trim();
    const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (ymd) {
      return `${ymd[3]}/${ymd[2]}/${ymd[1]}`;
    }
    const d = typeof val === 'string' ? new Date(val) : val;
    if (isNaN(d.getTime())) return '-';
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  } catch {
    return '-';
  }
}

/** Formatear DNI con puntos */
function formatDni(dni) {
  if (dni == null || dni === '') return '';
  const s = String(dni).replace(/\D/g, '');
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.') || '';
}

/** Primera letra de cada palabra en mayúscula */
function titleCase(val) {
  if (!val) return val;
  return String(val).trim().toLowerCase().replace(/(?:^|\s|-)\S/g, (c) => c.toUpperCase());
}

/** Texto para campo vacío (como en la pantalla) */
function vacio(val) {
  return val != null && String(val).trim() !== '' ? String(val).trim() : null;
}
function mostrar(val, fallback = 'No especificado') {
  const v = vacio(val);
  return v !== null ? v : fallback;
}
function mostrarFecha(val) {
  const f = formatFechaCorta(val);
  return f !== '-' ? f : 'No especificada';
}

/**
 * Obtener datos completos para la historia clínica
 * @param {string} pacienteId - UUID del paciente
 * @param {string|null} profesionalId - Si es profesional, filtrar solo sus evoluciones
 * @param {string|null} fechaInicio - YYYY-MM-DD opcional
 * @param {string|null} fechaFin - YYYY-MM-DD opcional
 * @param {'asc'|'desc'} orden - 'asc' = más antigua primero, 'desc' = más reciente primero
 */
async function getDatosHistoriaClinica(pacienteId, profesionalId = null, fechaInicio = null, fechaFin = null, orden = 'asc') {
  const [paciente, evoluciones, archivos] = await Promise.all([
    pacienteModel.findById(pacienteId),
    evolucionModel.findByPaciente(pacienteId, fechaInicio, fechaFin),
    archivoModel.findByPaciente(pacienteId)
  ]);

  if (!paciente) return null;

  let evolucionesFiltradas = evoluciones;
  if (profesionalId) {
    evolucionesFiltradas = evoluciones.filter((e) => e.profesional_id === profesionalId);
  }
  const signo = orden === 'desc' ? -1 : 1;
  evolucionesFiltradas.sort((a, b) => signo * (new Date(a.fecha_consulta) - new Date(b.fecha_consulta)));

  return {
    paciente,
    evoluciones: evolucionesFiltradas,
    archivos
  };
}

/**
 * Generar PDF de historia clínica con logo y colores de la plataforma
 * @param {Object} datos - Resultado de getDatosHistoriaClinica
 * @returns {Promise<Buffer>} Buffer del PDF
 */
function generarPDF(datos) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const { paciente, evoluciones, archivos } = datos;
      const logoPath = path.join(__dirname, '..', '..', 'assets', 'logo.png');
      const pageWidth = 595;
      const margin = 50;
      const contentWidth = pageWidth - 2 * margin;

      // ---------- LOGO centrado; Generado arriba a la derecha; título más chico ----------
      const logoW = 200;
      const logoH = 70;
      const topY = 28;
      const logoX = (pageWidth - logoW) / 2;
      try {
        doc.image(logoPath, logoX, topY, { width: logoW });
      } catch {
        doc.fillColor(COLORS.primary).rect(logoX, topY, logoW, 56).fill();
        doc.fillColor('#ffffff').fontSize(24).font('Helvetica-Bold').text('Cogniare', logoX + 20, topY + 16, { width: logoW - 40, align: 'center' });
      }
      const generadoStr = `Generado: ${formatFechaPDF(new Date())}`;
      const headerY = topY + 8;
      doc.fillColor(COLORS.textMuted).fontSize(8).font('Helvetica')
        .text('Cogniare - Sistema de Gestión Clínica', margin, headerY, { continued: false });
      doc.fillColor(COLORS.textMuted).fontSize(8).font('Helvetica')
        .text(generadoStr, margin, headerY, { width: contentWidth, align: 'right' });
      doc.x = margin;
      doc.y = topY + logoH + 36;

      doc.fillColor(COLORS.primary).fontSize(17).font('Helvetica-Bold').text('Historia Clínica', margin, doc.y, { width: contentWidth, align: 'center' });
      doc.x = margin;
      doc.y = doc.y + 22;
      doc.moveDown(0.8);

      const colWidth = contentWidth / 2 - 12; // dos columnas con espacio entre ellas
      const startX = margin;

      function tituloSeccion(t) {
        doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold').text(t);
        doc.moveDown(0.6);
      }
      function linea(lbl, val) {
        doc.fillColor(COLORS.textDark).fontSize(10).font('Helvetica-Bold').text(lbl + ': ', { continued: true });
        doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(val);
        doc.moveDown(0.5);
      }
      function lineas2Col(lbl1, val1, lbl2, val2) {
        const y0 = doc.y;
        doc.fillColor(COLORS.textDark).fontSize(10).font('Helvetica-Bold').text(lbl1 + ': ', { continued: true });
        doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(val1, { width: colWidth });
        const y1 = doc.y;
        doc.x = startX + colWidth + 24;
        doc.y = y0;
        doc.fillColor(COLORS.textDark).fontSize(10).font('Helvetica-Bold').text(lbl2 + ': ', { continued: true });
        doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(val2, { width: colWidth });
        doc.y = Math.max(y1, doc.y);
        doc.x = margin;
        doc.moveDown(0.65);
      }

      // ---------- Información personal (2 columnas: Nombre/Apellido | DNI/Fecha nac.) ----------
      tituloSeccion('Información personal');
      lineas2Col('Nombre', titleCase(mostrar(paciente.nombre)), 'DNI', vacio(paciente.dni) ? formatDni(paciente.dni) : 'No especificado');
      lineas2Col('Apellido', titleCase(mostrar(paciente.apellido)), 'Fecha de nacimiento', mostrarFecha(paciente.fecha_nacimiento));
      doc.moveDown(1.2);

      // ---------- Información de contacto ----------
      tituloSeccion('Información de contacto');
      lineas2Col('Teléfono', mostrar(paciente.telefono), 'WhatsApp', mostrar(paciente.whatsapp));
      lineas2Col('Email', mostrar(paciente.email), 'Dirección', mostrar(paciente.direccion));
      doc.moveDown(1.2);

      // ---------- Cobertura médica ----------
      tituloSeccion('Cobertura médica');
      lineas2Col('Obra social', (paciente.obra_social && String(paciente.obra_social).trim()) ? String(paciente.obra_social).trim().toUpperCase() : 'No especificado', 'Plan', mostrar(paciente.plan));
      linea('N° de afiliado', mostrar(paciente.numero_afiliado, 'No específicado'));
      doc.moveDown(1.2);

      // ---------- Contacto de emergencia ----------
      tituloSeccion('Contacto de emergencia');
      doc.fillColor(COLORS.textMuted).fontSize(9).font('Helvetica-Bold').text('CONTACTO 1');
      doc.moveDown(0.3);
      lineas2Col('Nombre', titleCase(mostrar(paciente.contacto_emergencia_nombre)), 'Teléfono', mostrar(paciente.contacto_emergencia_telefono));
      if (vacio(paciente.contacto_emergencia_nombre_2) || vacio(paciente.contacto_emergencia_telefono_2)) {
        doc.fillColor(COLORS.textMuted).fontSize(9).font('Helvetica-Bold').text('CONTACTO 2');
        doc.moveDown(0.3);
        lineas2Col('Nombre', titleCase(mostrar(paciente.contacto_emergencia_nombre_2)), 'Teléfono', mostrar(paciente.contacto_emergencia_telefono_2));
      }
      doc.moveDown(1.2);

      // ---------- Profesional tratante (antes de Archivos adjuntos; 3 datos en la misma línea) ----------
      tituloSeccion('Profesional tratante');
      const profesionalesUnicos = [];
      const idsVistos = new Set();
      const nombresVistos = new Set();
      evoluciones.forEach((ev) => {
        const key = ev.profesional_id || `${(ev.profesional_nombre || '').trim()} ${(ev.profesional_apellido || '').trim()}`.trim() || 'sin-datos';
        if (ev.profesional_id) {
          if (!idsVistos.has(ev.profesional_id)) {
            idsVistos.add(ev.profesional_id);
            profesionalesUnicos.push(ev);
          }
        } else if (!nombresVistos.has(key)) {
          nombresVistos.add(key);
          profesionalesUnicos.push(ev);
        }
      });
      if (profesionalesUnicos.length > 0) {
        profesionalesUnicos.forEach((ev) => {
          const nombreCompleto = titleCase(`${(ev.profesional_nombre || '').trim()} ${(ev.profesional_apellido || '').trim()}`.trim()) || '—';
          const especialidad = (ev.profesional_especialidad && String(ev.profesional_especialidad).trim()) ? titleCase(String(ev.profesional_especialidad).trim()) : 'No especificada';
          const matricula = (ev.matricula && String(ev.matricula).trim()) ? String(ev.matricula).trim() : 'No especificada';
          lineas2Col('Nombre completo', nombreCompleto, 'Especialidad', especialidad);
          linea('Matrícula', matricula);
          doc.moveDown(0.6);
        });
      } else {
        doc.fillColor(COLORS.textMuted).fontSize(10).font('Helvetica').text('No hay profesional asignado.');
        doc.moveDown(0.5);
      }
      doc.moveDown(1.2);

      // ---------- Archivos adjuntos (solo nombre + fecha/hora, ordenados por fecha ascendente) ----------
      tituloSeccion('Archivos adjuntos');
      if (archivos.length === 0) {
        doc.fillColor(COLORS.textMuted).fontSize(10).font('Helvetica').text('No hay archivos adjuntos.');
        doc.moveDown(0.5);
      } else {
        const archivosOrdenados = [...archivos].sort((a, b) => new Date(a.fecha_subida) - new Date(b.fecha_subida));
        doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica');
        archivosOrdenados.forEach((a) => {
          const nombre = a.nombre_archivo || 'Sin nombre';
          const fechaHora = formatFechaPDF(a.fecha_subida);
          doc.text(`• ${fechaHora} - ${nombre}`);
        });
        doc.moveDown(0.5);
      }

      // ---------- Segunda hoja: solo Evoluciones ----------
      doc.addPage();

      doc.fillColor(COLORS.primary).fontSize(16).font('Helvetica-Bold').text('Evoluciones', { align: 'center' });
      doc.moveDown(0.8);

      if (evoluciones.length === 0) {
        doc.fillColor(COLORS.textMuted).fontSize(11).font('Helvetica').text('No hay evoluciones cargadas.', { align: 'center' });
        doc.moveDown(1);
      }

      // Mapa: id de evolución → número cronológico (siempre asc, independiente del orden de visualización)
      const evolucionesAsc = [...evoluciones].sort((a, b) => new Date(a.fecha_consulta) - new Date(b.fecha_consulta));
      const idToNum = {};
      evolucionesAsc.forEach((ev, idx) => {
        idToNum[ev.id] = idx + 1;
      });
      // Mapa: id de evolución → número cronológico de la evolución que la corrige
      const corregidaPorNum = {};
      evolucionesAsc.forEach((ev) => {
        if (ev.evolucion_anterior_id) {
          corregidaPorNum[ev.evolucion_anterior_id] = idToNum[ev.id];
        }
      });

      const pageBreakY = 820;
      const fontSizeChica = 8;
      evoluciones.forEach((ev, idx) => {
        if (doc.y > pageBreakY) doc.addPage();
        const num = idToNum[ev.id];
        const fechaStr = formatFechaPDF(ev.fecha_consulta);

        // Línea del título: "Evolución N — fecha   [texto azul si aplica]"
        const yLine = doc.y;

        // Construir sufijo azul (corrección de / corregida por)
        let sufijo = '';
        if (ev.evolucion_anterior_id) {
          const numEvolAnterior = idToNum[ev.evolucion_anterior_id];
          const fechaAnterior = ev.evolucion_anterior_fecha ? formatFechaPDF(ev.evolucion_anterior_fecha) : '';
          sufijo = numEvolAnterior
            ? `   Corrección de evolución ${numEvolAnterior} — ${fechaAnterior}`
            : `   Corrección de evolución anterior — ${fechaAnterior}`;
        }
        const corregidaPor = corregidaPorNum[ev.id];
        if (corregidaPor) {
          sufijo += (sufijo ? '   ' : '   ') + `Corregida por: Evolución ${corregidaPor}`;
        }

        // Escribir título negro
        doc.fillColor(COLORS.textDark).fontSize(11).font('Helvetica-Bold')
          .text(`Evolución ${num} — ${fechaStr}`, margin, yLine, { continued: !!sufijo, width: contentWidth });

        // Escribir sufijo azul en el mismo renglón
        if (sufijo) {
          doc.fillColor(COLORS.primary).fontSize(fontSizeChica).font('Helvetica')
            .text(sufijo);
        }

        // Separación entre título y primer campo
        doc.moveDown(0.8);

        const motivo = vacio(ev.motivo_consulta);
        const diagnostico = vacio(ev.diagnostico);
        const tratamiento = vacio(ev.tratamiento);
        const detalle = vacio(ev.observaciones);

        if (motivo) {
          doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica-Bold').text('Motivo: ', { continued: true });
          doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(motivo, { width: contentWidth });
          doc.moveDown(0.5);
        }
        if (diagnostico) {
          doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica-Bold').text('Diagnóstico: ', { continued: true });
          doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(diagnostico, { width: contentWidth });
          doc.moveDown(0.5);
        }
        if (tratamiento) {
          doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica-Bold').text('Tratamiento: ', { continued: true });
          doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(tratamiento, { width: contentWidth });
          doc.moveDown(0.5);
        }
        if (detalle) {
          doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica-Bold').text('Detalle: ', { continued: true });
          doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text(detalle, { width: contentWidth });
          doc.moveDown(0.5);
        }
        if (!motivo && !diagnostico && !tratamiento && !detalle) {
          doc.fillColor(COLORS.textGray).fontSize(10).font('Helvetica').text('—', { width: contentWidth });
        }
        doc.moveDown(0.8);
      });

      doc.moveDown(1.2);

      // Header/pie en todas las páginas (requiere bufferPages: true)
      const totalPages = doc.bufferedPageRange().count;
      const headerTextY = 20;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const hY = i === 0 ? headerY : headerTextY;
        doc.fillColor(COLORS.textMuted).fontSize(8).font('Helvetica')
          .text(`Cogniare - Sistema de Gestión Clínica | Página ${i + 1} de ${totalPages}`, margin, hY, { continued: false });
        doc.fillColor(COLORS.textMuted).fontSize(8).font('Helvetica')
          .text(generadoStr, margin, hY, { width: contentWidth, align: 'right' });
      }

      doc.end();
    } catch (err) {
      logger.error('Error generando PDF historia clínica:', err);
      reject(err);
    }
  });
}

/**
 * Exportar historia clínica en PDF
 * @param {string} pacienteId - UUID del paciente
 * @param {Object} options - { profesionalId?, fechaInicio?, fechaFin?, orden?: 'asc'|'desc' }
 * @returns {Promise<{ buffer: Buffer, filename: string }>}
 */
async function exportarHistoriaClinicaPDF(pacienteId, options = {}) {
  const { profesionalId = null, fechaInicio = null, fechaFin = null, orden = 'asc' } = options;

  const datos = await getDatosHistoriaClinica(pacienteId, profesionalId, fechaInicio, fechaFin, orden);
  if (!datos) {
    const err = new Error('Paciente no encontrado');
    err.code = 'PACIENTE_NOT_FOUND';
    throw err;
  }

  const buffer = await generarPDF(datos);
  const nombrePaciente = `${datos.paciente.nombre || ''}_${datos.paciente.apellido || ''}`.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '') || 'paciente';
  const fechaHoy = formatDate(new Date(), 'yyyy-MM-dd');
  const filename = `historia_clinica_${nombrePaciente}_${fechaHoy}.pdf`;

  return { buffer, filename };
}

module.exports = {
  getDatosHistoriaClinica,
  exportarHistoriaClinicaPDF
};

/**
 * CONSTANTS.JS - Constantes de la aplicación
 * 
 * Este archivo contiene todas las constantes utilizadas en la aplicación:
 * roles, permisos, estados de turnos, estados de pagos, tipos de archivos, etc.
 */

// Roles del sistema (en minúsculas como están en la BD)
const ROLES = {
  ADMINISTRADOR: 'administrador',
  PROFESIONAL: 'profesional',
  SECRETARIA: 'secretaria',
};

// Estados de turnos (en minúsculas como están en la BD)
const ESTADOS_TURNO = {
  PENDIENTE: 'pendiente',
  CONFIRMADO: 'confirmado',
  CANCELADO: 'cancelado',
  COMPLETADO: 'completado',
  AUSENTE: 'ausente'
};

// Estados de pagos (en minúsculas como están en la BD)
const ESTADOS_PAGO = {
  PENDIENTE: 'pendiente',
  PAGADO: 'pagado',
  VENCIDO: 'vencido'
};

// Tipos MIME permitidos para archivos
const TIPOS_ARCHIVO = [
  'image/jpeg',
  'image/png',
  'image/jpg',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

// Lista completa de permisos del sistema
const PERMISOS = [
  // Usuarios
  'usuarios.crear',
  'usuarios.leer',
  'usuarios.actualizar',
  'usuarios.eliminar',
  'usuarios.activar',
  'usuarios.desactivar',
  
  // Profesionales
  'profesionales.crear',
  'profesionales.leer',
  'profesionales.actualizar',
  'profesionales.eliminar',
  'profesionales.bloquear',
  'profesionales.desbloquear',
  
  // Pacientes
  'pacientes.crear',
  'pacientes.leer',
  'pacientes.actualizar',
  'pacientes.eliminar',
  'pacientes.buscar',
  'pacientes.asignar', // asignarse a un paciente (solo para profesionales)
  
  // Turnos
  'turnos.crear',
  'turnos.leer',
  'turnos.actualizar',
  'turnos.cancelar',
  'turnos.confirmar',
  'turnos.completar',
  'turnos.eliminar',
  
  // Agenda
  'agenda.crear',
  'agenda.leer',
  'agenda.actualizar',
  'agenda.eliminar',
  'agenda.bloques.crear',
  'agenda.bloques.eliminar',
  'agenda.excepciones.crear',
  'agenda.excepciones.actualizar',
  'agenda.excepciones.eliminar',
  
  // Evoluciones
  'evoluciones.crear',
  'evoluciones.leer',
  'evoluciones.actualizar',
  'evoluciones.eliminar',
  
  // Archivos
  'archivos.subir',
  'archivos.leer',
  'archivos.descargar',
  'archivos.eliminar',
  
  // Notas
  'notas.crear',
  'notas.leer',
  'notas.actualizar',
  'notas.eliminar',
  
  // Pagos
  'pagos.crear',
  'pagos.leer',
  'pagos.actualizar',
  'pagos.marcar_pagado',
  
  // Especialidades
  'especialidades.crear',
  'especialidades.leer',
  'especialidades.actualizar',
  'especialidades.eliminar',
  
  // Obras sociales
  'obras_sociales.crear',
  'obras_sociales.leer',
  'obras_sociales.actualizar',
  'obras_sociales.eliminar',
  
  // Notificaciones
  'notificaciones.crear',
  'notificaciones.leer',
  'notificaciones.enviar'
];

// Permisos por defecto según rol
const PERMISOS_POR_ROL = {
  [ROLES.ADMINISTRADOR]: PERMISOS, // Administrador tiene todos los permisos
  
  [ROLES.PROFESIONAL]: [
    'profesionales.leer', // solo para ver su propio registro (filtrado en backend)
    'pacientes.crear',
    'pacientes.leer',
    'pacientes.actualizar',
    'pacientes.buscar',
    'pacientes.asignar',
    'turnos.crear',
    'turnos.leer',
    'turnos.actualizar',
    'turnos.eliminar',
    'turnos.confirmar',
    'turnos.completar',
    'agenda.leer',
    'agenda.crear',
    'agenda.actualizar',
    'agenda.eliminar',
    'agenda.bloques.crear',
    'agenda.bloques.eliminar',
    'agenda.excepciones.crear',
    'agenda.excepciones.actualizar',
    'agenda.excepciones.eliminar',
    'evoluciones.crear',
    'evoluciones.leer',
    // Sin evoluciones.actualizar ni evoluciones.eliminar: el profesional solo puede crear y leer
    'archivos.subir',
    'archivos.leer',
    'archivos.descargar',
    'archivos.eliminar', // solo los que él subió (backend lo restringe)
    'notas.crear',
    'notas.leer',
    'notas.actualizar',
    'notas.eliminar',
    'pagos.leer'
  ],
  
  [ROLES.SECRETARIA]: [
    'profesionales.leer', // necesario para Turnos, Agendas, asignar pacientes, etc.
    'usuarios.leer',
    'usuarios.crear',
    'usuarios.actualizar',
    'pacientes.crear',
    'pacientes.leer',
    'pacientes.actualizar',
    'pacientes.buscar',
    'turnos.crear',
    'turnos.leer',
    'turnos.actualizar',
    'turnos.cancelar',
    'turnos.confirmar',
    'agenda.leer',
    'archivos.subir',
    'archivos.leer',
    'archivos.descargar',
    'notas.crear',
    'notas.leer',
    'notas.actualizar',
    'pagos.leer'
  ],
  
};

module.exports = {
  ROLES,
  ESTADOS_TURNO,
  ESTADOS_PAGO,
  TIPOS_ARCHIVO,
  PERMISOS,
  PERMISOS_POR_ROL
};

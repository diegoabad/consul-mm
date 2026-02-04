# 🔐 CREDENCIALES DE USUARIOS DE PRUEBA

Este documento contiene las credenciales de los usuarios de prueba creados para desarrollo y testing.

## 📋 Usuarios Creados

### 👨‍💼 ADMINISTRADOR
- **Email:** `admin@consultorio.com`
- **Contraseña:** `Admin123!`
- **Nombre:** Administrador Sistema
- **Rol:** administrador
- **Permisos:** Acceso completo a todas las funcionalidades

### 👨‍⚕️ PROFESIONAL
- **Email:** `profesional@consultorio.com`
- **Contraseña:** `Profesional123!`
- **Nombre:** Dr. Juan Pérez
- **Rol:** profesional
- **Permisos:** 
  - Ver su propia agenda
  - Configurar su agenda
  - Ver todos los pacientes
  - Ver sus propios pagos
  - Ver sus notificaciones

### 👩‍💼 SECRETARIA
- **Email:** `secretaria@consultorio.com`
- **Contraseña:** `Secretaria123!`
- **Nombre:** María González
- **Rol:** secretaria
- **Permisos:**
  - Ver agendas de profesionales asignados
  - Gestionar turnos
  - Ver profesionales (si tiene permiso)
  - Ver pagos (si tiene permiso)
  - Ver usuarios
  - Ver sus notificaciones

### 👩‍💼 JEFE SECRETARIA
- **Email:** `jefe.secretaria@consultorio.com`
- **Contraseña:** `JefeSecretaria123!`
- **Nombre:** Ana Martínez
- **Rol:** jefe_secretaria
- **Permisos:**
  - Todas las funcionalidades de secretaria
  - Permisos adicionales según configuración

---

## 🚀 Cómo Recrear los Usuarios

Para limpiar la base de datos y crear estos usuarios nuevamente, ejecuta:

```bash
npm run setup-users
```

O directamente:

```bash
node test/crear-usuarios-prueba.js
```

---

## ⚠️ Nota de Seguridad

**Estas credenciales son solo para desarrollo y testing.**
- No usar en producción
- Cambiar las contraseñas en entornos de producción
- No compartir estas credenciales públicamente

---

## 📝 Última Actualización

Usuarios creados el: 2026-01-26

# Configuración de email (alternativas gratuitas)

## Opción 1: Brevo (recomendado) – 300 emails/día gratis

1. Crear cuenta en [brevo.com](https://www.brevo.com) (gratis, sin tarjeta).
2. Ir a **Configuración** → **SMTP y API** → **Claves SMTP** → **Crear una clave SMTP**.
3. En `api/.env`:
   - `EMAIL_HOST=smtp-relay.brevo.com` (ya está)
   - `EMAIL_USER`: tu email con el que te registraste en Brevo (o el que quieras usar como remitente).
   - `EMAIL_PASSWORD`: la **clave SMTP** que generaste (no la contraseña de tu cuenta).
   - `EMAIL_FROM`: mismo email que `EMAIL_USER`, ej. `"Consultorio <tu_email@ejemplo.com>"`.

4. Probar: `node scripts/test-email-turno.js`

---

## Opción 2: Resend – 3000 emails/mes gratis

1. Crear cuenta en [resend.com](https://resend.com).
2. En el dashboard, crear una **API Key**.
3. En `api/.env`:
   - Comentá o borrá las líneas de `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD` si no las usás.
   - Descomentá y completá:
     ```
     RESEND_API_KEY=re_xxxxxxxxxxxx
     RESEND_FROM="Consultorio <tu_email@ejemplo.com>"
     ```
   - Con Resend, el envío usa la API (no SMTP). El remitente debe ser un dominio verificado en Resend o `onboarding@resend.dev` para pruebas.

4. Probar: `node scripts/test-email-turno.js`

---

## Resumen

| Servicio | Límite gratis        | Configuración      |
|----------|----------------------|--------------------|
| **Brevo** | 300 emails/día       | SMTP en `.env`     |
| **Resend** | 3000 emails/mes (100/día) | `RESEND_API_KEY` en `.env` |

Si tenés `RESEND_API_KEY` en el `.env`, se usa Resend. Si no, se usa SMTP (Brevo, Gmail, etc.).

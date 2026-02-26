# -----------------------------------------------------------------------------
# Backend API (Node + Express + PostgreSQL)
# -----------------------------------------------------------------------------
# Build:  docker build -t consultorio-api ./api
# Run:    docker run -p 5000:5000 -e DATABASE_URL=... -e JWT_SECRET=... consultorio-api
#         (o usar --env-file .env)
# -----------------------------------------------------------------------------

FROM node:20-alpine

WORKDIR /app

# Dependencias (solo producción)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Código de la API
COPY . .

# Puerto por defecto (se puede sobreescribir con -e PORT=...)
ENV PORT=5000
EXPOSE 5000

# Variables de entorno se pasan al run (DATABASE_URL o DB_*, JWT_SECRET, etc.)
# El bootstrap (schema + migraciones + admin) se ejecuta al arrancar si la DB está vacía.
CMD ["node", "server.js"]

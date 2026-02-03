# Usar la base de datos de Render y copiar datos locales

## 1. Obtener la URL de la base de datos en Render

1. Entrá a [Render](https://render.com) → tu **PostgreSQL**.
2. En **Connection**, copiá la **External Database URL** (para conectar desde tu PC).  
   Ejemplo: `postgres://usuario:contraseña@dpg-xxx.oregon-postgres.render.com/nombre_db`

No uses la Internal URL para conectar desde tu máquina (solo sirve entre servicios de Render).

---

## 2. Configurar el proyecto para usar la DB de Render

### Opción A: Probar desde tu PC apuntando a Render

En la carpeta **api**, creá o editá el archivo `.env` y agregá:

```env
# Reemplazá por tu External Database URL de Render
DATABASE_URL=postgres://usuario:contraseña@dpg-xxx.oregon-postgres.render.com/nombre_db

# El resto lo podés dejar como está (JWT, email, etc.)
NODE_ENV=development
PORT=5000
JWT_SECRET=tu_secreto
# ...
```

Si la URL tiene caracteres especiales en la contraseña, asegurate de que esté bien copiada (Render a veces la muestra ya codificada).

### Opción B: Desplegar la API en Render

En el servicio **Web Service** de la API en Render, en **Environment** agregá:

- **Key:** `DATABASE_URL`  
- **Value:** pegá la **Internal Database URL** (la que usa el backend dentro de Render).

No subas el archivo `.env` al repo; usá solo las variables en el dashboard.

---

## 3. Crear tablas y migraciones en la DB de Render

La base en Render ya existe; solo hay que crear el esquema y correr migraciones.

Desde la carpeta **api** (con `DATABASE_URL` en tu `.env` apuntando a Render):

```bash
cd api
npm run setup-remote
```

Eso ejecuta `schema.sql` y todas las migraciones. Al terminar, la base en Render tiene la estructura lista pero **sin datos** (tablas vacías).

---

## 4. Copiar los datos de tu base local a Render

Tenés que exportar la base local y cargarla en la de Render.

### 4.1 Exportar la base local (solo datos)

En PowerShell o CMD, con PostgreSQL instalado y en el PATH:

```bash
# Reemplazá consultorio, postgres, etc. por tu DB local si es distinto
pg_dump -h localhost -p 5432 -U postgres -d consultorio --data-only --no-owner --no-acl -f backup_local.sql
```

Te va a pedir la contraseña de `postgres` en local.

Si usás variables de entorno para la DB local:

```bash
set PGPASSWORD=postgres
pg_dump -h localhost -p 5432 -U postgres -d consultorio --data-only --no-owner --no-acl -f backup_local.sql
```

### 4.2 Importar ese backup en la DB de Render

Usá la **External Database URL** de Render. En PowerShell:

```bash
# Reemplazá por tu External Database URL completa
$env:DATABASE_URL = "postgres://usuario:contraseña@dpg-xxx.oregon-postgres.render.com/nombre_db"
psql $env:DATABASE_URL -f backup_local.sql
```

O en una sola línea (reemplazando la URL):

```bash
psql "postgres://usuario:contraseña@host.render.com/nombre_db" -f backup_local.sql
```

Si `psql` no está en el PATH, usá la ruta completa, por ejemplo:

- Windows: `"C:\Program Files\PostgreSQL\16\bin\psql.exe" "URL" -f backup_local.sql`

### Orden recomendado

1. **Primero** crear estructura en Render: `npm run setup-remote` (paso 3).
2. **Después** exportar datos locales: `pg_dump ... --data-only ...` (paso 4.1).
3. **Por último** importar en Render: `psql URL_RENDER -f backup_local.sql` (paso 4.2).

Si importás datos sobre tablas que ya tienen filas (por ejemplo volvés a correr el mismo backup), podés tener errores de duplicados o de claves foráneas. Lo más simple es hacer esto una vez con la DB de Render recién creada por `setup-remote`.

---

## 5. Verificar conexión

Desde la carpeta **api**:

```bash
npm run test-connection
```

Si usás `DATABASE_URL` en `.env`, debería conectar a la DB de Render y listar las tablas.

---

## Resumen rápido

| Paso | Acción |
|------|--------|
| 1 | Copiar **External Database URL** de Render. |
| 2 | En **api/.env** poner `DATABASE_URL=esa_url`. |
| 3 | En **api**: `npm run setup-remote`. |
| 4 | Exportar local: `pg_dump ... --data-only -f backup_local.sql`. |
| 5 | Importar en Render: `psql URL_RENDER -f backup_local.sql`. |
| 6 | Probar: `npm run test-connection` y levantar la API con `npm run dev`. |

Así podés seguir probando con los mismos datos pero en la base de Render.

# 05. Guía de Despliegue - IDEA UNO OS

Esta guía describe el proceso de compilación, empaquetado y despliegue de **IDEA UNO OS** tanto en entornos de desarrollo local como en producción.

---

## 1. Variables de Entorno Obligatorias

### 1.1 Backend (`backend/.env`)
```ini
PORT=3001
FRONTEND_URL=http://localhost:3000
JWT_SECRET=super_secret_key_123_abc_xyz
JWT_REFRESH_SECRET=super_refresh_secret_key_987_zyx_cba
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
```
El `DATABASE_URL` se obtiene en Supabase Dashboard → Project Settings → Database → Connection string.

### 1.2 Frontend (`frontend/.env.local`)
```ini
NEXT_PUBLIC_API_URL=http://localhost:3001
```

---

## 2. Desarrollo Local con Docker Compose

La plataforma puede orquestarse localmente utilizando el archivo `docker-compose.yml` en la raíz del proyecto.

### 2.1 Archivos Dockerfiles de Servicio

#### A. Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "run", "start:prod"]
```

#### B. Frontend Dockerfile (`frontend/Dockerfile`)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
```

### 2.2 Archivo de Orquestación (`docker-compose.yml`)
```yaml
version: '3.8'

services:
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
      - JWT_SECRET=local_development_secret
      - JWT_REFRESH_SECRET=local_development_refresh_secret
      - FRONTEND_URL=http://localhost:3000
    volumes:
      - ./backend:/app
      - /app/node_modules

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3001
    depends_on:
      - backend
```

### 2.3 Comandos de Arranque Local
Para iniciar ambos servicios con recarga en vivo en un solo paso:
```bash
docker-compose up --build
```
El frontend estará disponible en `http://localhost:3000` y el backend en `http://localhost:3001`.

---

## 3. Despliegue en Producción

### 3.1 Base de Datos: Supabase
1. Ingresa a [supabase.com](https://supabase.com) y crea un nuevo proyecto.
2. Ve a **Project Settings → Database → Connection string** y copia la URI.
3. Pégala como `DATABASE_URL` en el `.env` del backend.
4. Ejecuta las migraciones SQL en **SQL Editor** de Supabase para crear las tablas (ver `docs/03-database-schema.md`).

### 3.2 Backend: Render / Railway / Fly.io
El backend NestJS es stateless, desplegable en cualquier plataforma de contenedores.

Ejemplo con Railway:
```bash
railway up
```
Configura las variables de entorno (`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `PORT`) en el dashboard de la plataforma elegida.

### 3.3 Frontend: Vercel
1. Instale la CLI de Vercel o conecte su repositorio de GitHub a la plataforma de Vercel.
2. Configure la variable de entorno:
   - `NEXT_PUBLIC_API_URL` apuntando a la URL generada por Cloud Run en el paso anterior.
3. Despliegue con un clic o mediante terminal:
   ```bash
   vercel --prod
   ```
   Vercel detectará la estructura de Next.js 15 y optimizará el empaquetado para Edge.

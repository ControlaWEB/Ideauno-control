# 05. Seguridad, Autenticación y Supabase Storage — IDEA UNO OS

---

## 1. Arquitectura de Autenticación

El backend usa NestJS con JWT propio (`POST /auth/login`). Supabase se usa como base de datos vía **service role key** desde el backend. El frontend nunca accede a Supabase directamente.

```
Usuario → Next.js Frontend
              ↓ HTTP
          NestJS Backend (JWT guard)
              ↓ service_role key
          Supabase PostgreSQL
              ↓
          Supabase Storage
```

**Consecuencia:** RLS en Supabase queda como segunda línea de defensa, no como única. El control de acceso primario vive en los guards de NestJS.

---

## 2. Flujo de Autenticación

### 2.1 Login

```
POST /auth/login { email, password }
→ NestJS valida contra dim_usuarios + Supabase Auth
→ Retorna accessToken (JWT 1h) + refreshToken (JWT 7d)
→ Frontend almacena en httpOnly cookie (no localStorage)
```

### 2.2 Invite de nuevos usuarios (asesores)

```
Admin → POST /auth/invite { email, nombre, id_rol }
→ Backend crea usuario en Supabase Auth (supabase.auth.admin.inviteUserByEmail)
→ Supabase envía email con magic link
→ Asesor hace clic → landing de creación de contraseña
→ Backend crea registro en dim_usuarios vinculado al auth.users.id
```

### 2.3 Password Reset

```
POST /auth/forgot-password { email }
→ Backend llama supabase.auth.resetPasswordForEmail
→ Supabase envía email con link
→ Link apunta a: https://[dominio]/auth/reset-password
→ Frontend recibe token en URL, llama POST /auth/reset-password { token, newPassword }
```

### 2.4 Refresh Token

```
POST /auth/refresh
Headers: Authorization: Bearer <refreshToken>
→ NestJS verifica refreshToken
→ Retorna nuevo accessToken
```

---

## 3. Estructura del JWT

```json
{
  "sub": "uuid-del-usuario",
  "email": "asesor@ideauno.com",
  "role": "ASESOR",
  "id_asesor": "uuid-del-asesor-si-aplica",
  "iat": 1234567890,
  "exp": 1234571490
}
```

El claim `role` y `id_asesor` se adjuntan en el login desde `dim_usuarios` y `dim_asesores`. Los guards de NestJS leen estos claims para aplicar permisos.

---

## 4. Matriz de Permisos por Módulo

### 4.1 Tabla de roles × acciones

| Módulo / Acción | ADMIN | ASESOR | JURIDICO | DIRECCION |
|---|:---:|:---:|:---:|:---:|
| **Asesores** | | | | |
| Ver todos los asesores | ✅ | ❌ | ❌ | ✅ |
| Ver perfil propio | ✅ | ✅ | ❌ | ✅ |
| Crear asesor | ✅ | ❌ | ❌ | ❌ |
| Editar asesor | ✅ | Solo propio | ❌ | ❌ |
| Dar de baja asesor | ✅ | ❌ | ❌ | ✅ |
| **Propiedades** | | | | |
| Ver inventario completo | ✅ | Solo activas/publicables | ❌ | ✅ |
| Ver propias captaciones | ✅ | ✅ | ❌ | ✅ |
| Crear captación | ✅ | ✅ | ❌ | ❌ |
| Editar captación | ✅ | Solo propias | ❌ | ❌ |
| Cambiar estatus propiedad | ✅ | ❌ | ❌ | ✅ |
| Cancelar captación | ✅ | ❌ | ❌ | ❌ |
| **Solicitudes contrato** | | | | |
| Crear solicitud | ✅ | ✅ | ❌ | ❌ |
| Ver solicitudes | ✅ | Solo propias | ✅ | ✅ |
| Actualizar estatus solicitud | ✅ | ❌ | ✅ | ❌ |
| **Cierres** | | | | |
| Registrar cierre | ✅ | ✅ | ❌ | ❌ |
| Validar cierre | ✅ | ❌ | ❌ | ✅ |
| Cancelar cierre | ✅ | ❌ | ❌ | ❌ |
| Ver cierres | ✅ | Solo propios | ❌ | ✅ |
| **Comisiones** | | | | |
| Ver comisiones | ✅ | Solo propias | ❌ | ✅ |
| Liberar comisión | ✅ | ❌ | ❌ | ✅ |
| Bloquear comisión | ✅ | ❌ | ❌ | ❌ |
| **Pagos** | | | | |
| Solicitar pago | ✅ | ✅ | ❌ | ❌ |
| Autorizar pago | ✅ | ❌ | ❌ | ✅ |
| Ver pagos | ✅ | Solo propios | ❌ | ✅ |
| **Documentos** | | | | |
| Subir documento | ✅ | ✅ | ✅ | ❌ |
| Validar documento | ✅ | ❌ | ✅ (solo jurídicos) | ❌ |
| Ver documentos | ✅ | Solo propios | Según módulo | ✅ |
| **Configuración** | | | | |
| Ver parámetros | ✅ | ❌ | ❌ | ✅ |
| Editar parámetros | ✅ | ❌ | ❌ | ❌ |
| **Dashboard** | | | | |
| Dashboard administrativo | ✅ | ❌ | ❌ | ✅ |
| Dashboard propio asesor | ✅ | ✅ | ❌ | ✅ |
| **Auditoría** | | | | |
| Ver audit_log | ✅ | ❌ | ❌ | ✅ |

---

## 5. Guards NestJS

### 5.1 JwtAuthGuard

Aplica en todos los endpoints privados. Verifica firma del JWT y expiración.

### 5.2 RolesGuard

```typescript
@Roles('ADMIN', 'DIRECCION')
@UseGuards(JwtAuthGuard, RolesGuard)
@Patch('/properties/:id/status')
changePropertyStatus() { ... }
```

### 5.3 OwnershipGuard (para recursos propios)

Para ASESOR accediendo a sus propios recursos. Verifica que `id_asesor` del JWT coincida con el recurso solicitado.

```typescript
// Ejemplo: asesor solo puede ver sus propios cierres
if (user.role === 'ASESOR' && cierre.id_asesor_cerrador !== user.id_asesor) {
  throw new ForbiddenException();
}
```

---

## 6. RLS en Supabase (segunda línea de defensa)

Como el backend usa `service_role`, las políticas RLS son una capa adicional de seguridad para accesos directos no autorizados (ej. si una API key se filtra).

Habilitar RLS en todas las tablas:

```sql
ALTER TABLE dim_asesores ENABLE ROW LEVEL SECURITY;
ALTER TABLE dim_propiedades ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_cierres ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_comisiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE fact_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE config_parametros_comision ENABLE ROW LEVEL SECURITY;
-- (todas las tablas con datos sensibles)
```

Política base: negar todo excepto `service_role` (que bypassa RLS por defecto en Supabase):

```sql
-- El service_role key del backend bypassa RLS automáticamente.
-- Para accesos directos (ej. Supabase Studio en producción):
CREATE POLICY "deny_direct_access" ON dim_asesores
  FOR ALL TO authenticated
  USING (false);
```

---

## 7. Supabase Storage — Buckets y Políticas

### 7.1 Estructura de Buckets

Un bucket privado general con paths organizados por entidad:

```
Bucket: inmobiliaria-docs (privado, no público)

Paths:
  /asesores/{id_asesor}/{tipo_doc}/{nombre_archivo}
  /clientes/{id_cliente}/{tipo_doc}/{nombre_archivo}
  /propiedades/{id_propiedad}/docs/{nombre_archivo}
  /propiedades/{id_propiedad}/fotos/{nombre_archivo}
  /propiedades/{id_propiedad}/videos/{nombre_archivo}
  /cierres/{id_operacion}/{tipo_doc}/{nombre_archivo}
  /solicitudes/{id_solicitud}/{tipo_doc}/{nombre_archivo}
```

Un bucket semipúblico para fotos de propiedades publicadas (para portales externos en el futuro):

```
Bucket: propiedades-publicas (público para lectura)
  /fotos/{id_propiedad}/{nombre_archivo}
  /videos/{id_propiedad}/{nombre_archivo}
```

### 7.2 Acceso a Storage

El backend (NestJS) usa el `service_role` key para todas las operaciones de Storage. El frontend nunca interactúa con Storage directamente.

Flujo de carga:
```
Frontend → POST /documentos/upload (multipart/form-data)
         → NestJS valida tipo, tamaño, formato
         → NestJS sube a Supabase Storage via SDK
         → NestJS crea registro en dim_documentos
         → Retorna { id_documento, url_firmada }
```

Flujo de descarga:
```
Frontend → GET /documentos/{id_documento}/download
         → NestJS verifica permiso del usuario sobre ese documento
         → NestJS genera URL firmada (expira en 60 minutos)
         → Retorna { url_firmada }
```

### 7.3 Validaciones de archivos

| Tipo de archivo | Formatos permitidos | Tamaño máximo |
|---|---|---|
| Documentos legales | PDF, JPG, PNG, HEIC | 20 MB |
| Fotografías propiedad | JPG, PNG, HEIC, WebP | 10 MB por foto |
| Videos | MP4, MOV | 200 MB |
| Contratos | PDF | 20 MB |

---

## 8. Seguridad General

### 8.1 Variables de entorno requeridas (NestJS)

```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=  # Nunca exponer al frontend
SUPABASE_ANON_KEY=           # Para invites y reset password únicamente
JWT_SECRET=
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d
```

### 8.2 Reglas CORS

Solo permitir orígenes del dominio de la app web:
```
CORS_ORIGINS=https://app.ideauno.mx,http://localhost:3000
```

### 8.3 Rate limiting

Aplicar en endpoints de auth:
- `POST /auth/login` → máx 10 intentos por IP por minuto
- `POST /auth/forgot-password` → máx 3 por correo por hora

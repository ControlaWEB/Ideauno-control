# 06. Manual de Seguridad - IDEA UNO OS

Este documento detalla las medidas de seguridad técnicas aplicadas en el backend y frontend de **IDEA UNO OS** para garantizar la integridad y confidencialidad de la información.

---

## 1. Control de Acceso y Autenticación

### 1.1 Autenticación JWT (JSON Web Tokens)
La plataforma utiliza un esquema de doble token para mitigar riesgos de secuestro de sesión:
1. **Access Token:**
   - Corta duración (15 minutos).
   - Firmado con `JWT_SECRET`.
   - Se incluye en el encabezado `Authorization: Bearer <token>` de las peticiones HTTP.
2. **Refresh Token:**
   - Larga duración (7 días).
   - Firmado con `JWT_REFRESH_SECRET`.
   - Se utiliza para obtener un nuevo Access Token sin requerir que el usuario vuelva a ingresar credenciales.

---

## 2. Autorización RBAC (Role-Based Access Control)
El backend implementa un decorador `@Roles()` y un Guard global que verifica el rol del usuario contenido en el JWT.

```typescript
// Roles canónicos — string exacto en DB campo usuarios.role
export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  DIRECTOR    = 'Director',
  GERENTE     = 'Gerente',
  ASESOR      = 'Asesor',
  JURIDICO    = 'Jurídico',
  AUDITOR     = 'Auditor',
}
```

### Matriz de Permisos por Rol

| Módulo | Acción | Super Admin | Director | Gerente | Asesor | Jurídico | Auditor |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Auth** | Login, refresh, me | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| | Invite, reset | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Dashboard** | Admin KPIs / charts | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| | Dashboard propio asesor | ✅ | ✅ | ✅ | Solo propio | ❌ | ✅ |
| **Asesores** | Ver todos | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| | Crear / editar | ✅ | ❌ | ✅ | Solo propio | ❌ | ❌ |
| | Baja / estatus | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Propiedades** | Ver inventario completo | ✅ | ✅ | ✅ | Solo activas + propias | ❌ | ✅ |
| | Crear captación | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| | Cambiar estatus | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Contratos** | Crear solicitud | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| | Ver solicitudes | ✅ | ✅ | ✅ | Solo propias | ✅ | ✅ |
| | Actualizar estatus | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| **Cierres** | Registrar cierre | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| | Validar / cancelar | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Comisiones** | Ver todas | ✅ | ✅ | ✅ | Solo propias | ❌ | ✅ |
| | Liberar / bloquear | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Pagos** | Solicitar | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ |
| | Autorizar / marcar pagado | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Compliance** | Ver casos | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| | Actualizar KYC | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| **Configuración** | Ver parámetros | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| | Editar parámetros | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Auditoría** | Ver audit_logs | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |

---

## 3. Seguridad a Nivel de Aplicación API

### 3.1 Encabezados HTTP (Helmet)
NestJS utiliza el paquete `helmet` para configurar de manera automática encabezados de seguridad críticos, como:
- `Content-Security-Policy` (CSP) para prevenir inyecciones XSS.
- `Strict-Transport-Security` (HSTS) para obligar a navegar bajo HTTPS.
- `X-Frame-Options` para evitar ataques de Clickjacking.

### 3.2 CORS (Cross-Origin Resource Sharing)
Solo se permiten solicitudes originadas desde la variable de entorno `FRONTEND_URL`. 
```typescript
app.enableCors({
  origin: process.env.FRONTEND_URL,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true,
});
```

### 3.3 Rate Limiting (Protección de fuerza bruta)
Se configura `@nestjs/throttler` de forma global:
- Rutas Generales: Máximo 100 peticiones por minuto por dirección IP.
- Rutas de Autenticación (`/auth/login`): Máximo 5 intentos por minuto por IP.

---

## 4. Auditoría Activa y Registro inmutable
Toda petición de creación, actualización o eliminación (`POST`, `PUT`, `PATCH`, `DELETE`) en el backend pasa a través de un interceptor de NestJS:
1. Extrae el ID y correo del usuario desde la petición.
2. Recupera la acción y el payload enviado (sanitizando contraseñas y datos sensibles).
3. Obtiene la dirección IP del cliente.
4. Genera una inserción en la tabla `audit_logs` de Supabase (PostgreSQL), garantizando una bitácora forense de operaciones para el rol de `Auditor`.

# 01. Arquitectura de Sistema - IDEA UNO OS

## 1. Visión General
IDEA UNO OS es una plataforma web empresarial diseñada bajo un modelo de arquitectura desacoplada. 

```
┌─────────────────────────┐         ┌─────────────────────────┐
│   Frontend (Next.js)    │ ──REST──> │    Backend (NestJS)     │
│  Puerto Local: 3000     │ <──JWT──  │   Puerto Local: 3001    │
└─────────────────────────┘         └─────────────────────────┘
             │                                   │
             ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│   Navegador del Usuario │         │   Supabase (PostgreSQL) │
│ (Estilos / Tailwind CSS)│         │  db.[ref].supabase.co   │
└─────────────────────────┘         └─────────────────────────┘
```

---

## 2. Frontend (Next.js 15)
El frontend gestiona la interfaz corporativa y la navegación del usuario.
- **Next.js 15 (App Router):** Estructura basada en subcarpetas para definir rutas privadas y flujos de negocio.
- **React 19:** Aprovecha la reactividad moderna y las optimizaciones de renderizado.
- **Tailwind CSS & Shadcn/UI:** Configuración visual personalizada basada en tokens de diseño del `DESIGN.md` para proveer consistencia corporativa.
- **Zustand:** Estado global ultra-ligero para el control de la sesión, roles y preferencias del usuario.
- **TanStack Query (React Query v5):** Manejo de peticiones HTTP, caché de datos remotos, revalidación y sincronización de datos.

---

## 3. Backend (NestJS)
El backend procesa la lógica empresarial y las consultas al almacenamiento de datos.
- **Modularidad:** Organizado por dominios (Auth, Properties, Advisors, Clients, Operations, Commissions, Compliance, Audit).
- **Seguridad:** Implementación de guards JWT y controles RBAC (Role-Based Access Control) a nivel de controlador y método.
- **DatabaseService:** Capa de datos unificada para interactuar con Supabase mediante SQL parametrizado con `pg`.

---

## 4. Estrategia de Conectividad con Supabase

El backend se conecta a Supabase (PostgreSQL) vía `pg` (node-postgres) usando `DATABASE_URL`.

### A. Configuración de Conexión
- **Variable:** `DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres`
- **SSL:** Habilitado con `rejectUnauthorized: false` (requerido por Supabase).
- **Pool:** Gestionado por `pg.Pool` para reutilizar conexiones eficientemente.

### B. Rendimiento y UX
1. **Optimistic Updates:** TanStack Query renderiza cambios inmediatamente antes de confirmar la respuesta del servidor.
2. **Skeleton Loaders:** Placeholders durante el fetching para evitar parpadeos visuales.
3. **Paginación:** Todas las tablas usan `LIMIT` / `OFFSET` a nivel de servidor.

---

## 5. Estructura de módulos NestJS

```
backend/src/
├── modules/
│   ├── auth/                    # Login, refresh, invite, reset
│   ├── advisors/                # CRUD asesores + mentor + banco
│   ├── clients/                 # CRUD clientes + KYC
│   ├── properties/              # Captaciones venta y renta
│   ├── contracts/               # Solicitudes contrato (jurídico)
│   ├── operations/              # Cierres de operación
│   ├── commissions/             # Motor y estatus comisiones
│   ├── payments/                # Solicitar, autorizar, pagar
│   ├── documents/               # Upload/download Supabase Storage
│   ├── ama/                     # Seguimiento meta anual
│   ├── compliance/              # PLD / KYC casos
│   ├── config/                  # Parámetros configurables
│   ├── audit/                   # Lectura de audit_logs
│   └── dashboard/               # KPIs, charts, rankings
├── common/
│   ├── guards/
│   │   ├── jwt.guard.ts
│   │   ├── roles.guard.ts
│   │   └── ownership.guard.ts
│   ├── decorators/
│   │   ├── roles.decorator.ts
│   │   └── current-user.decorator.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       ├── response.interceptor.ts   # Envuelve respuesta en { data: ... }
│       └── audit.interceptor.ts      # POST/PATCH/DELETE → audit_logs
├── database/
│   └── database.service.ts           # pg.Pool con DATABASE_URL
└── app.module.ts
```

---

## 6. Formato estándar de respuestas API

### Lista paginada
```json
{
  "data": [ { ... } ],
  "meta": { "total": 248, "page": 1, "limit": 20, "totalPages": 13 }
}
```

### Recurso individual
```json
{ "data": { ... } }
```

### Mutación exitosa
```json
{ "data": { ... }, "message": "Operación realizada exitosamente" }
```

### Error
```json
{
  "statusCode": 422,
  "error": "Unprocessable Entity",
  "message": "La propiedad requiere contrato de comisión firmado para publicarse",
  "code": "BUSINESS_RULE_VIOLATION"
}
```

| Code | HTTP | Cuándo |
|---|---|---|
| `VALIDATION_ERROR` | 400 | DTO inválido |
| `UNAUTHORIZED` | 401 | Token expirado o inválido |
| `FORBIDDEN` | 403 | Rol sin permiso o recurso de otro usuario |
| `NOT_FOUND` | 404 | Recurso no existe |
| `CONFLICT` | 409 | Email duplicado, RFC duplicado |
| `BUSINESS_RULE_VIOLATION` | 422 | Regla de negocio violada |
| `INTERNAL_ERROR` | 500 | Error no controlado |

---

## 7. Roles canónicos del sistema

| Rol (string exacto en DB) | Descripción |
|---|---|
| `Super Admin` | Control total: CRUD todo, configuración, pagos |
| `Director` | Vista completa + autorizar pagos + ver configuración |
| `Gerente` | Operación diaria: validar, aprobar, gestionar asesores |
| `Asesor` | Captura propia, consulta propia, solicitar pagos |
| `Jurídico` | Ver y actualizar solicitudes de contrato |
| `Auditor` | Solo lectura de todo + audit_logs |

Ver `06-seguridad.md` para la matriz de permisos completa.

---

## 8. Nombres de tablas reales en DB

Las tablas en Supabase usan nombres mixtos (algunas en inglés, algunas con prefijos en español).
Ver `04-api-endpoints.md § Tabla de nombres` para el mapeo completo.

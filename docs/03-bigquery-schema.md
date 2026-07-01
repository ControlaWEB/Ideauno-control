# 03. Estructura de Datos - IDEA UNO OS

Definición de tablas en Supabase (PostgreSQL). Schema: `public`.

---

## 1. Diseño Relacional

```
┌─────────────────┐           ┌──────────────────┐
│     usuarios    │ ◄──────── │    advisors      │ ◄─── (invite_by_advisor_id)
└─────────────────┘           └──────────────────┘
                                        │
                                        ▼
┌─────────────────┐           ┌──────────────────┐
│    clients      │ ◄──────── │    operations    │ ◄─── (property_id)
└─────────────────┘           └──────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              ┌──────────────────┐            ┌──────────────────┐
              │    commissions   │            │ compliance_cases │
              └──────────────────┘            └──────────────────┘
```

---

## 2. Diccionario de Tablas

### 2.1 Tabla: `usuarios`
Cuentas de usuario de la plataforma.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK, generado con `gen_random_uuid()` |
| `name` | `TEXT` | Nombre completo |
| `email` | `TEXT UNIQUE` | Correo de acceso |
| `password_hash` | `TEXT` | Contraseña cifrada con bcrypt |
| `role` | `TEXT` | `Super Admin`, `Director`, `Gerente`, `Asesor`, `Auditor` |
| `status` | `TEXT` | `Active` o `Suspended` |
| `avatar_url` | `TEXT` | URL de imagen de perfil |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Fecha de última modificación |

### 2.2 Tabla: `advisors`
Información de desempeño comercial de asesores.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `TEXT` | PK (Formato: `ADV-XXXX`) |
| `user_id` | `UUID` | FK → `usuarios.id` |
| `name` | `TEXT` | Nombre del asesor |
| `email` | `TEXT` | Correo |
| `phone` | `TEXT` | Teléfono |
| `specialty` | `TEXT` | Comercial, Residencial, Industrial |
| `license` | `TEXT` | Cédula o licencia |
| `status` | `TEXT` | `Activo`, `Mentoría`, `Inactivo` |
| `invite_by_advisor_id` | `TEXT` | FK → `advisors.id` (mentor) |
| `meta_ama` | `NUMERIC` | % avance de meta de ventas |
| `created_at` | `TIMESTAMPTZ` | Fecha de registro |
| `updated_at` | `TIMESTAMPTZ` | Última actualización |

### 2.3 Tabla: `clients`
Datos de clientes (vendedores, compradores, arrendadores, arrendatarios).

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `name` | `TEXT` | Nombre o razón social |
| `email` | `TEXT` | Correo de contacto |
| `phone` | `TEXT` | Teléfono |
| `rfc` | `TEXT` | RFC para validación PLD |
| `type` | `TEXT` | `Individual` o `Corporate` |
| `created_at` | `TIMESTAMPTZ` | Fecha de creación |
| `updated_at` | `TIMESTAMPTZ` | Última modificación |

### 2.4 Tabla: `properties`
Inventario de bienes raíces.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `code` | `TEXT` | Clave de inventario (Ej: `C-LOMAS-B42`) |
| `folio` | `TEXT` | Folio de registro |
| `type` | `TEXT` | `casa`, `departamento`, `terreno`, `oficina` |
| `status` | `TEXT` | `disponible`, `apartada`, `vendida` |
| `price` | `NUMERIC` | Precio comercial |
| `currency` | `TEXT` | `MXN` o `USD` |
| `address` | `TEXT` | Dirección completa |
| `city` | `TEXT` | Ciudad |
| `state` | `TEXT` | Estado |
| `zip_code` | `TEXT` | Código Postal |
| `owner_name` | `TEXT` | Nombre del propietario |
| `advisor_id` | `TEXT` | FK → `advisors.id` |
| `description` | `TEXT` | Descripción comercial |
| `area_sqm` | `NUMERIC` | Superficie en m² |
| `image_url` | `TEXT` | URL de imagen destacada |
| `created_at` | `TIMESTAMPTZ` | Fecha de alta |
| `updated_at` | `TIMESTAMPTZ` | Última modificación |

### 2.5 Tabla: `operations`
Transacciones comerciales inmobiliarias.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `code` | `TEXT` | Folio (Ej: `OP-2023-001`) |
| `property_id` | `UUID` | FK → `properties.id` |
| `client_id` | `UUID` | FK → `clients.id` |
| `advisor_id` | `TEXT` | FK → `advisors.id` |
| `type` | `TEXT` | `venta`, `renta`, `preventa`, `traspaso` |
| `status` | `TEXT` | `borrador`, `proceso`, `validacion`, `cerrado`, `cancelado` |
| `contract_value` | `NUMERIC` | Valor total de la transacción |
| `currency` | `TEXT` | `MXN` o `USD` |
| `commission_rate` | `NUMERIC` | % de comisión pactada |
| `total_commission` | `NUMERIC` | Monto calculado de comisión |
| `compliance_status` | `TEXT` | Semáforo PLD: `Verde`, `Ámbar`, `Rojo` |
| `created_at` | `TIMESTAMPTZ` | Fecha de inicio |
| `updated_at` | `TIMESTAMPTZ` | Fecha de modificación |

### 2.6 Tabla: `commissions`
Desglose de pago y reparto de comisiones.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `operation_id` | `UUID` | FK → `operations.id` |
| `advisor_id` | `TEXT` | FK → `advisors.id` |
| `type` | `TEXT` | `directa` (80%) o `mentoría` (20%) |
| `amount` | `NUMERIC` | Monto neto de comisión |
| `status` | `TEXT` | `pendiente` o `pagado` |
| `payment_date` | `TIMESTAMPTZ` | Fecha de pago |
| `created_at` | `TIMESTAMPTZ` | Fecha de cálculo |

### 2.7 Tabla: `compliance_cases`
Casos de monitoreo PLD / KYC.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `operation_id` | `UUID` | FK → `operations.id` |
| `client_id` | `UUID` | FK → `clients.id` |
| `risk_level` | `TEXT` | `bajo`, `medio`, `alto`, `critico` |
| `status` | `TEXT` | `pendiente_docs`, `en_integracion`, `validado`, `bloqueado` |
| `rfc_valid` | `BOOLEAN` | RFC validado fiscalmente |
| `identification_valid` | `BOOLEAN` | Identificación verificada |
| `pep_check` | `TEXT` | `positivo` o `negativo` |
| `alert_trigger` | `TEXT` | Criterio que detonó la alerta |
| `observations` | `TEXT` | Bitácora del Oficial de Cumplimiento |
| `created_at` | `TIMESTAMPTZ` | Fecha del caso |
| `updated_at` | `TIMESTAMPTZ` | Última actualización |

### 2.8 Tabla: `documents`
Archivos cargados vinculados a entidades.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `entity_type` | `TEXT` | `client`, `property`, `operation` |
| `entity_id` | `UUID` | ID de la entidad relacionada |
| `name` | `TEXT` | Nombre descriptivo del archivo |
| `file_url` | `TEXT` | URL del archivo en Storage |
| `status` | `TEXT` | `pendiente`, `validado`, `rechazado` |
| `created_at` | `TIMESTAMPTZ` | Fecha de carga |

### 2.9 Tabla: `audit_logs`
Bitácora de auditoría inmutable.

| Campo | Tipo PostgreSQL | Descripción |
| :--- | :--- | :--- |
| `id` | `UUID` | PK |
| `user_id` | `UUID` | FK → `usuarios.id` |
| `user_email` | `TEXT` | Correo de auditoría |
| `action` | `TEXT` | Acción (Ej: `CREATE_OPERATION`, `UPDATE_ADVISOR`) |
| `details` | `JSONB` | Payload con valores modificados |
| `ip_address` | `TEXT` | IP origen |
| `timestamp` | `TIMESTAMPTZ` | Fecha y hora exacta |

# 04. Documentación de API Endpoints — IDEA UNO OS

Base URL: `/api/v1`  
Auth: `Authorization: Bearer <accessToken>` en todos los endpoints marcados con 🔒  
Formato de respuesta: ver `01-arquitectura.md § 7`  
Nombres de tablas: ver `01-arquitectura.md § 10`

---

## Módulo Auth · `/auth`

### POST /auth/login · Público
```json
// Request
{ "email": "user@ideauno.com", "password": "Password123" }

// Response 200
{
  "data": {
    "accessToken": "eyJ...",
    "refreshToken": "eyJ...",
    "user": { "id": "uuid", "name": "Mario Gomez", "email": "...", "role": "Asesor" }
  }
}
```

### POST /auth/refresh · Público
```
Headers: Authorization: Bearer <refreshToken>
Response 200: { "data": { "accessToken": "eyJ..." } }
```

### GET /auth/me · 🔒 Todos los roles
Retorna datos del usuario autenticado desde `usuarios` + `advisors` si aplica.

### POST /auth/invite · 🔒 Super Admin, Gerente
```json
// Request
{ "email": "nuevo@ideauno.com", "name": "Ana López", "role": "Asesor" }
// Supabase envía email con magic link. Crea registro en usuarios con status: 'Pending'
// Response 201: { "data": { "id": "...", "email": "...", "status": "Pending" } }
```

### POST /auth/forgot-password · Público
```json
{ "email": "user@ideauno.com" }
// Response 200: { "message": "Si el correo existe, recibirás un enlace." }
```

### POST /auth/reset-password · Público
```json
{ "token": "...", "password": "NuevoPassword123" }
```

### POST /auth/logout · 🔒 Todos
Invalida el refreshToken en el lado servidor (blacklist o rotación).

---

## Módulo Asesores · `/advisors`

Tabla: `public.advisors`

### GET /advisors · 🔒 Super Admin, Director, Gerente, Auditor
```
Query params: page, limit, status, search (nombre/email)
Response: lista paginada de asesores
```

### POST /advisors · 🔒 Super Admin, Gerente
```json
{
  "name": "Carlos Pérez",
  "email": "carlos@...",
  "phone": "8112345678",
  "rfc": "PERC900101XXX",
  "curp": "PERC900101HNLRRL01",
  "fecha_nacimiento": "1990-01-01",
  "fecha_alta_asesor": "2025-01-15",
  "invite_by_advisor_id": "ADV-001",    // opcional, 'Directo' si no aplica
  "pasa_por_mentoria": "true",
  "id_mentor": "ADV-001",               // condicional
  "nombre_beneficiario": "María Pérez",
  "telefono_beneficiario": "8119876543",
  "correo_beneficiario": "maria@..."
}
// Crea asesor + inicia período AMA en fact_ama_asesor
// Response 201: { "data": { asesor completo } }
```

### GET /advisors/:id · 🔒 Super Admin, Director, Gerente, Auditor; Asesor solo propio
Retorna advisor + período AMA activo + conteo operaciones.

### PATCH /advisors/:id · 🔒 Super Admin, Gerente; Asesor solo propio (campos limitados)
Actualiza datos del asesor. Campos que Asesor NO puede editar: `status`, `invite_by_advisor_id`, `id_mentor`, `pasa_por_mentoria`.

### PATCH /advisors/:id/status · 🔒 Super Admin, Gerente
```json
{ "status": "Baja definitiva", "motivo_baja": "Renuncia voluntaria", "fecha_baja": "2025-06-01" }
// Valores: Activo | En mentoría | Inactivo | Baja definitiva
```

### PATCH /advisors/:id/mentor · 🔒 Super Admin, Gerente
```json
{ "id_mentor": "ADV-002", "egresa_mentoria": false }
// Si egresa_mentoria=true: pasa_por_mentoria='false', id_mentor=''
```

### PATCH /advisors/:id/bank · 🔒 Super Admin, Gerente; Asesor solo propio
```json
{ "clabe_interbancaria": "002180...", "banco": "BBVA", "titular_cuenta": "Carlos Pérez" }
```

---

## Módulo Clientes · `/clients`

Tabla: `public.dim_clientes`

### GET /clients · 🔒 Super Admin, Gerente, Auditor
```
Query params: page, limit, tipo_cliente, search
```

### POST /clients · 🔒 Super Admin, Gerente, Asesor
```json
{
  "tipo_cliente": "Comprador",
  "nombre_razon_social": "Roberto Sánchez",
  "persona_tipo": "Persona física",
  "telefono": "8121234567",
  "correo": "rsanchez@...",
  "rfc": "SARR800101XXX",
  "curp": "SARR800101HNLNBR01",
  "estado_civil": "Casado(a)",
  "regimen_patrimonial": "Sociedad conyugal",
  "nombre_conyuge": "Laura Torres",
  "domicilio": "Av. Constitución 100, Monterrey",
  "es_pep": "false",
  "origen_recursos": "Ahorro personal"
}
```

### GET /clients/:id · 🔒 Super Admin, Gerente, Asesor, Auditor
### PATCH /clients/:id · 🔒 Super Admin, Gerente
### PATCH /clients/:id/kyc · 🔒 Super Admin, Gerente, Auditor
```json
{ "estatus_kyc": "Validado", "observaciones": "INE y RFC validados" }
// Valores: Pendiente | En revisión | Validado | Rechazado
// Si Validado y la operación asociada tenía comisión bloqueada por KYC → desbloquear automáticamente
```

---

## Módulo Propiedades · `/properties`

Tabla: `public.properties`

### GET /properties · 🔒 Todos los roles
```
Query params:
  page, limit
  tipo_operacion: Venta | Renta
  tipo_inmueble: Casa | Departamento | ...
  status: Incompleta | En revisión | Activa | Publicable | Apartada | Vendida | Rentada | Suspendida | Cancelada
  advisor_id: UUID (Admin/Gerente pueden filtrar por asesor; Asesor solo ve las suyas + activas/publicables de otros)
  zona, precio_min, precio_max
  search (dirección)
```

### POST /properties · 🔒 Super Admin, Gerente, Asesor
Crea propiedad tipo **Venta**. Ver Formulario 2 para campos completos.
```json
{
  "tipo_operacion": "Venta",
  "tipo_inmueble": "Casa",
  "address": "Av. Vasconcelos 1200, San Pedro Garza García",
  "city": "San Pedro Garza García",
  "state": "Nuevo León",
  "zip_code": "66220",
  "zona": "Valle",
  "price": 8500000,
  "currency": "MXN",
  "advisor_id": "ADV-003",
  "fecha_captacion": "2025-06-26",
  "contrato_comision_firmado": "true",
  "porcentaje_comision_pactado": 5,
  // ... resto de campos del formulario
}
// Status inicial: 'En revisión' si contrato firmado, 'Incompleta' si no
// Response 201: { "data": { propiedad completa } }
```

### POST /properties/renta · 🔒 Super Admin, Gerente, Asesor
Crea propiedad tipo **Renta**. Ver Formulario 3 para campos completos.

### GET /properties/:id · 🔒 Todos los roles (con restricción por status para Asesor)
### PATCH /properties/:id · 🔒 Super Admin, Gerente; Asesor solo propias con status Incompleta/En revisión
### PATCH /properties/:id/status · 🔒 Super Admin, Gerente, Director
```json
{ "status": "Activa", "motivo": "Expediente validado" }
// Reglas validadas server-side:
// → Activa/Publicable/Apartada requieren contrato_comision_firmado='true'
// → Vendida/Rentada requieren cierre validado existente
// → No se puede revertir Vendida o Rentada
```

### GET /properties/:id/documents · 🔒 Roles con acceso a esa propiedad
Retorna lista de `dim_documentos` filtrada por `id_entidad = :id` y `entidad_relacionada = 'propiedad'`.

---

## Módulo Solicitudes de Contrato · `/contracts`

Tabla: `public.fact_solicitudes_contrato`

### GET /contracts · 🔒 Todos excepto Asesor que solo ve propias
```
Query params: page, limit, tipo_solicitud, estatus_solicitud, advisor_id
```

### POST /contracts · 🔒 Super Admin, Gerente, Asesor
Crea solicitud de contrato promesa (Formulario 4) o arrendamiento (Formulario 5).
```json
{
  "tipo_solicitud": "Promesa compraventa",
  "id_propiedad": "PROP-001",
  "id_asesor_solicitante": "ADV-003",
  "precio_final_acordado": 8200000,
  "fecha_firma_estimada": "2025-07-15",
  "confirmacion_asesor": "true",
  "rep_vendedor_tipo": "Yo mismo",
  "rep_comprador_tipo": "Asesor externo",
  "nombre_externo_comprador": "Juan Ríos",
  "inmobiliaria_externa_comprador": "Remax Norte",
  // ... resto de campos de sección participación y documentos
}
```

### GET /contracts/:id · 🔒 Super Admin, Gerente, Director, Jurídico, Auditor; Asesor solo propios

### PATCH /contracts/:id/status · 🔒 Super Admin, Gerente, Jurídico
```json
{
  "estatus_solicitud": "En elaboración",
  "observaciones_juridico": "Se requiere acta de matrimonio del vendedor",
  "fecha_entrega_estimada": "2025-07-10"
}
// Transiciones válidas aplicadas server-side (ver 07-formularios-faltantes.md § F8)
```

---

## Módulo Cierres · `/operations`

Tabla: `public.operations`

### GET /operations · 🔒 Super Admin, Director, Gerente, Auditor; Asesor solo propios
```
Query params: page, limit, type (Venta|Renta), status, advisor_id, fecha_inicio, fecha_fin
```

### POST /operations · 🔒 Super Admin, Gerente, Asesor
Registra cierre de operación. Ver Formulario 6.
```json
{
  "type": "Venta",
  "property_id": "PROP-001",
  "propiedad_en_inventario": "true",
  "advisor_id": "ADV-003",
  "precio_final_cierre": 8200000,
  "fecha_cierre": "2025-06-25",
  "monto_comision_generada": 410000,
  "doc_cierre_tipo": "Promesa de Compraventa firmada",
  "pld_tipo_cliente": "Persona física",
  "pld_expediente_completo": "true",
  "rep_vendedor_tipo": "Yo mismo",
  "rep_comprador_tipo": "Asesor externo",
  // declaraciones del asesor (checkboxes)
  "solicita_liberacion": "true"
}
// Lógica server-side:
//  1. Evalúa umbral PLD → crea compliance_case si aplica
//  2. Registra en operations con status='Solicitado'
//  3. NO calcula comisión aún (espera validación admin)
// Response 201: { "data": { operacion + compliance_case si aplica } }
```

### GET /operations/:id · 🔒 Según rol (Asesor solo propio)
Retorna operación + bridge_operacion_asesores + compliance_case + commissions si existen.

### PATCH /operations/:id/validate · 🔒 Super Admin, Gerente, Director
```json
{ "observaciones": "Expediente completo, operación validada" }
// Lógica:
//  1. operations.status → 'Validado por administración'
//  2. operations.validado_por_admin = true
//  3. Dispara cálculo de comisión → crea registro en commissions
//  4. Si solicita_liberacion='true' y comisión no bloqueada → commissions.estatus_comision='Liberada'
```

### PATCH /operations/:id/cancel · 🔒 Super Admin
```json
{ "motivo": "Operación no concretada", "detalle": "..." }
// Bloquea si status='Pagado'
// Revierte fact_ama_asesor.monto_acumulado
// Cancela commissions y fact_pagos pendientes asociados
```

### GET /operations/:id/pld · 🔒 Super Admin, Gerente, Director, Auditor
Retorna compliance_case asociado a la operación + checklist de documentos PLD.

---

## Módulo Comisiones · `/commissions`

Tabla: `public.commissions`

### GET /commissions · 🔒 Super Admin, Director, Gerente, Auditor; Asesor solo propias
```
Query params: page, limit, estatus_comision, advisor_id, fecha_inicio, fecha_fin
```

### GET /commissions/:id · 🔒 Según rol
Retorna comisión con desglose completo (invitación, mentoría, AMA, inmobiliaria).

### PATCH /commissions/:id/release · 🔒 Super Admin, Director
```json
{ "observaciones": "Documentación completa, liberada para pago" }
// commissions.estatus_comision → 'Liberada'
// Verifica que operations asociada esté Validada y PLD completo
```

### PATCH /commissions/:id/block · 🔒 Super Admin, Gerente
```json
{ "razon": "Expediente PLD incompleto" }
// commissions.estatus_comision → 'Bloqueada'
```

---

## Módulo Pagos · `/payments`

Tabla: `public.fact_pagos`

### GET /payments · 🔒 Super Admin, Director, Gerente, Auditor; Asesor solo propios
```
Query params: page, limit, estatus_pago, advisor_id, fecha_inicio, fecha_fin
```

### POST /payments · 🔒 Super Admin, Gerente, Asesor
Solicita pago de comisión liberada.
```json
{
  "id_comision": "COM-001",
  "monto_solicitado": 185000,
  "forma_pago": "Transferencia",
  "requiere_cfdi": true,
  "observaciones": ""
}
// Requiere: commissions.estatus_comision='Liberada' y advisor con clabe_interbancaria
// Valida que no exista ya un fact_pagos activo para esa comisión
// fact_pagos.estatus_pago → 'Solicitado'
// commissions.estatus_comision → 'Solicitada'
```

### GET /payments/:id · 🔒 Según rol

### PATCH /payments/:id/authorize · 🔒 Super Admin, Director
```json
{ "observaciones": "Autorizado para pago semana del 30 Jun" }
// estatus_pago → 'Autorizado'
```

### PATCH /payments/:id/reject · 🔒 Super Admin, Director, Gerente
```json
{ "motivo": "Datos bancarios incorrectos" }
// estatus_pago → 'Rechazado'
// commissions.estatus_comision → 'Liberada' (regresa al estado anterior)
```

### PATCH /payments/:id/mark-paid · 🔒 Super Admin, Gerente
```json
{
  "monto_pagado": 185000,
  "referencia_transferencia": "REF20250630001",
  "fecha_pago": "2025-06-30",
  "uuid_cfdi": "A1B2C3D4-..."  // opcional
}
// estatus_pago → 'Pagado'
// commissions.estatus_comision → 'Pagada'
```

---

## Módulo Documentos · `/documents`

Tabla: `public.dim_documentos`

### POST /documents/upload · 🔒 Super Admin, Gerente, Asesor, Jurídico
```
Content-Type: multipart/form-data
Campos: file (archivo), entidad_relacionada, id_entidad, tipo_documento
Validaciones: tamaño máx según tipo (ver 05-seguridad-rls.md § 7.3)
Lógica: NestJS sube a Supabase Storage → crea dim_documentos → retorna id y url_firmada (1h)
```

### GET /documents/download/:id · 🔒 Según permisos sobre la entidad relacionada
```
Response: { "data": { "url": "https://signed-url...", "expires_in": 3600 } }
```

### GET /documents · 🔒 Según rol
```
Query params: entidad_relacionada, id_entidad, tipo_documento, estatus_documento
```

### PATCH /documents/:id/validate · 🔒 Super Admin, Gerente, Jurídico (solo docs jurídicos)
```json
{ "estatus_documento": "Validado", "observaciones": "" }
```

### PATCH /documents/:id/reject · 🔒 Super Admin, Gerente
```json
{ "estatus_documento": "Rechazado", "observaciones": "INE ilegible, favor de resubir" }
```

---

## Módulo AMA · `/ama`

Tabla: `public.fact_ama_asesor`

### GET /ama · 🔒 Super Admin, Director, Gerente, Auditor
Lista todos los períodos AMA activos con avance.

### GET /ama/:advisorId/current · 🔒 Super Admin, Gerente; Asesor solo propio
```json
// Response
{
  "data": {
    "id_asesor": "ADV-003",
    "fecha_inicio_periodo": "2025-01-15",
    "fecha_fin_periodo": "2026-01-14",
    "meta_ama": 180000,
    "monto_acumulado": 95000,
    "avance_pct": 52.78,
    "ama_alcanzada": "false",
    "estatus_ama": "En progreso"
  }
}
```

### POST /ama/start · 🔒 Super Admin, Gerente
Inicia período AMA para un asesor nuevo.
```json
{ "id_asesor": "ADV-003", "fecha_inicio": "2025-06-26", "meta_ama": 180000 }
```

### POST /ama/reset/:advisorId · 🔒 Super Admin
Reinicia período AMA (ej. asesor regresa de inactividad).
```json
{ "motivo": "Reincorporación tras baja temporal", "nueva_fecha_inicio": "2025-07-01" }
```

---

## Módulo Compliance / PLD · `/compliance`

Tabla: `public.compliance_cases`

### GET /compliance/cases · 🔒 Super Admin, Director, Gerente, Auditor
```
Query params: page, limit, status, risk_level
```

### GET /compliance/cases/:id · 🔒 Super Admin, Director, Gerente, Auditor

### PATCH /compliance/cases/:id · 🔒 Super Admin, Gerente, Auditor
```json
{
  "status": "Validado",
  "rfc_valid": true,
  "identification_valid": true,
  "pep_check": "negativo",
  "observations": "Se recibió pasaporte vigente. Caso liberado."
}
// Si status='Validado':
//   → Desbloquea commissions asociadas si el único bloqueo era KYC
//   → compliance_cases.status → 'Validado'
// Valores status: pendiente_docs | en_revision | Validado | Bloqueado
// Valores risk_level: bajo | Ámbar | Rojo
```

---

## Módulo Configuración · `/config`

Tabla: `public.config_parametros_comision`

### GET /config/params · 🔒 Super Admin, Director, Gerente, Auditor
Lista todos los parámetros activos con su valor actual.

### GET /config/params/:name · 🔒 Super Admin, Director
Retorna parámetro específico con historial de versiones.

### PATCH /config/params/:name · 🔒 Super Admin
```json
{
  "valor_numerico": 0.03,
  "vigente_desde": "2025-07-01",
  "motivo": "Ajuste aprobado en reunión de dirección Jun 2025"
}
// Lógica:
//   1. Registro actual → vigente_hasta = vigente_desde - 1 día, activo = false
//   2. Nuevo registro con valor_numerico y vigente_desde
//   3. Entrada en audit_logs
// No afecta commissions ya calculadas
```

---

## Módulo Auditoría · `/audit`

Tabla: `public.audit_logs`

### GET /audit · 🔒 Super Admin, Director, Auditor
```
Query params: page, limit, action, user_id, fecha_inicio, fecha_fin, tabla (operaciones/commissions/etc.)
```

---

## Módulo Dashboard · `/dashboard`

Vistas calculadas en el backend (queries contra múltiples tablas).

### GET /dashboard/kpis · 🔒 Super Admin, Director, Gerente, Auditor
```json
{
  "data": {
    "ventasAcumuladasYTD": 124500000.00,
    "rentasAcumuladasYTD": 28000000.00,
    "comisionesIngresadas": 8200000.00,
    "comisionesPagadas": 6500000.00,
    "comisionesBloqueadas": 450000.00,
    "comisionesBloqueadasCount": 12,
    "comisionesPendientesAutorizacion": 320000.00,
    "asesoresActivos": 42,
    "asesoresEnMentoria": 8,
    "propiedadesActivas": 95,
    "propiedadesSinContrato": 14,
    "cierresPendientesValidacion": 6
  }
}
```

### GET /dashboard/charts · 🔒 Super Admin, Director, Gerente, Auditor
```json
{
  "data": {
    "comisionesMensualesYTD": [
      { "mes": "Ene", "ingresada": 650000, "pagada": 500000, "bloqueada": 50000 }
    ],
    "distribucionTipoPropiedad": [
      { "tipo": "Casa", "count": 120 },
      { "tipo": "Departamento", "count": 85 }
    ],
    "distribucionTipoOperacion": [
      { "tipo": "Venta", "count": 38 },
      { "tipo": "Renta", "count": 24 }
    ]
  }
}
```

### GET /dashboard/rankings · 🔒 Super Admin, Director, Gerente, Auditor
```
Query params: tipo (captadores|vendedores|rentas|invitadores), mes, anio
Response: top 10 asesores según categoría
```

### GET /dashboard/advisor/:id · 🔒 Super Admin, Director, Gerente; Asesor solo propio
```json
{
  "data": {
    "asesor": { "id": "ADV-003", "name": "Carlos Pérez", "status": "Activo" },
    "ama": { "avance_pct": 52.78, "monto_acumulado": 95000, "meta_ama": 180000 },
    "comisionesGeneradasMes": 35000,
    "comisionesGeneradasAnio": 185000,
    "comisionesNetasRecibidas": 148000,
    "gratificacionesRecibidas": 4625,
    "mentoriasGeneradas": 7500,
    "captacionesActivas": 8,
    "cierresMes": 1,
    "cierresAnio": 4,
    "asesoresInvitados": [{ "id": "ADV-010", "name": "...", "status": "En mentoría" }]
  }
}
```

### GET /dashboard/inventory · 🔒 Todos los roles
```
Query params: tipo_operacion, zona
Response: conteos de propiedades por status
```

### GET /dashboard/birthdays · 🔒 Super Admin, Director, Gerente
```
Query params: mes (1-12, default mes actual)
Response: lista de asesores con cumpleaños en el mes
```

### GET /dashboard/pending-payments · 🔒 Super Admin, Director, Gerente
Lista de `fact_pagos` con `estatus_pago IN ('Solicitado', 'Autorizado')`, agrupados por semana.

### GET /dashboard/blocked-commissions · 🔒 Super Admin, Director, Gerente, Auditor
Lista de `commissions` con `estatus_comision='Bloqueada'` + razón del bloqueo.

---

## Tabla de nombres de tablas reales (DB) vs nombres en documentación

| Tabla en DB (`migration.sql`) | Nombre en docs de diseño | Nota |
|---|---|---|
| `usuarios` | `dim_usuarios` | Tabla real usa nombre corto |
| `advisors` | `dim_asesores` | Tabla real usa inglés |
| `properties` | `dim_propiedades` | Tabla real usa inglés |
| `operations` | `fact_cierres` | Tabla real usa inglés |
| `commissions` | `fact_comisiones` | Tabla real usa inglés |
| `compliance_cases` | `fact_compliance_casos` | Tabla real usa inglés |
| `audit_logs` | `audit_log` | Tabla real usa inglés |
| `dim_clientes` | `dim_clientes` | ✅ Coincide |
| `fact_captaciones` | `fact_captaciones` | ✅ Coincide |
| `fact_solicitudes_contrato` | `fact_solicitudes_contrato` | ✅ Coincide |
| `fact_pagos` | `fact_pagos` | ✅ Coincide |
| `dim_documentos` | `dim_documentos` | ✅ Coincide |
| `fact_ama_asesor` | `fact_ama_asesor` | ✅ Coincide |
| `config_parametros_comision` | `config_parametros_comision` | ✅ Coincide |
| `bridge_propiedad_propietarios` | `bridge_propiedad_propietarios` | ✅ Coincide |
| `bridge_operacion_asesores` | `bridge_operacion_asesores` | ✅ Coincide |

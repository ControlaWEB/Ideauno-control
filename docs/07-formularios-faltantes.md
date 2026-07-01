# 07. Formularios Faltantes — IDEA UNO OS

Complementa los formularios 1–6 del documento de estructura. Cubre flujos operativos sin formulario definido.

---

## Formulario 7 — Cambio de Estatus de Propiedad

**Objetivo:** Controlar transiciones de estatus del inventario.

**Rol:** Admin, Dirección.

**Tabla:** `dim_propiedades` (actualiza `id_estatus_propiedad`)

**Dónde aparece:** Dentro de la ficha de cada propiedad, botón/menú de acciones.

### Campos

| Campo | Tipo | Obligatorio | Lógica |
|---|---|---|---|
| Propiedad | Autocompletado (contexto) | Sí | Autocompletado desde contexto |
| Estatus actual | Solo lectura | — | Muestra estatus vigente |
| Nuevo estatus | Lista | Sí | Solo muestra estados válidos según máquina de estados |
| Motivo del cambio | Párrafo | Sí | Registra en audit_log |
| Adjunto (si aplica) | Archivo | No | Ej. documentación que desbloquea el estatus |

### Validaciones

- Si destino es `Activa`, `Publicable` o `Apartada`: verificar `contrato_comision_firmado = TRUE`. Si no, bloquear y mostrar mensaje.
- Si destino es `Vendida` o `Rentada`: solo permitir si existe cierre validado ligado a esa propiedad.
- Si destino es `Cancelada`: pedir confirmación explícita.

---

## Formulario 8 — Actualización de Solicitud de Contrato (Jurídico)

**Objetivo:** Permitir al área jurídica actualizar el estatus de una solicitud, adjuntar el contrato y comunicar al asesor.

**Rol:** Jurídico, Admin.

**Tabla:** `fact_solicitudes_contrato`, `dim_documentos`

### Campos

| Campo | Tipo | Obligatorio | Lógica |
|---|---|---|---|
| Solicitud | Autocompletado (contexto) | Sí | |
| Estatus actual | Solo lectura | — | |
| Nuevo estatus | Lista | Sí | Solo estados válidos desde el actual |
| Observaciones para el asesor | Párrafo | Condicional | Obligatorio si estatus = `Requiere información` |
| Documentación o contrato adjunto | Archivo | Condicional | Obligatorio si estatus = `Entregado` |
| Fecha estimada de entrega | Fecha | Condicional | Si estatus = `En elaboración` |

### Estatus y transiciones válidas

| Desde | Puede ir a |
|---|---|
| `Pendiente` | `En elaboración`, `Requiere información`, `Cancelado` |
| `En elaboración` | `Requiere información`, `Entregado`, `Cancelado` |
| `Requiere información` | `En elaboración`, `Cancelado` |
| `Entregado` | — (estado final) |
| `Cancelado` | — (estado final) |

---

## Formulario 9 — Cancelación de Captación

**Objetivo:** Registrar la cancelación de una propiedad en inventario con trazabilidad del motivo.

**Rol:** Admin.

**Tablas:** `fact_captaciones`, `dim_propiedades`

### Campos

| Campo | Tipo | Obligatorio |
|---|---|---|
| Propiedad | Autocompletado (contexto) | Sí |
| Motivo de cancelación | Lista | Sí |
| Detalle adicional | Párrafo | Condicional |
| Adjunto (ej. comunicación del propietario) | Archivo | No |
| Confirmación explícita | Checkbox | Sí |

### Opciones de motivo

- El propietario retiró la propiedad del mercado
- La propiedad fue vendida/rentada por otro medio
- Datos incorrectos — duplicado
- Incumplimiento de contrato de comisión
- Otro

### Acciones al cancelar

- `fact_captaciones.estatus_captacion → Cancelada`
- `dim_propiedades.id_estatus_propiedad → Cancelada`
- Si existe `fact_solicitudes_contrato` activa → pasar a `Cancelado`
- Si existe `fact_cierres` en `Solicitado` → bloquear cancelación, mostrar advertencia

---

## Formulario 10 — Asignación / Cambio de Mentor

**Objetivo:** Asignar o reasignar mentor a un asesor en mentoría.

**Rol:** Admin.

**Tabla:** `dim_asesores`

### Campos

| Campo | Tipo | Obligatorio | Lógica |
|---|---|---|---|
| Asesor | Selector | Sí | Solo asesores con `pasa_por_mentoria = TRUE` |
| Mentor actual | Solo lectura | — | Muestra mentor vigente si existe |
| Nuevo mentor | Selector de asesor activo | Sí | Solo asesores con `estatus_asesor = Activo` |
| Motivo del cambio | Párrafo | Opcional | |
| ¿El asesor egresa de mentoría? | Sí/No | Sí | Si Sí, cambia `pasa_por_mentoria = FALSE` |
| Fecha efectiva | Fecha | Sí | Desde cuándo aplica |

### Regla de egreso de mentoría

El sistema evalúa automáticamente si el asesor cumple `ventas_para_salir_mentoria` (parámetro configurable, default 2). Si cumple, muestra alerta y sugiere egreso. El admin confirma.

---

## Formulario 11 — Edición de Parámetros de Comisión

**Objetivo:** Modificar porcentajes y montos configurables sin tocar código.

**Rol:** Admin (Dirección solo lectura).

**Tabla:** `config_parametros_comision`

### Regla crítica

Un cambio en parámetros **no afecta cálculos históricos**. Los registros en `fact_comisiones` ya calculados conservan sus valores. Solo aplica a cierres registrados **después** del cambio.

### Campos

| Campo | Tipo | Obligatorio |
|---|---|---|
| Parámetro | Solo lectura (lista de parámetros) | — |
| Valor actual | Solo lectura | — |
| Nuevo valor | Número / Texto según tipo | Sí |
| Fecha de vigencia | Fecha | Sí |
| Motivo del cambio | Párrafo | Sí |
| Confirmación | Checkbox | Sí |

Texto de confirmación: *"Entiendo que este cambio aplica solo a operaciones nuevas y no modifica comisiones ya calculadas."*

### Implementación

Al editar un parámetro:
1. El registro actual en `config_parametros_comision` se marca `vigente_hasta = fecha_efectiva - 1`.
2. Se crea nuevo registro con `vigente_desde = fecha_efectiva` y `activo = TRUE`.
3. Se registra en `audit_log`.

---

## Formulario 12 — Invitación / Onboarding de Usuario

**Objetivo:** Dar acceso al sistema a un nuevo usuario (asesor o staff).

**Rol:** Admin.

**Tabla:** `dim_usuarios` (y Supabase Auth)

### Campos

| Campo | Tipo | Obligatorio | Destino |
|---|---|---|---|
| Nombre completo | Texto | Sí | `dim_usuarios.nombre_usuario` |
| Correo electrónico | Email | Sí | `auth.users.email` |
| Teléfono | Texto | No | `dim_usuarios.telefono` |
| Rol del sistema | Lista | Sí | `dim_usuarios.id_rol` |
| ¿Vincular con asesor existente? | Sí/No | Sí | Lógica |
| Asesor a vincular | Selector | Condicional | `dim_asesores.id_usuario` |

### Flujo

1. Admin llena formulario.
2. Backend llama `supabase.auth.admin.inviteUserByEmail({ email })`.
3. Supabase envía email con link de activación (expira en 24h).
4. Se crea registro en `dim_usuarios` con `estatus_usuario = 'Pendiente activación'`.
5. Al activar, `estatus_usuario → 'Activo'`.

---

## Formulario 13 — Edición de Propiedad Captada

**Objetivo:** Corregir o actualizar datos de una propiedad ya registrada.

**Rol:** Admin, y Asesor solo para sus captaciones en estatus `Incompleta` o `En revisión`.

**Tabla:** `dim_propiedades`, `dim_clientes`, `bridge_propiedad_propietarios`

### Restricciones de edición por estatus

| Estatus propiedad | Asesor puede editar | Admin puede editar |
|---|---|---|
| `Incompleta` | Sí | Sí |
| `En revisión` | Sí | Sí |
| `Activa` | No | Sí |
| `Publicable` | No | Sí |
| `Apartada` | No | Sí (con advertencia) |
| `Vendida` / `Rentada` | No | No (solo auditoría) |
| `Cancelada` | No | No |

### Campos editables

Todos los campos del Formulario 2 o 3 según tipo, excepto:
- `id_asesor_captador` — no editable (trazabilidad)
- `fecha_captacion` — no editable
- `tipo_operacion_principal` — no editable

Cambio de precio, datos de propietario, documentos y contrato de comisión siempre editables por admin.

---

## Formulario 14 — Cancelación de Operación (Cierre)

**Objetivo:** Cancelar un cierre ya registrado antes de que se libere el pago.

**Rol:** Admin.

**Tablas:** `fact_cierres`, `fact_comisiones`, `fact_pagos`

### Campos

| Campo | Tipo | Obligatorio |
|---|---|---|
| Operación | Autocompletado (contexto) | Sí |
| Motivo de cancelación | Lista | Sí |
| Detalle | Párrafo | Sí |
| Adjunto (ej. acuerdo de cancelación) | Archivo | Recomendado |
| Confirmación explícita | Checkbox | Sí |

### Opciones de motivo

- Operación no se concretó
- Incumplimiento del comprador/arrendatario
- Incumplimiento del vendedor/arrendador
- Error de captura
- Resolución legal
- Otro

### Restricción

No se puede cancelar si `estatus_cierre = Pagado`. En ese caso mostrar: *"Esta operación ya fue pagada. Contactar a administración para ajuste manual."*

### Acciones al cancelar

- `fact_cierres.estatus_cierre → Cancelado`
- `fact_comisiones.estatus_comision → Cancelada`
- `fact_pagos` pendientes o autorizados → `Cancelado`
- Revertir actualización de AMA (restar monto de `fact_ama_asesor.monto_acumulado`)
- Propiedad regresa a estatus anterior (si aplica)
- Registro en `audit_log`

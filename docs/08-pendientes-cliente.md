# 08. Pendientes de Confirmación con Cliente — IDEA UNO OS

Estas decisiones están bloqueando desarrollo o tienen impacto en schema ya parcialmente construido. Necesitan respuesta antes de avanzar en los módulos indicados.

---

## CRÍTICO — Bloquea desarrollo activo

### PC-01 · Modelo de comisiones — CONFLICTO EN DOCUMENTOS

**Estado:** Bloqueante. Dos documentos internos contradicen el spec original.

| Fuente | Modelo |
|---|---|
| `02-modelo-negocio.md` | 80% cerrador / 20% mentor sobre comisión total |
| `07-roadmap.md` | Confirma 80/20 |
| Spec del proyecto (documento entregado por cliente) | 2.5% invitación → remanente → 80% asesor (sin AMA) / 100% (con AMA) → 5% mentoría sobre pago asesor |
| `migration.sql` (DB real) | Columnas del spec detallado (invitación, remanente, mentoría separados) |

**El schema real ya fue construido para el spec detallado.** Confirmar cuál aplica antes de escribir el motor.

**Impacto:** `commissions`, `config_parametros_comision`, `/api/v1/commissions` entero.

---

### PC-02 · Roles del sistema — CONFLICTO EN DOCUMENTOS

**Estado:** Bloqueante. Cuatro listas de roles distintas circulan internamente.

| Fuente | Roles |
|---|---|
| `06-seguridad.md` | Super Admin, Director, Gerente, Asesor, Auditor (5) |
| `migration_v2.sql` (comentario) | Super Admin, Director, Gerente, Asesor, Auditor, Jurídico (6) |
| `04-api-endpoints.md` | Super Admin, Director, Gerente, Auditor (4) |
| Spec original del cliente | Administrador, Asesor, Jurídico, Dirección (4) |

**Lista canónica propuesta** (requiere confirmación):

| Rol | Descripción |
|---|---|
| `Super Admin` | Control total del sistema |
| `Director` | Vista completa + autorización de pagos |
| `Gerente` | Operación diaria, validaciones |
| `Asesor` | Captura propia, consulta propia |
| `Jurídico` | Gestión de contratos |
| `Auditor` | Solo lectura + audit_log |

**Preguntas:**
- ¿`Gerente` y `Super Admin` son roles distintos con permisos distintos o el mismo?
- ¿`Auditor` existe o es funcionalidad de `Director`?
- ¿`Jurídico` tiene acceso al sistema desde MVP?

**Impacto:** Guards NestJS, `usuarios.role`, matriz de permisos, RLS.

---

### PC-03 · ¿Jurídico entra en MVP?

**Estado:** Bloqueante para módulo `/contracts`.

Si Jurídico no entra en MVP: el módulo de solicitudes de contrato se limita a registro y cambio manual de estatus por Admin.

Si Jurídico entra en MVP: se necesita:
- Login con rol Jurídico
- Vista de solicitudes pendientes
- Formulario 8 (actualización de estatus por Jurídico)
- Carga de contratos elaborados

**Impacto:** 4–6 endpoints, 1 formulario, navegación.

---

## IMPORTANTE — Bloquea decisiones de negocio

### PC-04 · ¿El mentor siempre es el asesor invitador?

**Pregunta:** ¿El mentor que recibe el 5% (o el 20% en el modelo 80/20) es siempre el asesor que invitó, o puede ser otra persona asignada por administración?

**Impacto:** `advisors.id_mentor` vs `advisors.invite_by_advisor_id`. Actualmente ambas columnas existen en la DB.

---

### PC-05 · Datos bancarios — ¿cuándo son obligatorios?

**Pregunta:** ¿El asesor debe tener `clabe_interbancaria`, `banco`, `titular_cuenta` para poder registrarse, o se pueden agregar después?

**Propuesta:** Requeridos antes de solicitar primer pago (no al momento del alta).

**Impacto:** Validación en formulario de alta y en solicitud de pago.

---

### PC-06 · ¿Cómo se calculan comisiones en operaciones con asesor externo?

**Escenario:** El cierre involucra a un asesor de otra inmobiliaria representando al comprador.

**Preguntas:**
- ¿La comisión se divide antes de calcular el split interno?
- ¿El sistema registra cuánto se pagó al externo o solo es informativo?
- ¿Se requiere CFDI del externo para liberar la comisión interna?

**Impacto:** `bridge_operacion_asesores`, motor de comisiones, flujo de pago.

---

### PC-07 · ¿Qué pasa con comisión si operación se cancela post-pago?

**Pregunta:** Si ya se pagó la comisión y la operación se cancela, ¿el sistema registra un ajuste, o eso queda fuera del alcance del sistema?

**Impacto:** Formulario 14 (cancelación de cierre), `commissions.status`.

---

### PC-08 · Formas de pago — ¿efectivo, transferencia, CFDI?

**Pregunta:** ¿Los pagos de comisión son siempre transferencia bancaria, o también en efectivo? ¿Siempre requieren CFDI o es opcional?

**Impacto:** Campos `forma_pago`, `requiere_cfdi`, `uuid_cfdi` en `fact_pagos`. Flujo de autorización.

---

### PC-09 · ¿Quién puede modificar `config_parametros_comision`?

**Pregunta:** ¿Solo `Super Admin` o también `Director`?

**Impacto:** Guard en `PATCH /config/params/:name`.

---

### PC-10 · ¿Quién valida expedientes y quién autoriza pagos?

**Pregunta:** ¿Son la misma persona (mismo rol) o roles distintos?

**Opciones:**
- Misma persona: `Gerente` o `Super Admin` hace ambas
- Distintas: `Gerente` valida expedientes, `Director` autoriza pagos

**Impacto:** Guards en `PATCH /operations/:id/validate` y `PATCH /payments/:id/authorize`.

---

## MENOR — Puede asumirse un default razonable

### PC-11 · ¿Beneficiario recibe gratificación si el invitador fallece?

**Default propuesto:** No — el sistema no procesa pagos a beneficiarios. Solo sirve como dato de contacto de emergencia.

---

### PC-12 · ¿Qué documentos son obligatorios para publicar propiedad?

**Default propuesto:**
- Contrato de comisión mercantil firmado (bloqueante desde reglas actuales)
- INE del propietario
- Documento que acredite la propiedad

---

### PC-13 · ¿Qué documentos son obligatorios para liberar comisión?

**Default propuesto:**
- Expediente PLD completo (formato KYC firmado, INE, RFC)
- Documento que acredita el cierre (contrato firmado o escritura)
- Declaraciones del asesor marcadas

---

### PC-14 · ¿El asesor ve inventario completo o solo propiedades activas/publicables?

**Default propuesto:** Asesor ve solo propiedades con estatus `Activa` o `Publicable`. Sus propias captaciones las ve en cualquier estatus.

---

## Resumen de prioridad

| ID | Impacto | Estado sugerido |
|---|---|---|
| PC-01 | Motor de comisiones completo | Resolver esta semana |
| PC-02 | Guards y roles en toda la app | Resolver esta semana |
| PC-03 | Módulo Jurídico MVP | Resolver antes de sprint 2 |
| PC-04 | Campo mentor en DB | Resolver antes de motor |
| PC-05 | Validación alta asesor | Resolver antes de formulario 1 |
| PC-06 | Motor comisiones externo | Resolver antes de motor |
| PC-07 | Flujo cancelación | Puede esperar fase 2 |
| PC-08 | Formulario de pagos | Resolver antes de sprint pagos |
| PC-09 | Permisos config | Default: Solo Super Admin |
| PC-10 | Permisos validación/autorización | Resolver antes de sprint admin |
| PC-11–14 | Defaults de negocio | Asumir defaults propuestos si no responde |

# 03. Modelo de Datos Completo — IDEA UNO OS

Base de datos: PostgreSQL vía Supabase. Convención: `snake_case`. Prefijos semánticos conservados para claridad de dominio.

---

## Convención de IDs

Todos los IDs son `UUID` generados por PostgreSQL (`gen_random_uuid()`). No usar secuencias numéricas.

---

## Catálogos

### cat_roles

```sql
CREATE TABLE cat_roles (
  id_rol        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_rol    TEXT NOT NULL UNIQUE,  -- ADMIN, ASESOR, JURIDICO, DIRECCION
  descripcion   TEXT,
  activo        BOOLEAN DEFAULT TRUE
);
```

Valores iniciales: `ADMIN`, `ASESOR`, `JURIDICO`, `DIRECCION`

---

### cat_estatus_asesor

```sql
CREATE TABLE cat_estatus_asesor (
  id_estatus  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL UNIQUE
);
```

Valores: `Activo`, `En mentoría`, `Inactivo`, `Baja definitiva`

---

### cat_estatus_propiedad

```sql
CREATE TABLE cat_estatus_propiedad (
  id_estatus  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL UNIQUE,
  permite_publicar  BOOLEAN DEFAULT FALSE
);
```

Valores y transiciones:

| Estatus | Permite publicar | Quién asigna | Desde qué estados |
|---|---|---|---|
| `Incompleta` | No | Sistema automático | Alta nueva sin contrato |
| `En revisión` | No | Sistema automático | Alta nueva con contrato |
| `Activa` | Sí | Admin | En revisión |
| `Publicable` | Sí | Admin | Activa |
| `Apartada` | No | Admin/Asesor | Activa, Publicable |
| `Vendida` | No | Sistema (al cierre validado) | Activa, Publicable, Apartada |
| `Rentada` | No | Sistema (al cierre validado) | Activa, Publicable, Apartada |
| `Suspendida` | No | Admin | Cualquiera |
| `Cancelada` | No | Admin | Cualquiera excepto Vendida/Rentada |

**Regla crítica:** Transición a `Activa`, `Publicable`, `Apartada` bloqueada si `contrato_comision_firmado = FALSE`.

---

### cat_tipo_propiedad

```sql
CREATE TABLE cat_tipo_propiedad (
  id_tipo  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre   TEXT NOT NULL UNIQUE
);
```

Valores: `Casa`, `Departamento`, `Terreno`, `Local comercial`, `Oficina`, `Bodega`, `Nave industrial`, `Rancho`, `Otro`

---

### cat_tipo_operacion

```sql
CREATE TABLE cat_tipo_operacion (
  id_tipo  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre   TEXT NOT NULL UNIQUE  -- Venta, Renta
);
```

---

### cat_forma_pago

```sql
CREATE TABLE cat_forma_pago (
  id_forma  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre    TEXT NOT NULL UNIQUE,
  activo    BOOLEAN DEFAULT TRUE
);
```

Valores: `Contado`, `Crédito bancario`, `Infonavit`, `Fovissste`, `Cofinavit`, `Combinado`, `Otro`

---

### cat_estado_civil

```sql
CREATE TABLE cat_estado_civil (
  id_estado  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre     TEXT NOT NULL UNIQUE
);
```

Valores: `Soltero(a)`, `Casado(a)`, `Divorciado(a)`, `Viudo(a)`, `Unión libre`

---

### cat_tipo_documento

```sql
CREATE TABLE cat_tipo_documento (
  id_tipo          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL UNIQUE,
  entidad_aplica   TEXT NOT NULL,  -- asesor, propiedad, cliente, cierre
  obligatorio      BOOLEAN DEFAULT FALSE,
  activo           BOOLEAN DEFAULT TRUE
);
```

---

### cat_estatus_documento

```sql
CREATE TABLE cat_estatus_documento (
  id_estatus  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL UNIQUE
);
```

Valores: `Pendiente`, `Validado`, `Rechazado`, `Sustituido`

---

## Dimensiones

### dim_usuarios

Vinculada con `auth.users` de Supabase. El `id_usuario` es el mismo UUID que `auth.users.id`.

```sql
CREATE TABLE dim_usuarios (
  id_usuario      UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_usuario  TEXT NOT NULL,
  correo          TEXT NOT NULL UNIQUE,
  telefono        TEXT,
  id_rol          UUID NOT NULL REFERENCES cat_roles(id_rol),
  estatus_usuario TEXT NOT NULL DEFAULT 'Activo',
  fecha_alta      TIMESTAMPTZ DEFAULT NOW(),
  ultimo_acceso   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### dim_asesores

```sql
CREATE TABLE dim_asesores (
  id_asesor               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_usuario              UUID REFERENCES dim_usuarios(id_usuario),
  nombre_asesor           TEXT NOT NULL,
  telefono                TEXT NOT NULL,
  correo                  TEXT NOT NULL UNIQUE,
  rfc                     TEXT,
  curp                    TEXT NOT NULL,
  fecha_nacimiento        DATE,
  fecha_alta_asesor       DATE NOT NULL,
  id_asesor_invitador     UUID REFERENCES dim_asesores(id_asesor),
  nombre_beneficiario     TEXT NOT NULL,
  telefono_beneficiario   TEXT,
  correo_beneficiario     TEXT,
  estatus_asesor          TEXT NOT NULL DEFAULT 'Activo',
  pasa_por_mentoria       BOOLEAN DEFAULT FALSE,
  id_mentor               UUID REFERENCES dim_asesores(id_asesor),
  ventas_acumuladas       NUMERIC(15,2) DEFAULT 0,
  url_foto                TEXT,
  -- Datos bancarios (obligatorios para liberar comisión)
  clabe_interbancaria     TEXT,
  banco                   TEXT,
  titular_cuenta          TEXT,
  -- Baja
  fecha_baja              DATE,
  motivo_baja             TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

**Nota:** `id_asesor_invitador` e `id_mentor` no se anulan si el referenciado da de baja. La FK usa `ON DELETE SET NULL` solo para casos de eliminación definitiva de registro (raro); baja operativa usa `estatus_asesor = 'Baja definitiva'` sin romper la relación.

---

### dim_clientes

```sql
CREATE TABLE dim_clientes (
  id_cliente            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cliente          TEXT NOT NULL,  -- Comprador, Arrendatario, Propietario, Aval, Obligado solidario
  nombre_razon_social   TEXT NOT NULL,
  persona_tipo          TEXT NOT NULL DEFAULT 'Física',  -- Física, Moral
  telefono              TEXT NOT NULL,
  correo                TEXT,
  rfc                   TEXT,
  curp                  TEXT,
  fecha_nacimiento      DATE,
  nacionalidad          TEXT DEFAULT 'Mexicana',
  id_estado_civil       UUID REFERENCES cat_estado_civil(id_estado),
  regimen_patrimonial   TEXT,  -- Sociedad conyugal, Separación de bienes
  nombre_conyuge        TEXT,
  domicilio             TEXT,
  ocupacion             TEXT,
  es_pep                BOOLEAN DEFAULT FALSE,
  origen_recursos       TEXT,
  estatus_kyc           TEXT NOT NULL DEFAULT 'Pendiente',  -- Pendiente, En revisión, Validado, Rechazado
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### dim_propiedades

```sql
CREATE TABLE dim_propiedades (
  id_propiedad                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_operacion_principal        TEXT NOT NULL,  -- Venta, Renta
  id_tipo_propiedad               UUID REFERENCES cat_tipo_propiedad(id_tipo),
  direccion_completa              TEXT NOT NULL,
  ciudad                          TEXT NOT NULL,
  estado                          TEXT NOT NULL,
  zona                            TEXT,
  latitud                         NUMERIC(10,7),
  longitud                        NUMERIC(10,7),
  url_maps                        TEXT,
  superficie_terreno_m2           NUMERIC(10,2),
  superficie_construccion_m2      NUMERIC(10,2),
  frente_m                        NUMERIC(8,2),
  fondo_m                         NUMERIC(8,2),
  recamaras                       INTEGER,
  banos_completos                 INTEGER,
  medios_banos                    INTEGER,
  estacionamientos                INTEGER,
  niveles                         INTEGER,
  antiguedad                      TEXT,
  estado_conservacion             TEXT,  -- Excelente, Bueno, Regular, Requiere remodelación
  situacion_actual                TEXT,  -- Habitada por propietario, Rentada, Desocupada
  precio_solicitado               NUMERIC(15,2),
  renta_mensual_solicitada        NUMERIC(12,2),
  cuota_mantenimiento             NUMERIC(10,2),
  descripcion_amenidades          TEXT,
  id_estatus_propiedad            UUID REFERENCES cat_estatus_propiedad(id_estatus),
  id_asesor_captador              UUID REFERENCES dim_asesores(id_asesor),
  fecha_captacion                 DATE,
  contrato_comision_firmado       BOOLEAN DEFAULT FALSE,
  fecha_firma_contrato_comision   DATE,
  vigencia_contrato_comision      DATE,
  porcentaje_comision_pactado     NUMERIC(5,2),
  -- Herencia / gravamen
  proviene_herencia               BOOLEAN DEFAULT FALSE,
  adjudicacion_concluida          BOOLEAN,
  tiene_hipoteca                  BOOLEAN DEFAULT FALSE,
  institucion_acreedora           TEXT,
  saldo_hipoteca_aprox            NUMERIC(15,2),
  created_at                      TIMESTAMPTZ DEFAULT NOW(),
  updated_at                      TIMESTAMPTZ DEFAULT NOW()
);
```

---

### dim_personas_externas

Asesores o intermediarios de otras inmobiliarias que participan en operaciones sin ser usuarios del sistema.

```sql
CREATE TABLE dim_personas_externas (
  id_persona_externa  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  telefono            TEXT,
  correo              TEXT,
  inmobiliaria        TEXT,
  rfc                 TEXT,
  notas               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Hechos

### fact_captaciones

```sql
CREATE TABLE fact_captaciones (
  id_captacion            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_propiedad            UUID NOT NULL REFERENCES dim_propiedades(id_propiedad),
  id_asesor               UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  tipo_captacion          TEXT NOT NULL,  -- Venta, Renta
  fecha_captacion         DATE NOT NULL DEFAULT CURRENT_DATE,
  autorizacion_promocion  BOOLEAN NOT NULL DEFAULT FALSE,
  tipo_autorizacion       TEXT,  -- Exclusiva, No exclusiva, Verbal
  contrato_comision_firmado BOOLEAN DEFAULT FALSE,
  estatus_captacion       TEXT NOT NULL DEFAULT 'Activa',  -- Activa, Cancelada, Concluida
  observaciones           TEXT,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

---

### fact_solicitudes_contrato

```sql
CREATE TABLE fact_solicitudes_contrato (
  id_solicitud_contrato   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_solicitud          TEXT NOT NULL,  -- Promesa compraventa, Contrato arrendamiento
  id_propiedad            UUID NOT NULL REFERENCES dim_propiedades(id_propiedad),
  id_asesor_solicitante   UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  fecha_solicitud         TIMESTAMPTZ DEFAULT NOW(),
  estatus_solicitud       TEXT NOT NULL DEFAULT 'Pendiente',
  precio_renta_acordada   NUMERIC(12,2),
  fecha_firma_estimada    DATE,
  fecha_entrega_estimada  DATE,
  observaciones_juridico  TEXT,
  confirmacion_asesor     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

Estatus válidos: `Pendiente`, `En elaboración`, `Requiere información`, `Entregado`, `Cancelado`

---

### fact_cierres

```sql
CREATE TABLE fact_cierres (
  id_operacion                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_operacion              TEXT NOT NULL,  -- Venta, Renta
  id_propiedad                UUID REFERENCES dim_propiedades(id_propiedad),
  propiedad_registrada        BOOLEAN NOT NULL DEFAULT TRUE,
  -- Si propiedad externa (no registrada)
  tipo_cierre_externo         TEXT,
  direccion_cierre_externo    TEXT,
  tipo_inmueble_cierre_externo TEXT,
  -- Datos económicos
  valor_total_operacion       NUMERIC(15,2) NOT NULL,
  precio_renta_final          NUMERIC(12,2),
  fecha_cierre                DATE NOT NULL,
  monto_comision_generada     NUMERIC(15,2) NOT NULL,
  -- Asesor
  id_asesor_cerrador          UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  -- Control
  estatus_cierre              TEXT NOT NULL DEFAULT 'Solicitado',
  pld_expediente_completo     BOOLEAN DEFAULT FALSE,
  pld_semaforo                TEXT DEFAULT 'Verde',  -- Verde, Ámbar, Rojo
  umbral_pld_superado         BOOLEAN DEFAULT FALSE,
  validado_por_admin          UUID REFERENCES dim_usuarios(id_usuario),
  fecha_validacion_admin      TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ DEFAULT NOW()
);
```

Estatus válidos: `Solicitado`, `En revisión`, `Validado por administración`, `Bloqueado por documentación`, `Liberado para pago`, `Pagado`, `Cancelado`

---

### fact_comisiones

```sql
CREATE TABLE fact_comisiones (
  id_comision             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_operacion            UUID NOT NULL REFERENCES fact_cierres(id_operacion),
  id_asesor_cerrador      UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  -- Comisión total
  monto_comision_total    NUMERIC(15,2) NOT NULL,
  -- Gratificación por invitación
  porcentaje_invitacion   NUMERIC(5,4) DEFAULT 0,
  monto_invitacion        NUMERIC(15,2) DEFAULT 0,
  id_asesor_invitador     UUID REFERENCES dim_asesores(id_asesor),
  -- Remanente
  monto_remanente         NUMERIC(15,2) NOT NULL,
  -- Pago a asesor
  aplica_ama              BOOLEAN DEFAULT FALSE,
  porcentaje_asesor       NUMERIC(5,4) NOT NULL,
  monto_base_asesor       NUMERIC(15,2) NOT NULL,
  -- Mentoría
  aplica_mentoria         BOOLEAN DEFAULT FALSE,
  porcentaje_mentoria     NUMERIC(5,4) DEFAULT 0,
  monto_mentoria          NUMERIC(15,2) DEFAULT 0,
  id_mentor               UUID REFERENCES dim_asesores(id_asesor),
  -- Neto asesor e inmobiliaria
  monto_neto_asesor       NUMERIC(15,2) NOT NULL,
  monto_inmobiliaria      NUMERIC(15,2) NOT NULL,
  -- Estatus
  estatus_comision        TEXT NOT NULL DEFAULT 'Calculada',
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

Estatus válidos: `Calculada`, `Bloqueada`, `Pendiente validación`, `Liberada`, `Solicitada`, `Pagada`, `Cancelada`

---

### fact_comisiones_externas

Registra montos acordados o pagados a asesores/inmobiliarias externas en operaciones compartidas.

```sql
CREATE TABLE fact_comisiones_externas (
  id_comision_externa   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_operacion          UUID NOT NULL REFERENCES fact_cierres(id_operacion),
  id_persona_externa    UUID REFERENCES dim_personas_externas(id_persona_externa),
  -- Si no está en dim_personas_externas, se captura directo
  nombre_externo        TEXT,
  inmobiliaria_externa  TEXT,
  telefono_externo      TEXT,
  correo_externo        TEXT,
  tipo_parte            TEXT NOT NULL,  -- Vendedor, Comprador, Arrendador, Arrendatario
  monto_comision_acordado NUMERIC(15,2),
  monto_pagado          NUMERIC(15,2),
  estatus_pago          TEXT DEFAULT 'Pendiente',  -- Pendiente, Pagado, Cancelado
  requiere_factura      BOOLEAN DEFAULT FALSE,
  rfc_externo           TEXT,
  notas                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

---

### fact_pagos

```sql
CREATE TABLE fact_pagos (
  id_pago                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_comision             UUID NOT NULL REFERENCES fact_comisiones(id_comision),
  id_asesor               UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  fecha_solicitud         TIMESTAMPTZ DEFAULT NOW(),
  monto_solicitado        NUMERIC(15,2) NOT NULL,
  monto_pagado            NUMERIC(15,2),
  forma_pago              TEXT,  -- Transferencia, Efectivo, Cheque
  requiere_cfdi           BOOLEAN DEFAULT FALSE,
  uuid_cfdi               TEXT,  -- UUID del CFDI emitido si aplica
  retenciones_aplicadas   NUMERIC(15,2) DEFAULT 0,
  referencia_transferencia TEXT,  -- Número de folio o referencia bancaria
  estatus_pago            TEXT NOT NULL DEFAULT 'Solicitado',
  fecha_pago              TIMESTAMPTZ,
  autorizado_por          UUID REFERENCES dim_usuarios(id_usuario),
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);
```

Estatus válidos: `Solicitado`, `Validado por administración`, `Autorizado`, `Pagado`, `Rechazado`, `Cancelado`

---

### fact_ama_asesor

```sql
CREATE TABLE fact_ama_asesor (
  id_periodo_ama        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_asesor             UUID NOT NULL REFERENCES dim_asesores(id_asesor),
  fecha_inicio_periodo  DATE NOT NULL,
  fecha_fin_periodo     DATE NOT NULL,
  meta_ama              NUMERIC(15,2) NOT NULL,
  monto_acumulado       NUMERIC(15,2) DEFAULT 0,
  avance_pct            NUMERIC(5,2) DEFAULT 0,
  ama_alcanzada         BOOLEAN DEFAULT FALSE,
  fecha_ama_alcanzada   DATE,
  estatus_ama           TEXT NOT NULL DEFAULT 'En progreso',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);
```

Estatus válidos: `En progreso`, `80% alcanzado`, `AMA alcanzada`, `Reiniciado`

---

## Tablas Puente

### bridge_propiedad_propietarios

```sql
CREATE TABLE bridge_propiedad_propietarios (
  id_relacion               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_propiedad              UUID NOT NULL REFERENCES dim_propiedades(id_propiedad),
  id_cliente                UUID NOT NULL REFERENCES dim_clientes(id_cliente),
  tipo_relacion             TEXT NOT NULL,
  porcentaje_participacion  NUMERIC(5,2),
  es_propietario_principal  BOOLEAN DEFAULT FALSE,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);
```

Valores de `tipo_relacion`: `Propietario`, `Copropietario`, `Cónyuge`, `Apoderado`, `Representante legal`, `Albacea`

---

### bridge_operacion_asesores

```sql
CREATE TABLE bridge_operacion_asesores (
  id_participacion        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_operacion            UUID NOT NULL REFERENCES fact_cierres(id_operacion),
  tipo_parte_representada TEXT NOT NULL,  -- Propietario, Comprador, Arrendador, Arrendatario
  tipo_participante       TEXT NOT NULL,  -- Yo mismo, Otro asesor Idea Uno, Asesor externo, Cliente directo
  id_asesor               UUID REFERENCES dim_asesores(id_asesor),
  id_persona_externa      UUID REFERENCES dim_personas_externas(id_persona_externa),
  porcentaje_participacion NUMERIC(5,2),
  created_at              TIMESTAMPTZ DEFAULT NOW()
);
```

---

### bridge_expediente_documentos

Agrupa documentos que conforman un expediente específico (ej. expediente PLD de un cierre).

```sql
CREATE TABLE bridge_expediente_documentos (
  id_expediente_doc   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_expediente     TEXT NOT NULL,  -- PLD, asesor, propiedad, cierre
  id_entidad          UUID NOT NULL,  -- ID del asesor / cierre / propiedad
  id_documento        UUID NOT NULL REFERENCES dim_documentos(id_documento),
  obligatorio         BOOLEAN DEFAULT FALSE,
  orden               INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Documentos

### dim_documentos

```sql
CREATE TABLE dim_documentos (
  id_documento        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidad_relacionada TEXT NOT NULL,
  id_entidad          UUID NOT NULL,
  tipo_documento      TEXT NOT NULL,
  nombre_archivo      TEXT NOT NULL,
  extension           TEXT NOT NULL,
  mime_type           TEXT,
  storage_path        TEXT NOT NULL,  -- Ruta en Supabase Storage
  url_archivo         TEXT NOT NULL,  -- URL firmada o pública
  subido_por          UUID NOT NULL REFERENCES dim_usuarios(id_usuario),
  fecha_carga         TIMESTAMPTZ DEFAULT NOW(),
  id_estatus_documento UUID REFERENCES cat_estatus_documento(id_estatus),
  validado_por        UUID REFERENCES dim_usuarios(id_usuario),
  fecha_validacion    TIMESTAMPTZ,
  observaciones       TEXT
);
```

Valores de `entidad_relacionada`: `asesor`, `cliente`, `propiedad`, `captacion`, `solicitud_contrato`, `cierre`, `comision`, `pago`

---

## Configuración

### config_parametros_comision

```sql
CREATE TABLE config_parametros_comision (
  id_parametro      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre_parametro  TEXT NOT NULL UNIQUE,
  valor_numerico    NUMERIC(15,6),
  valor_texto       TEXT,
  tipo_valor        TEXT NOT NULL,  -- numerico, texto, booleano
  descripcion       TEXT,
  vigente_desde     DATE NOT NULL DEFAULT CURRENT_DATE,
  vigente_hasta     DATE,
  activo            BOOLEAN DEFAULT TRUE,
  actualizado_por   UUID REFERENCES dim_usuarios(id_usuario),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

Parámetros iniciales:

| nombre_parametro | valor_numerico | descripción |
|---|---|---|
| `porcentaje_invitacion` | 0.025 | 2.5% sobre comisión total |
| `porcentaje_asesor_normal` | 0.80 | 80% del remanente sin AMA |
| `porcentaje_mentoria` | 0.05 | 5% sobre monto base asesor |
| `minimo_exento_mentoria_renta` | 5000 | Comisión mínima para aplicar mentoría en rentas |
| `meta_ama` | 180000 | Meta anual en MXN |
| `duracion_anio_operativo_meses` | 12 | Meses del año operativo |
| `ventas_para_salir_mentoria` | 2 | Número de ventas para egresar de mentoría |
| `umbral_pld` | 941412.75 | Umbral LFPIORPI en MXN |

---

### config_documentos_obligatorios

Define qué documentos son obligatorios para cada evento del sistema.

```sql
CREATE TABLE config_documentos_obligatorios (
  id_config         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento            TEXT NOT NULL,  -- alta_asesor, publicar_propiedad, liberar_comision, etc.
  tipo_documento    TEXT NOT NULL,
  obligatorio       BOOLEAN DEFAULT TRUE,
  condicional       BOOLEAN DEFAULT FALSE,
  condicion         TEXT,  -- descripción de la condición si aplica
  activo            BOOLEAN DEFAULT TRUE,
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
```

Eventos definidos: `alta_asesor`, `captacion_venta`, `captacion_renta`, `solicitud_contrato`, `registro_cierre`, `liberar_comision`

---

## Auditoría

### audit_log

Poblado por triggers PostgreSQL en tablas críticas. Ver `06-motor-comisiones.md` para detalle de triggers.

```sql
CREATE TABLE audit_log (
  id_evento         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabla_afectada    TEXT NOT NULL,
  id_registro       UUID NOT NULL,
  accion            TEXT NOT NULL,  -- INSERT, UPDATE, DELETE
  id_usuario        UUID REFERENCES dim_usuarios(id_usuario),
  fecha_evento      TIMESTAMPTZ DEFAULT NOW(),
  valor_anterior    JSONB,
  valor_nuevo       JSONB,
  ip_origen         TEXT,
  comentarios       TEXT
);
```

Tablas con trigger de auditoría obligatorio: `fact_cierres`, `fact_comisiones`, `fact_pagos`, `dim_asesores`, `dim_propiedades`, `config_parametros_comision`

---

## Vistas para Dashboard

Reemplazan las `master_*` del diseño original (que eran para BigQuery). En PostgreSQL se implementan como vistas materializadas con refresh programado.

### Frecuencia de refresh sugerida

| Vista | Frecuencia |
|---|---|
| `view_operaciones_dashboard` | Diaria (job nocturno) o manual post-cierre |
| `view_asesores_dashboard` | Diaria |
| `view_inventario_dashboard` | En tiempo real (vista simple, no materializada) |
| `view_pagos_pendientes` | En tiempo real |

Las definiciones SQL de estas vistas se documentan en `05-seguridad-rls.md` junto con las políticas de acceso.

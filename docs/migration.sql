-- ============================================================
-- IDEA UNO CONTROL — Migration SQL
-- Ejecutar en Supabase → SQL Editor
-- Seguro correr múltiples veces (IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- ── RPC helpers (necesarios para DatabaseService) ──────────
CREATE OR REPLACE FUNCTION exec_sql_select(sql_text TEXT, params TEXT[])
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  result JSONB;
  i INT;
BEGIN
  FOR i IN 1..array_length(params, 1) LOOP
    sql_text := regexp_replace(sql_text, '\$' || i, quote_literal(params[i]), 'g');
  END LOOP;
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || sql_text || ') t' INTO result;
  RETURN COALESCE(result, '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION exec_sql_dml(sql_text TEXT, params TEXT[])
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i INT;
BEGIN
  FOR i IN 1..array_length(params, 1) LOOP
    sql_text := regexp_replace(sql_text, '\$' || i, quote_literal(params[i]), 'g');
  END LOOP;
  EXECUTE sql_text;
END;
$$;

-- ── 1. USUARIOS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usuarios (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'Asesor',
  status      TEXT NOT NULL DEFAULT 'Active',
  avatar_url  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. ADVISORS ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.advisors (
  id                    TEXT PRIMARY KEY,
  user_id               UUID,
  name                  TEXT NOT NULL,
  email                 TEXT DEFAULT '',
  phone                 TEXT DEFAULT '',
  specialty             TEXT DEFAULT 'General',
  license               TEXT DEFAULT '',
  status                TEXT DEFAULT 'Activo',
  invite_by_advisor_id  TEXT DEFAULT 'Directo',
  meta_ama              NUMERIC DEFAULT 0,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS rfc TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS curp TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS fecha_alta_asesor DATE;
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS pasa_por_mentoria TEXT DEFAULT 'false';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS id_mentor TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS nombre_beneficiario TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS telefono_beneficiario TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS correo_beneficiario TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS ventas_acumuladas NUMERIC DEFAULT 0;
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS fecha_baja DATE;
ALTER TABLE public.advisors ADD COLUMN IF NOT EXISTS motivo_baja TEXT DEFAULT '';

-- ── 3. CLIENTS ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT DEFAULT '',
  phone      TEXT DEFAULT '',
  rfc        TEXT DEFAULT '',
  type       TEXT DEFAULT 'Individual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── 4. PROPERTIES ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.properties (
  id      TEXT PRIMARY KEY,
  code    TEXT DEFAULT '',
  folio   TEXT DEFAULT '',
  type    TEXT DEFAULT '',
  status  TEXT DEFAULT 'Incompleta',
  price   NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'MXN',
  address TEXT DEFAULT '',
  city    TEXT DEFAULT '',
  state   TEXT DEFAULT '',
  zip_code TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  advisor_id TEXT DEFAULT '',
  description TEXT DEFAULT '',
  area_sqm NUMERIC DEFAULT 0,
  image_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_operacion TEXT DEFAULT 'Venta';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_inmueble TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_phone TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_email TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_rfc TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_curp TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS owner_estado_civil TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS adquirida_matrimonio TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS regimen_matrimonial TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS nombre_conyuge TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS conyuge_de_acuerdo TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_copropietarios TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS copropietarios TEXT DEFAULT '[]';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS quien_realiza_venta TEXT DEFAULT 'Propietario';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_predial TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_agua TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_luz TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_avaluo TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tiene_hipoteca TEXT DEFAULT 'no';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS institucion_acreedora TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS saldo_hipoteca NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS proviene_herencia TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS adjudicacion_concluida TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS zona TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS maps_url TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS superficie_terreno_m2 NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS superficie_construccion_m2 NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS frente_m NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS fondo_m NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS recamaras INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS banos_completos INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS medios_banos INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS estacionamientos INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS niveles INTEGER DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS antiguedad TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS estado_conservacion TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS situacion_actual TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS es_negociable TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS formas_pago TEXT DEFAULT '[]';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS cuota_mantenimiento NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS amenidades TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS fecha_captacion DATE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS autorizacion_promocion TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_autorizacion TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS contrato_comision_firmado TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS fecha_firma_contrato DATE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS vigencia_contrato TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS porcentaje_comision_pactado NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS observaciones_captacion TEXT DEFAULT '';
-- Renta fields
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS tipo_operacion_principal TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS renta_mensual_solicitada NUMERIC DEFAULT 0;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS deposito_requerido TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS plazo_minimo_contrato TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS acepta_mascotas TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS acepta_estudiantes TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS acepta_empresas TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS requiere_aval TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS acepta_obligado_solidario TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS requiere_poliza_juridica TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS servicios_incluidos TEXT DEFAULT '[]';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS equipamiento_incluido TEXT DEFAULT '[]';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS disponible_mostrarse TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS fecha_disponibilidad DATE;
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS autoriza_promocion TEXT DEFAULT 'false';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS doc_acredita_propiedad TEXT DEFAULT '';
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS quien_realiza_contrato TEXT DEFAULT '';

-- ── 5. OPERATIONS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.operations (
  id               TEXT PRIMARY KEY,
  code             TEXT DEFAULT '',
  property_id      TEXT DEFAULT '',
  client_id        TEXT DEFAULT '',
  advisor_id       TEXT DEFAULT '',
  type             TEXT DEFAULT 'Venta',
  status           TEXT DEFAULT 'Solicitado',
  contract_value   NUMERIC DEFAULT 0,
  currency         TEXT DEFAULT 'MXN',
  commission_rate  NUMERIC DEFAULT 0,
  total_commission NUMERIC DEFAULT 0,
  compliance_status TEXT DEFAULT 'Verde',
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS propiedad_en_inventario TEXT DEFAULT 'true';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS tipo_cierre_externo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS direccion_cierre_externo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS tipo_inmueble_externo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS precio_final_cierre NUMERIC DEFAULT 0;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS fecha_cierre DATE;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS monto_comision_generada NUMERIC DEFAULT 0;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS doc_cierre_tipo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS pld_tipo_cliente TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS pld_expediente_completo TEXT DEFAULT 'false';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS rep_vendedor_tipo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS rep_comprador_tipo TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS asesor_externo_vendedor TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS asesor_externo_comprador TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS solicita_liberacion TEXT DEFAULT 'false';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS validado_por_admin BOOLEAN DEFAULT false;
ALTER TABLE public.operations ADD COLUMN IF NOT EXISTS fecha_validacion_admin DATE;

-- ── 6. COMMISSIONS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.commissions (
  id           TEXT PRIMARY KEY,
  operation_id TEXT DEFAULT '',
  advisor_id   TEXT DEFAULT '',
  type         TEXT DEFAULT 'cierre',
  amount       NUMERIC DEFAULT 0,
  status       TEXT DEFAULT 'Calculada',
  payment_date TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_comision_total NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS porcentaje_invitacion NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_invitacion NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS id_asesor_invitador TEXT DEFAULT '';
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_remanente NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS porcentaje_asesor NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_base_asesor NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS aplica_mentoria TEXT DEFAULT 'false';
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS porcentaje_mentoria NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_mentoria NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS id_mentor TEXT DEFAULT '';
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_neto_asesor NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS monto_inmobiliaria NUMERIC DEFAULT 0;
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS aplica_ama TEXT DEFAULT 'false';
ALTER TABLE public.commissions ADD COLUMN IF NOT EXISTS estatus_comision TEXT DEFAULT 'Calculada';

-- ── 7. COMPLIANCE_CASES ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.compliance_cases (
  id                   TEXT PRIMARY KEY,
  operation_id         TEXT DEFAULT '',
  client_id            TEXT DEFAULT '',
  risk_level           TEXT DEFAULT 'bajo',
  status               TEXT DEFAULT 'pendiente_docs',
  rfc_valid            BOOLEAN DEFAULT false,
  identification_valid BOOLEAN DEFAULT false,
  pep_check            TEXT DEFAULT 'negativo',
  alert_trigger        TEXT DEFAULT '',
  observations         TEXT DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 8. AUDIT_LOGS ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  action     TEXT NOT NULL,
  details    JSONB DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  timestamp  TIMESTAMPTZ DEFAULT NOW()
);

-- ── 9. DIM_DOCUMENTOS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_documentos (
  id                   TEXT PRIMARY KEY,
  entidad_relacionada  TEXT NOT NULL,
  id_entidad           TEXT NOT NULL,
  tipo_documento       TEXT NOT NULL,
  nombre_archivo       TEXT DEFAULT '',
  extension            TEXT DEFAULT '',
  mime_type            TEXT DEFAULT '',
  storage_path         TEXT NOT NULL,
  url_archivo          TEXT DEFAULT '',
  subido_por           TEXT DEFAULT '',
  fecha_carga          TIMESTAMPTZ DEFAULT NOW(),
  estatus_documento    TEXT DEFAULT 'Pendiente',
  validado_por         TEXT DEFAULT '',
  fecha_validacion     TIMESTAMPTZ,
  observaciones        TEXT DEFAULT '',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 10. FACT_AMA_ASESOR ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_ama_asesor (
  id                   TEXT PRIMARY KEY,
  id_asesor            TEXT NOT NULL,
  fecha_inicio_periodo DATE,
  fecha_fin_periodo    DATE,
  meta_ama             NUMERIC DEFAULT 0,
  monto_acumulado      NUMERIC DEFAULT 0,
  avance_pct           NUMERIC DEFAULT 0,
  ama_alcanzada        TEXT DEFAULT 'false',
  fecha_ama_alcanzada  DATE,
  estatus_ama          TEXT DEFAULT 'En progreso',
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ── 11. CONFIG_PARAMETROS_COMISION ─────────────────────────
CREATE TABLE IF NOT EXISTS public.config_parametros_comision (
  id               TEXT PRIMARY KEY,
  nombre_parametro TEXT NOT NULL UNIQUE,
  valor_numerico   NUMERIC DEFAULT 0,
  valor_texto      TEXT DEFAULT '',
  tipo_valor       TEXT DEFAULT 'numerico',
  descripcion      TEXT DEFAULT '',
  activo           BOOLEAN DEFAULT true,
  actualizado_por  TEXT DEFAULT '',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO public.config_parametros_comision
  (id, nombre_parametro, valor_numerico, descripcion) VALUES
  ('cfg-001', 'porcentaje_invitacion',          0.025,   'Gratificación por invitación (2.5%)'),
  ('cfg-002', 'porcentaje_asesor_normal',        0.80,    'Porcentaje asesor antes de alcanzar AMA (80%)'),
  ('cfg-003', 'porcentaje_mentoria',             0.05,    'Descuento de mentoría sobre pago asesor (5%)'),
  ('cfg-004', 'minimo_exento_mentoria_renta',    5000,    'Comisión de renta exenta de mentoría (<$5,000)'),
  ('cfg-005', 'meta_ama',                        180000,  'Meta anual de comisiones AMA ($180,000)'),
  ('cfg-006', 'duracion_anio_operativo_meses',   12,      'Duración del año operativo en meses'),
  ('cfg-007', 'ventas_para_salir_mentoria',      2,       'Ventas necesarias para salir de mentoría')
ON CONFLICT (nombre_parametro) DO NOTHING;

-- ── 12. FACT_PAGOS ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_pagos (
  id                     TEXT PRIMARY KEY,
  id_comision            TEXT NOT NULL,
  id_asesor              TEXT NOT NULL,
  fecha_solicitud        TIMESTAMPTZ DEFAULT NOW(),
  monto_solicitado       NUMERIC DEFAULT 0,
  monto_pagado           NUMERIC DEFAULT 0,
  forma_pago             TEXT DEFAULT '',
  requiere_cfdi          BOOLEAN DEFAULT false,
  retenciones_aplicadas  NUMERIC DEFAULT 0,
  estatus_pago           TEXT DEFAULT 'Solicitado',
  fecha_pago             TIMESTAMPTZ,
  autorizado_por         TEXT DEFAULT '',
  observaciones          TEXT DEFAULT '',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── 13. FACT_SOLICITUDES_CONTRATO ──────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_solicitudes_contrato (
  id                     TEXT PRIMARY KEY,
  tipo_solicitud         TEXT NOT NULL,
  id_propiedad           TEXT DEFAULT '',
  id_asesor_solicitante  TEXT NOT NULL,
  precio_renta_acordada  NUMERIC DEFAULT 0,
  fecha_firma_estimada   DATE,
  fecha_entrega_estimada DATE,
  condiciones_pago       TEXT DEFAULT '',
  observaciones_asesor   TEXT DEFAULT '',
  observaciones_juridico TEXT DEFAULT '',
  confirmacion_asesor    TEXT DEFAULT 'false',
  estatus_solicitud      TEXT DEFAULT 'Pendiente',
  fecha_solicitud        TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

-- ── 14. DIM_CLIENTES ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_clientes (
  id                  TEXT PRIMARY KEY,
  tipo_cliente        TEXT DEFAULT '',
  nombre_razon_social TEXT NOT NULL,
  persona_tipo        TEXT DEFAULT 'fisica',
  telefono            TEXT DEFAULT '',
  correo              TEXT DEFAULT '',
  rfc                 TEXT DEFAULT '',
  curp                TEXT DEFAULT '',
  estado_civil        TEXT DEFAULT '',
  regimen_patrimonial TEXT DEFAULT '',
  nombre_conyuge      TEXT DEFAULT '',
  domicilio           TEXT DEFAULT '',
  ocupacion           TEXT DEFAULT '',
  es_pep              BOOLEAN DEFAULT false,
  origen_recursos     TEXT DEFAULT '',
  estatus_kyc         TEXT DEFAULT 'Pendiente',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── ÍNDICES ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_advisors_status ON public.advisors(status);
CREATE INDEX IF NOT EXISTS idx_properties_status ON public.properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_tipo ON public.properties(tipo_operacion);
CREATE INDEX IF NOT EXISTS idx_operations_advisor ON public.operations(advisor_id);
CREATE INDEX IF NOT EXISTS idx_operations_status ON public.operations(status);
CREATE INDEX IF NOT EXISTS idx_commissions_operation ON public.commissions(operation_id);
CREATE INDEX IF NOT EXISTS idx_commissions_advisor ON public.commissions(advisor_id);
CREATE INDEX IF NOT EXISTS idx_commissions_estatus ON public.commissions(estatus_comision);
CREATE INDEX IF NOT EXISTS idx_fact_pagos_asesor ON public.fact_pagos(id_asesor);
CREATE INDEX IF NOT EXISTS idx_fact_pagos_estatus ON public.fact_pagos(estatus_pago);
CREATE INDEX IF NOT EXISTS idx_dim_documentos_entidad ON public.dim_documentos(entidad_relacionada, id_entidad);
CREATE INDEX IF NOT EXISTS idx_fact_ama_asesor ON public.fact_ama_asesor(id_asesor);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_solicitudes_asesor ON public.fact_solicitudes_contrato(id_asesor_solicitante);

-- ── 15. BRIDGE_PROPIEDAD_PROPIETARIOS ──────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_propiedad_propietarios (
  id                        TEXT PRIMARY KEY,
  id_propiedad              TEXT NOT NULL,
  id_cliente                TEXT NOT NULL,
  tipo_relacion             TEXT DEFAULT 'Propietario',
  porcentaje_participacion  NUMERIC DEFAULT 100,
  es_propietario_principal  BOOLEAN DEFAULT true,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_prop_propietarios ON public.bridge_propiedad_propietarios(id_propiedad);

-- ── 16. BRIDGE_OPERACION_ASESORES ──────────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_operacion_asesores (
  id                        TEXT PRIMARY KEY,
  id_operacion              TEXT NOT NULL,
  id_asesor                 TEXT DEFAULT '',
  tipo_parte_representada   TEXT DEFAULT '',
  tipo_participante         TEXT DEFAULT '',
  nombre_externo            TEXT DEFAULT '',
  telefono_externo          TEXT DEFAULT '',
  correo_externo            TEXT DEFAULT '',
  inmobiliaria_externa      TEXT DEFAULT '',
  porcentaje_participacion  NUMERIC DEFAULT 0,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_op_asesores ON public.bridge_operacion_asesores(id_operacion);

-- ── FACT_SOLICITUDES_CONTRATO — additional columns ──────────
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS rep_vendedor_tipo TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS asesor_interno_vendedor TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS nombre_externo_vendedor TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS telefono_externo_vendedor TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS correo_externo_vendedor TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS inmobiliaria_externa_vendedor TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS rep_comprador_tipo TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS asesor_interno_comprador TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS nombre_externo_comprador TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS telefono_externo_comprador TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS correo_externo_comprador TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS inmobiliaria_externa_comprador TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS comision_pactada_pct NUMERIC DEFAULT 0;
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS comision_pactada_monto NUMERIC DEFAULT 0;
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS existe_comision_compartida TEXT DEFAULT 'false';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS detalle_comision_compartida TEXT DEFAULT '';
ALTER TABLE public.fact_solicitudes_contrato ADD COLUMN IF NOT EXISTS precio_final_acordado NUMERIC DEFAULT 0;

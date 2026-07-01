-- ============================================================
-- IDEA UNO CONTROL — Migration v2
-- Ejecutar DESPUÉS de migration.sql
-- Seguro correr múltiples veces (IF NOT EXISTS / DO $$)
-- ============================================================

-- ── Nuevas columnas en fact_solicitudes_contrato ──────────────

ALTER TABLE public.fact_solicitudes_contrato
  ADD COLUMN IF NOT EXISTS docs_vendedor_completos  TEXT DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS docs_vendedor_faltantes  TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS docs_comprador_completos TEXT DEFAULT 'no',
  ADD COLUMN IF NOT EXISTS docs_comprador_faltantes TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS requiere_aval            TEXT DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS tipo_aval                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS nombre_aval              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS telefono_aval            TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS correo_aval              TEXT DEFAULT '';

-- ── fact_captaciones ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.fact_captaciones (
  id                        TEXT PRIMARY KEY,
  id_propiedad              TEXT NOT NULL,
  id_asesor                 TEXT NOT NULL,
  tipo_captacion            TEXT NOT NULL DEFAULT 'Venta',
  fecha_captacion           DATE,
  autorizacion_promocion    TEXT DEFAULT 'false',
  tipo_autorizacion         TEXT DEFAULT '',
  contrato_comision_firmado TEXT DEFAULT 'false',
  estatus_captacion         TEXT DEFAULT 'Incompleta',
  observaciones             TEXT DEFAULT '',
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fact_captaciones_propiedad
  ON public.fact_captaciones (id_propiedad);

CREATE INDEX IF NOT EXISTS idx_fact_captaciones_asesor
  ON public.fact_captaciones (id_asesor);

-- ── dim_clientes ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dim_clientes (
  id                    TEXT PRIMARY KEY,
  tipo_cliente          TEXT DEFAULT 'Propietario',
  nombre_razon_social   TEXT NOT NULL,
  persona_tipo          TEXT DEFAULT 'Persona física',
  telefono              TEXT DEFAULT '',
  correo                TEXT DEFAULT '',
  rfc                   TEXT DEFAULT '',
  curp                  TEXT DEFAULT '',
  estado_civil          TEXT DEFAULT '',
  regimen_patrimonial   TEXT DEFAULT '',
  nombre_conyuge        TEXT DEFAULT '',
  domicilio             TEXT DEFAULT '',
  ocupacion             TEXT DEFAULT '',
  es_pep                TEXT DEFAULT 'false',
  origen_recursos       TEXT DEFAULT '',
  estatus_kyc           TEXT DEFAULT 'Pendiente',
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- ── bridge_propiedad_propietarios ────────────────────────────
CREATE TABLE IF NOT EXISTS public.bridge_propiedad_propietarios (
  id                      TEXT PRIMARY KEY,
  id_propiedad            TEXT NOT NULL,
  id_cliente              TEXT NOT NULL,
  tipo_relacion           TEXT DEFAULT 'Propietario',
  porcentaje_participacion NUMERIC DEFAULT 100,
  es_propietario_principal TEXT DEFAULT 'false',
  created_at              TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bridge_prop_prop
  ON public.bridge_propiedad_propietarios (id_propiedad);

-- ── Roles permitidos (referencia) ────────────────────────────
-- Roles del sistema: Super Admin, Director, Gerente, Asesor, Auditor, Jurídico
-- El rol Jurídico puede cambiar estatus de contratos (PATCH /contracts/:id/status)

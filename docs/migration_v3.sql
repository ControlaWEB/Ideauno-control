-- ============================================================
-- IDEA UNO CONTROL — Migration v3
-- Ejecutar DESPUÉS de migration_v2.sql
-- ============================================================

-- ── Nuevas columnas arrendamiento + comprador en fact_solicitudes_contrato ──

ALTER TABLE public.fact_solicitudes_contrato
  -- Cliente (comprador / arrendatario)
  ADD COLUMN IF NOT EXISTS cliente_tipo                  TEXT DEFAULT 'Persona física',
  ADD COLUMN IF NOT EXISTS cliente_nombre                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_telefono              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_correo                TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_estado_civil          TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_regimen_patrimonial   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cliente_nombre_conyuge        TEXT DEFAULT '',
  -- Arrendamiento Sec 1
  ADD COLUMN IF NOT EXISTS fecha_inicio_contrato         DATE,
  ADD COLUMN IF NOT EXISTS fecha_entrega_inmueble        DATE,
  ADD COLUMN IF NOT EXISTS vigencia                      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS deposito_garantia             NUMERIC,
  -- Arrendamiento Sec 2 (condiciones de pago / acuerdos)
  ADD COLUMN IF NOT EXISTS primer_pago_renta             NUMERIC,
  ADD COLUMN IF NOT EXISTS forma_pago_renta              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS dia_pago_mensual              INTEGER,
  ADD COLUMN IF NOT EXISTS incluye_mantenimiento         TEXT DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS servicios_incluidos           TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS permite_mascotas              TEXT DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS entrega_amueblado             TEXT DEFAULT 'false',
  ADD COLUMN IF NOT EXISTS observaciones_acuerdos        TEXT DEFAULT '';

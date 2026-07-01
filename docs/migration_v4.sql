-- ============================================================
-- IDEA UNO CONTROL — Migration v4
-- Ejecutar DESPUÉS de migration_v3.sql
-- Agrega campos faltantes confirmados como necesarios
-- ============================================================

-- ── advisors: datos bancarios (obligatorios para liberar pago) ──
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS clabe_interbancaria TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS banco               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS titular_cuenta      TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS url_foto            TEXT DEFAULT '';

-- ── fact_pagos: trazabilidad de transferencia y CFDI ──────────
ALTER TABLE public.fact_pagos
  ADD COLUMN IF NOT EXISTS uuid_cfdi               TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS referencia_transferencia TEXT DEFAULT '';

-- ── config_parametros_comision: vigencia histórica ────────────
-- Permite guardar versiones anteriores de parámetros sin afectar
-- cálculos históricos. Los campos vigente_desde / vigente_hasta
-- delimitan el período en que este valor era el activo.
ALTER TABLE public.config_parametros_comision
  ADD COLUMN IF NOT EXISTS vigente_desde DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS vigente_hasta DATE;

-- Agregar umbral PLD como parámetro configurable
INSERT INTO public.config_parametros_comision
  (id, nombre_parametro, valor_numerico, descripcion, vigente_desde)
VALUES
  ('cfg-008', 'umbral_pld', 941412.75,
   'Umbral LFPIORPI en MXN. Operaciones iguales o mayores son operaciones vulnerables.',
   CURRENT_DATE)
ON CONFLICT (nombre_parametro) DO NOTHING;

-- ── compliance_cases: campo faltante para monto de operación ──
ALTER TABLE public.compliance_cases
  ADD COLUMN IF NOT EXISTS contract_value NUMERIC DEFAULT 0;

-- ── advisors: datos bancarios índice ──────────────────────────
CREATE INDEX IF NOT EXISTS idx_advisors_nombre ON public.advisors(name);

-- ── dim_clientes: campos adicionales ──────────────────────────
ALTER TABLE public.dim_clientes
  ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE,
  ADD COLUMN IF NOT EXISTS nacionalidad     TEXT DEFAULT 'Mexicana';

-- ── fact_ama_asesor: porcentaje_80_alcanzado tracking ─────────
ALTER TABLE public.fact_ama_asesor
  ADD COLUMN IF NOT EXISTS fecha_80pct_alcanzado DATE;

-- ── Índices adicionales útiles ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_compliance_operation ON public.compliance_cases(operation_id);
CREATE INDEX IF NOT EXISTS idx_compliance_status    ON public.compliance_cases(status);
CREATE INDEX IF NOT EXISTS idx_operations_property  ON public.operations(property_id);
CREATE INDEX IF NOT EXISTS idx_fact_pagos_comision  ON public.fact_pagos(id_comision);

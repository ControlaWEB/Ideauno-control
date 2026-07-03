-- migration_v6.sql — Auditoría de validación 2026-07-02
-- Columnas que el formulario /contracts/new envía desde siempre pero la tabla
-- fact_solicitudes_contrato no tenía (los datos se perdían silenciosamente).

ALTER TABLE public.fact_solicitudes_contrato
  ADD COLUMN IF NOT EXISTS condiciones_especiales   TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS formas_pago              TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS monto_apartado           NUMERIC,
  ADD COLUMN IF NOT EXISTS fecha_estimada_escritura DATE;

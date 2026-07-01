-- ============================================================
-- IDEA UNO CONTROL — Migration v5
-- Ejecutar DESPUÉS de migration_v4.sql
-- Sección "Plantillas y Contratos": Admin sube, cualquier usuario descarga
-- ============================================================

CREATE TABLE IF NOT EXISTS public.dim_plantillas (
  id              TEXT PRIMARY KEY,
  nombre          TEXT NOT NULL,
  categoria       TEXT NOT NULL DEFAULT 'Otro', -- 'KYC' | 'PLD' | 'Contrato' | 'Otro'
  descripcion     TEXT DEFAULT '',
  nombre_archivo  TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  subido_por      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dim_plantillas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_plantillas_categoria ON public.dim_plantillas(categoria);

-- Trazabilidad fuerte de copropietarios en captación de venta.
-- Cada copropietario adicional queda ligado a su documento INE por FK.
-- Aplicada en Supabase (proyecto Ideauno-control) el 2026-07-04.

CREATE TABLE IF NOT EXISTS public.copropietarios (
  id text PRIMARY KEY,
  property_id text NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  nombre text NOT NULL DEFAULT '',
  orden int NOT NULL DEFAULT 1,
  documento_ine_id text REFERENCES public.dim_documentos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_copropietarios_property ON public.copropietarios(property_id);
CREATE INDEX IF NOT EXISTS idx_copropietarios_ine ON public.copropietarios(documento_ine_id);

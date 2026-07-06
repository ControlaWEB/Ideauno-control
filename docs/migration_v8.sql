-- ============================================================================
-- migration_v8.sql — Alta de Asesores en modo Team
-- ----------------------------------------------------------------------------
-- Un "Team" agrupa varios asesores individuales bajo:
--   * un login compartido (teams.user_id -> usuarios.id)
--   * una cuenta bancaria compartida (para el pago de comisiones del equipo)
-- Cada integrante sigue siendo una fila en public.advisors con su propio id
-- (ADV-XXXX). Sus documentos, operaciones y comisiones se ligan al advisor.id
-- individual — NO se duplica nada a nivel team.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.teams (
  id                  TEXT PRIMARY KEY,
  user_id             UUID,                         -- login compartido (usuarios.id)
  nombre              TEXT NOT NULL,
  status              TEXT DEFAULT 'Activo',
  meta_ama            NUMERIC DEFAULT 0,            -- meta anual agregada del equipo
  clabe_interbancaria TEXT DEFAULT '',
  banco               TEXT DEFAULT '',
  titular_cuenta      TEXT DEFAULT '',
  fecha_alta_team     DATE,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- Relación integrante -> team. ON DELETE SET NULL: borrar el team no borra
-- a los asesores, solo los "desagrupa".
ALTER TABLE public.advisors
  ADD COLUMN IF NOT EXISTS team_id TEXT REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_advisors_team ON public.advisors(team_id);

-- ══════════════════════════════════════════════════════════════════
--  Migration v7 — Notificaciones in-app por asesor
-- ══════════════════════════════════════════════════════════════════
--  Bandeja de notificaciones para asesores: comisiones liberadas/
--  bloqueadas/desbloqueadas, operaciones canceladas y estatus de pagos.
--  Se escribe desde OperationsService y PaymentsService (best-effort),
--  en paralelo al correo existente.
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id         TEXT PRIMARY KEY,
  advisor_id TEXT NOT NULL,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT DEFAULT '',
  entity_id  TEXT DEFAULT '',
  read       BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_advisor
  ON public.notifications(advisor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON public.notifications(advisor_id) WHERE read = false;

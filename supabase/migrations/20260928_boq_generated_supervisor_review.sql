-- PENDING #18 (Session 59): Estimator is a function performable by
-- Estimator, Sub-Coordinator (if labour source), or Supervisor (on first
-- visit) -- generateBOQ was confirmed callable only via admin's page.
-- These columns let Supervisor record a real confirm/revise/modify
-- decision on the live estimate without duplicating Admin's own
-- coordinator_notes field (a different, more general-purpose column,
-- confirmed by grep before adding these).
ALTER TABLE boq_generated
  ADD COLUMN IF NOT EXISTS supervisor_review_action TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_review_reason TEXT,
  ADD COLUMN IF NOT EXISTS supervisor_review_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS supervisor_reviewed_by UUID,
  ADD COLUMN IF NOT EXISTS supervisor_reviewed_at TIMESTAMPTZ;

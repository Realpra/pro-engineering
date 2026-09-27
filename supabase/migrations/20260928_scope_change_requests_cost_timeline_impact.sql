-- SA-10 spec (June log line 10503-10507): "description (minimum 50
-- characters enforced), cost and timeline impact... If cost impact above
-- ₹5,000 or timeline above 2 days: Coordinator auto-notified alongside
-- Sub-Coordinator." supervisor_rough_estimate already captures per-item
-- cost as a JSONB array, but there was no persisted total cost or timeline
-- field to check the threshold against -- added here, defensively
-- (IF NOT EXISTS) since this table has no migration file at all and this
-- session cannot verify its full live column set.
ALTER TABLE scope_change_requests
  ADD COLUMN IF NOT EXISTS cost_impact_amount NUMERIC,
  ADD COLUMN IF NOT EXISTS timeline_impact_days NUMERIC;

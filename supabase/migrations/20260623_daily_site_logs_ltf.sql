-- LTF (Likely-to-Finish) Feed columns for the evening log.
-- Captures tomorrow's inspection readiness, target time slot,
-- delay reason (if not ready), and optional crew/material notes.

ALTER TABLE daily_site_logs
  ADD COLUMN IF NOT EXISTS ltf_ready_tomorrow BOOLEAN,
  ADD COLUMN IF NOT EXISTS ltf_target_slot    TEXT,
  ADD COLUMN IF NOT EXISTS ltf_delay_reason   TEXT,
  ADD COLUMN IF NOT EXISTS ltf_notes          TEXT;

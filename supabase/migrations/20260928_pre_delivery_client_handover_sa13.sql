-- SA-13 Client Handover Sign-Off (June log line 11224-11228, final 4-screen
-- redesign): "Screen 1: overall satisfaction YES/NO. Screen 2 (if NO): 6
-- grouped options. Screen 3: digital signature. Screen 4: 6 handover
-- photographs. Dissatisfaction items routed to Sub-Coordinator attention
-- queue." Confirmed via SUPERVISOR_INFEED_ACT_OUTPUT.md and a repo-wide
-- grep that this was never built anywhere in live code. Added alongside
-- pre_delivery_assessment's existing supervisor_* columns (same booking,
-- immediately-following real-world step -- handover happens right after
-- the supervisor's own pre-delivery clearance) rather than a new table.
--
-- Written defensively with IF NOT EXISTS: this session has no live DB
-- access to confirm pre_delivery_assessment's full real column set (the
-- same table already surprised this session once with hidden live-only
-- columns on scope_snag_items), so this must not assume a clean slate.
ALTER TABLE pre_delivery_assessment
  ADD COLUMN IF NOT EXISTS client_handover_satisfied BOOLEAN,
  ADD COLUMN IF NOT EXISTS client_dissatisfaction_categories JSONB,
  ADD COLUMN IF NOT EXISTS client_signature_url TEXT,
  ADD COLUMN IF NOT EXISTS client_handover_photo_urls JSONB,
  ADD COLUMN IF NOT EXISTS client_handover_at TIMESTAMPTZ;

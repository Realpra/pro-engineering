-- Supervisor Visit schema freeze, Duplicate/Conflict #17 (PENDING #16):
-- Site Incharge is permanently on-site for a job's duration; Supervisor only
-- visits periodically per his own due schedule. The two roles' presence is
-- not coupled -- confirmed by the project owner explicitly ("what if that
-- day Site Head is sick" while Supervisor's due substage still needs
-- handling) -- yet both shared the single guest_enquiries.supervisor_id FK.
-- Add a separate column so each role's relationship to a job is
-- independently representable.
ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS site_incharge_id UUID REFERENCES workers(id);

CREATE INDEX IF NOT EXISTS idx_guest_enquiries_site_incharge_id
  ON guest_enquiries (site_incharge_id);

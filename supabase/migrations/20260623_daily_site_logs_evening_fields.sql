-- Add columns required for the full evening log spec:
-- deviation description + reason dropdown, issue reporting, end-of-day photo.

ALTER TABLE daily_site_logs
  ADD COLUMN IF NOT EXISTS deviation_description TEXT,
  ADD COLUMN IF NOT EXISTS deviation_reason      TEXT,
  ADD COLUMN IF NOT EXISTS issue_reported        BOOLEAN,
  ADD COLUMN IF NOT EXISTS issue_description     TEXT,
  ADD COLUMN IF NOT EXISTS evening_photo_url     TEXT;

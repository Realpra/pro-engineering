-- Add log_type column (default 'morning' so existing rows are valid)
-- and replace the unique constraint to include it.

ALTER TABLE daily_site_logs
  ADD COLUMN IF NOT EXISTS log_type TEXT NOT NULL DEFAULT 'morning';

ALTER TABLE daily_site_logs
  DROP CONSTRAINT IF EXISTS uq_supervisor_log_date;

ALTER TABLE daily_site_logs
  ADD CONSTRAINT uq_supervisor_log_date_type
  UNIQUE (supervisor_id, log_date, log_type);

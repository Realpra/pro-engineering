-- Supervisor Visit schema freeze, Bug #12:
-- Admin's ReportTabs.tsx displayed a "Weather" field that had no backing
-- column anywhere in daily_site_logs (confirmed via all 4 existing
-- migrations) -- always undefined. Rather than silently drop the UI, add the
-- real column and a capture field in MorningForm.tsx (see accompanying code
-- change) so the concept it always implied actually exists.
ALTER TABLE daily_site_logs
  ADD COLUMN IF NOT EXISTS weather_condition TEXT;

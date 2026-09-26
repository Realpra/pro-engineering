-- Worker Onboarding freeze (Session 65, docs/SCHEMA_FREEZE_METHODOLOGY.md, process 1 of many):
-- gender/dob/whatsapp_same/whatsapp_phone were captured on Screen 1 of the onboarding form
-- but had no column to write to, so they were silently discarded. login_email stores the
-- systematic dev-stage login email generated for each worker's auth account (see
-- createWorkerAuthAccount in app/onboarding/[trade]/actions.ts), separate from workers.email
-- (the worker's own real contact email).

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS gender          TEXT,
  ADD COLUMN IF NOT EXISTS dob             DATE,
  ADD COLUMN IF NOT EXISTS whatsapp_same   BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS whatsapp_phone  TEXT,
  ADD COLUMN IF NOT EXISTS login_email     TEXT;

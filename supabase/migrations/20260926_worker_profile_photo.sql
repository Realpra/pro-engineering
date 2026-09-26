-- Selfie was one of the original 7 Tier-1 MVP fields ("mason enters name,
-- Aadhaar, mobile, bank account, zone, trade, selfie") -- the worker-selfies
-- storage bucket has existed since the original 20260621_workers_onboarding.sql
-- migration but was never actually wired: no column ever stored a reference
-- to the uploaded photo, and no upload UI ever called it. Adding the column
-- now; the onboarding UI wires the actual upload to the existing bucket.
-- declaration_confirmation_method was proposed and declined -- project owner
-- confirmed a plain tick + submit is enough, with declaration_confirmed_at
-- (already added) as the timestamp. Not added.

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS profile_photo_url TEXT;

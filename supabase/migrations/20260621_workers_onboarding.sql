-- Worker onboarding form: add bank details, labour_type, update employment constraint,
-- allow anon/authenticated inserts for the public registration form, and create the
-- worker-selfies storage bucket with appropriate access policies.

ALTER TABLE workers
  ADD COLUMN IF NOT EXISTS bank_account_number TEXT,
  ADD COLUMN IF NOT EXISTS ifsc_code            TEXT,
  ADD COLUMN IF NOT EXISTS labour_type          TEXT;

-- Drop existing constraint and recreate with 'self' (self-employed) included.
ALTER TABLE workers
  DROP CONSTRAINT IF EXISTS workers_employment_classification_check;

ALTER TABLE workers
  ADD CONSTRAINT workers_employment_classification_check
    CHECK (employment_classification IN (
      'permanent', 'contractual', 'daily_wage', 'piece_rate', 'subcontractor', 'self'
    ));

-- Allow anonymous inserts so the public onboarding form works before phone OTP auth.
CREATE POLICY "workers_insert_anon"
  ON workers FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow authenticated inserts for workers who have completed phone OTP verification.
CREATE POLICY "workers_insert_authenticated"
  ON workers FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Storage bucket for worker selfie photographs.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'worker-selfies',
  'worker-selfies',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Allow anonymous upload (photo uploaded before server action runs).
CREATE POLICY "worker_selfies_anon_upload"
  ON storage.objects FOR INSERT
  TO anon
  WITH CHECK (bucket_id = 'worker-selfies');

-- Allow authenticated upload (after phone OTP the user has a session).
CREATE POLICY "worker_selfies_authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'worker-selfies');

-- Authenticated staff can view selfies in the admin dashboard.
CREATE POLICY "worker_selfies_staff_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'worker-selfies');

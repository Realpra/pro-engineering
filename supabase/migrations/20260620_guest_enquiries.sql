-- Guest Enquiries: unauthenticated booking submissions from the public booking flow.
-- Deliberately has no FK to users — anonymous visitors can submit without an account.
-- Once staff qualifies the lead, a proper jobs row is created and linked.

CREATE TABLE IF NOT EXISTS guest_enquiries (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_ref         TEXT          NOT NULL UNIQUE,

  job_title           TEXT,
  job_type            TEXT,
  zone                TEXT,
  district            TEXT,

  budget_min          NUMERIC(12,2),
  budget_max          NUMERIC(12,2),
  preferred_start_date TEXT,
  duration_weeks      INTEGER,
  service_model       TEXT,

  estimate_total      NUMERIC(14,2),
  token_amount        NUMERIC(14,2),

  payment_method      TEXT,
  payment_status      TEXT          NOT NULL DEFAULT 'pending',

  status              TEXT          NOT NULL DEFAULT 'enquiry',

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- Allow unauthenticated inserts (anon role used by the browser Supabase client)
ALTER TABLE guest_enquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "guest_enquiries_insert"
  ON guest_enquiries FOR INSERT
  TO anon
  WITH CHECK (true);

-- Staff can read all enquiries
CREATE POLICY "guest_enquiries_select_staff"
  ON guest_enquiries FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS payment_confirmations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_ref TEXT NOT NULL,
  milestone_code TEXT NOT NULL DEFAULT 'M0',
  utr_number TEXT NOT NULL,
  screenshot_base64 TEXT,
  amount NUMERIC,
  status TEXT DEFAULT 'pending_verification' CHECK (status IN ('pending_verification','verification_pending','verified','rejected')),
  coordinator_verified_at TIMESTAMPTZ,
  coordinator_verified_by UUID,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_payment_confirmations" ON payment_confirmations
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "write_payment_confirmations" ON payment_confirmations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

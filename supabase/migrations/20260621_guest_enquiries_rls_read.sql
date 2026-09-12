-- Ensure authenticated users can read guest_enquiries (admin dashboard access).
-- Uses a guard so the migration is safe to re-run if already applied.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'guest_enquiries'
      AND policyname = 'guest_enquiries_select_staff'
  ) THEN
    CREATE POLICY "guest_enquiries_select_staff"
      ON guest_enquiries FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END
$$;

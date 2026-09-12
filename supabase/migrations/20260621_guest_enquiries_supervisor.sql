-- Add supervisor_id to guest_enquiries for supervisor assignment feature.
-- Also adds an UPDATE policy so authenticated coordinators can assign supervisors.

ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES workers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_guest_enquiries_supervisor ON guest_enquiries (supervisor_id);

-- Coordinators are authenticated users; allow them to update enquiries
CREATE POLICY "guest_enquiries_update_staff"
  ON guest_enquiries FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

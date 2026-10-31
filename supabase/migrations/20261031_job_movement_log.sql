-- Job movement log (owner, 31 Oct 2026).
--
-- One row for every movement of a job between roles, with the action taken, so that
-- Admin can see each job's full movement history in time order, and so that "returned
-- more than once" can be counted. Before this, each screen overwrote its own status
-- column and no history was kept anywhere (report_submissions keeps a trail for
-- site-visit reports only; it is left as it is).
--
-- Counting rules (owner, 31 Oct 2026), stored on each row so any query can use them:
--   * counts_as_return = true for a send-back for correction (survey, estimate,
--     milestone/sub-stage). The first send-back of an item is normal; a second one
--     makes the job a "pending job".
--   * Decisions (premium approved/rejected, confirmed for execution, scope change
--     decided) are logged but never counted.
--   * Client acts are logged but never counted. A client rejection or request for
--     review re-runs the process, so it sets resets_return_count = true: send-backs
--     before it no longer count.
--
-- Classification: Addition. No existing table or column changes.

CREATE TABLE IF NOT EXISTS job_movement_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  enquiry_id          UUID        NOT NULL REFERENCES guest_enquiries(id) ON DELETE CASCADE,
  booking_ref         TEXT        NOT NULL,
  stage               TEXT        NOT NULL CHECK (stage IN (
                        'request', 'routing', 'survey', 'estimate', 'premium',
                        'client', 'execution', 'milestone', 'scope_change')),
  action              TEXT        NOT NULL CHECK (action IN (
                        'created', 'forwarded', 'approved', 'returned', 'rejected', 'decided',
                        'client_accepted', 'client_rejected', 'client_review')),
  counts_as_return    BOOLEAN     NOT NULL DEFAULT false,
  resets_return_count BOOLEAN     NOT NULL DEFAULT false,
  item_type           TEXT,       -- e.g. 'site_visit_report', 'boq_generated', 'job_milestone_substage'
  item_id             TEXT,       -- id of that row; send-backs are counted per item
  from_user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  from_role           TEXT,
  to_role             TEXT,
  to_user_id          UUID        REFERENCES users(id) ON DELETE SET NULL,
  remarks             TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS job_movement_log_enquiry_time_idx ON job_movement_log (enquiry_id, created_at);
CREATE INDEX IF NOT EXISTS job_movement_log_booking_ref_idx  ON job_movement_log (booking_ref);

ALTER TABLE job_movement_log ENABLE ROW LEVEL SECURITY;

-- Staff and clients write through server actions; who may act is checked there,
-- the same pattern as the other operational tables. Public (not signed-in) job
-- requests are logged with the service-role client, which bypasses RLS.
DROP POLICY IF EXISTS authenticated_all_job_movement_log ON job_movement_log;
CREATE POLICY authenticated_all_job_movement_log ON job_movement_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

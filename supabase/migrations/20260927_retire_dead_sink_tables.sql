-- Supervisor Visit schema freeze, Duplicate/Conflict #11 and #12:
-- worker_day_slots and scope_snag_items are both confirmed pure write sinks
-- -- inserted/deleted by Supervisor's code on every crew assignment / flagged
-- pre-delivery inspection, but NEVER read anywhere else in the repo (grep-
-- confirmed by 3 independent research passes). The real, actually-consumed
-- sources for the same facts already exist:
--   worker_day_slots      -> job_milestone_substages.labour_assignments
--   scope_snag_items      -> pre_delivery_assessment.supervisor_snag_items
-- The app-side writes into these two tables were removed in the accompanying
-- code change; this drops the now-fully-orphaned tables themselves.
DROP TABLE IF EXISTS worker_day_slots;
DROP TABLE IF EXISTS scope_snag_items;

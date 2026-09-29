-- Project owner's real-world rule (29 Sep 2026): a supervisor can propose NOT
-- to do a scheduled day's visit/work (request a change). That proposal
-- defaults to moving the slot to a "pending" state UNLESS a higher role
-- (superadmin/admin/coordinator/sub-coordinator) overrides it and keeps the
-- slot assigned as originally planned. Anything left pending (not overridden)
-- becomes available for ANY supervisor to pick up into one of their own
-- empty slots.
--
-- supervisor_daily_routes has never had a migration file at all (confirmed
-- repeatedly this session -- fully live-only schema, PENDING #20). Rather
-- than guess at reusing an existing free-text column (e.g. ltf_note, which
-- already means something different) for this new concept, this adds new,
-- purely additive columns -- same safe pattern as every other migration this
-- session. Nothing existing is touched, renamed, or constrained.
--
-- visit_status itself already has NO CHECK constraint (confirmed by grep of
-- every migration, see app/supervisor/dashboard/actions.ts's
-- markSiteHeadNotReady comment) -- the new 'supervisor_declined' value it
-- takes on needs no schema change at all.
ALTER TABLE supervisor_daily_routes
  ADD COLUMN IF NOT EXISTS decline_reason TEXT,
  ADD COLUMN IF NOT EXISTS declined_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS declined_by UUID,
  ADD COLUMN IF NOT EXISTS override_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS override_confirmed_by UUID;

-- Project owner's correction (30 Sep 2026): Coordinator's decision on a
-- declined slot needs a real yes/no, not "click Override, or do nothing and
-- silence means no." A slot already correctly goes to the pending pool the
-- moment it's declined and not yet overridden (matches the original rule:
-- "it goes to pending if proposal not to do is not overridden") -- that
-- timing is unchanged. What was missing is an explicit "No, I've reviewed
-- this and confirm it stays pending" action, so a real decision gets
-- recorded instead of the row just silently sitting there indefinitely with
-- no way to tell "nobody's looked yet" from "looked, agreed to pending."
ALTER TABLE supervisor_daily_routes
  ADD COLUMN IF NOT EXISTS pending_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS pending_confirmed_by UUID;

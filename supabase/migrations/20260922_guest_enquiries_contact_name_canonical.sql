-- Resolves a live duplicate the field-naming audit's regex heuristic could not
-- see: guest_enquiries had both contact_name and full_name, used inconsistently
-- across roles (some read contact_name, some read full_name, two admin pages
-- defensively fell back "contact_name ?? full_name ?? '-'" because someone had
-- already hit clients showing up blank).
--
-- Root cause found by tracing every write path: NEITHER column was ever written.
-- The public booking insert (app/book/payment/page.tsx) never set a name field at
-- all, and there is no name input anywhere in the booking flow. Fixed in this same
-- change: the booking form now collects a name and writes it to contact_name
-- (chosen as canonical since it's what the majority of role pages already read),
-- and every reader across admin/coordinator/supervisor/client now standardizes on
-- contact_name.
--
-- BEFORE RUNNING: confirm full_name is genuinely empty and safe to drop.
--   SELECT full_name, COUNT(*) FROM guest_enquiries GROUP BY full_name ORDER BY 2 DESC LIMIT 20;
-- If that returns any non-null values, stop and paste them back -- do not run the
-- DROP below until that's resolved.

ALTER TABLE guest_enquiries DROP COLUMN IF EXISTS full_name;

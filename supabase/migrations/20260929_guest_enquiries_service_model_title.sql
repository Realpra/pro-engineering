-- Client field inventory finding (Screen 4, Service Model): /book/service-model
-- already captures a human-readable title (serviceModelTitle) alongside the raw
-- service_model id at selection time, but it was silently dropped before the
-- guest_enquiries insert -- the exact "silently dropped" case CLAUDE.md's
-- standing principle warns against. ClientDashboard.tsx's serviceModelLabel()
-- tried to re-derive a label from the raw id by checking for values
-- ('l'/'m'/'lm'/'r1') that no real service_model id (design-build/labour-only/
-- full-epc/etc, ~27 values across 9 job types) ever matches, so it always fell
-- through to the raw id string. Fix at the source: persist the title that was
-- already being captured, instead of re-deriving/duplicating a label map.
ALTER TABLE guest_enquiries
  ADD COLUMN IF NOT EXISTS service_model_title TEXT;

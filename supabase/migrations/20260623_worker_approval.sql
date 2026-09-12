ALTER TABLE workers ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'pending';
ALTER TABLE workers ADD COLUMN IF NOT EXISTS approved_by UUID;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS correction_action TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS platform_role TEXT DEFAULT 'coordinator';
UPDATE workers SET approval_status = 'coordinator_approved' WHERE is_active = true;

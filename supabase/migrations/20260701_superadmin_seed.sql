-- ── Super Admin User Seed ─────────────────────────────────────────────────────
-- Creates auth user + public.users row for superadmin@proengineering.in
-- Password: SuperAdmin@2026
-- Run AFTER 20260701_policy_framework.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  v_id UUID := 'a0000000-0000-0000-0000-000000000001'::UUID;
BEGIN
  -- Auth user (Supabase GoTrue v2 schema)
  INSERT INTO auth.users (
    id, instance_id, aud, role,
    email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data,
    is_super_admin, confirmation_token, email_change,
    email_change_token_new, recovery_token,
    created_at, updated_at
  ) VALUES (
    v_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'superadmin@proengineering.in',
    crypt('SuperAdmin@2026', gen_salt('bf', 10)),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Super Admin"}',
    false, '', '', '', '',
    NOW(), NOW()
  ) ON CONFLICT (id) DO NOTHING;

  -- Public users row. Verified live via PostgREST column probing on 2026-07-02:
  -- public.users has id, email, full_name, platform_role — NOT auth_user_id
  -- (curl to /rest/v1/users?select=auth_user_id returned 42703 "column does
  -- not exist"). public.users.id IS the auth.users.id directly — every other
  -- lookup in this codebase (admin/dashboard, superadmin/dashboard) resolves
  -- the profile with .eq('id', user.id), not a separate join column.
  INSERT INTO public.users (id, email, full_name, platform_role)
  VALUES (v_id, 'superadmin@proengineering.in', 'Super Admin', 'super_admin')
  ON CONFLICT (id) DO NOTHING;
END $$;

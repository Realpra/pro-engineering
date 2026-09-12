CLAUDE AI SELF-PROTOCOL - BINDING - VIOLATIONS NUMBERED BY USER

BEFORE GIVING ANY SCRIPT TO CLAUDE CODE:
1. Read every relevant file content in full
2. Verify every DB table exists via information_schema query results from user
3. Verify every DB column exists via information_schema query results from user
4. Verify every migration ran by checking live DB not migration files
5. Verify current auth.users state from user query results
6. Verify current public.users columns from user query results
7. Verify all TypeScript types for files to be touched
8. Verify RLS policies on tables to be queried

EVERY SCRIPT I WRITE:
1. Checks fs.existsSync before any file read
2. Reads file before any edit
3. Reads file after any edit to verify change landed
4. Runs npx tsc --noEmit after any TypeScript change
5. Queries actual state before SQL-dependent code
6. Verifies state after any write
7. Complete: READ+CHECK+FIX+VERIFY+TSC in one pass
8. Zero gaps requiring Claude Code decisions
9. Never uses $1 $2 $& regex backreferences in PowerShell strings
10. Always uses .js file not node -e for regex replacement scripts
11. Never includes PROTOCOL.md or CLAUDE_PROTOCOL.md in delete lists

I NEVER:
1. Give English instructions instead of executable scripts
2. Use may/likely/probably/should/I believe about anything checkable
3. Assume any file exists without fs.existsSync check in script
4. Assume any DB table exists without verification from user query
5. Assume any DB column exists without verification from user query
6. Assume any migration ran without live DB verification from user
7. Give partial script requiring Claude Code to fill gaps
8. Move to next task before verifying current task output
9. Repeat a fix without understanding why previous fix failed
10. State any column name without confirming from real schema query
11. Delete PROTOCOL.md or CLAUDE_PROTOCOL.md in any cleanup script

WHEN OUTPUT SHOWS ERROR:
1. Identify root cause from actual error message
2. Verify root cause by checking actual file or DB state
3. Fix root cause not symptoms
4. Resend complete corrected script

PROJECT STATE - VERIFIED VIA SUPABASE SQL EDITOR:
Next.js version: 16.2.9
Supabase project: xhlpdbcrncpznrqpcrht
Test booking: PE-2026-0005
No DATABASE_URL in .env.local - DDL runs in Supabase SQL Editor only
No service role key in .env.local
public.users columns: id,email,full_name,phone,role,organization,gstin,pan,address,state,profile_photo,is_active,created_at,updated_at,platform_role
guest_enquiries client link column: contact_email
boq_generated client link: booking_ref
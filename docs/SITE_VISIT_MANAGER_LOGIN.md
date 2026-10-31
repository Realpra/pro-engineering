# Creating a Site Visit Manager login (owner, 31 Oct 2026, D28)

A Site Visit Manager substitutes for a Supervisor on a visit and always submits up to the job's
Supervisor. They log in like a Supervisor and see the same visit screens. Each one needs:

1. A login: Supabase Dashboard -> Authentication -> Users -> Add user (email + password).
   Copy the new user's UUID.
2. Then run in the SQL Editor, filling the four `<...>` values with the real person's details:

```sql
-- 1. the platform role
INSERT INTO users (id, email, full_name, platform_role)
VALUES ('<uuid from step 1>', '<email>', '<full name>', 'site_visit_manager');

-- 2. a workers row so visit slots can be assigned to them (trade must be exactly 'Site Visit Manager')
INSERT INTO workers (auth_user_id, full_name, phone, state, trade, is_active, approval_status)
VALUES ('<uuid from step 1>', '<full name>', '<10-digit phone>', 'Uttar Pradesh',
        'Site Visit Manager', true, 'admin_approved');
```

After this they appear in the Coordinator's "Give it to someone else" and scheduling lists.

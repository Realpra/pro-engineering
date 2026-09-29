// Run this LOCALLY (not from the cloud sandbox -- it has no Supabase network
// access) with real credentials in .env.local:
//   node scripts/reset-client-passwords.mjs
//
// Confirms/resets the password for every existing client dev/beta account the
// project owner listed (29 Sep 2026) to the same universal dev password now
// used by app/book/actions.ts's createClientDevAuthAccount (Client2026) --
// same convention as workers' Worker2026 (WORKER DEV/BETA LOGIN CONVENTION,
// Session 65). Does NOT touch any account in `keep` (real working staff
// logins), same discipline as the existing scripts/fix-auth.mjs this repo
// already has for exactly this purpose.
//
// If an account already exists, its password is reset and email_confirm is
// forced true (so it can actually sign in) -- its id, and therefore any
// guest_enquiries.client_user_id already pointing at it, is left untouched.
// If an account does not exist yet, it's created fresh with this password.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
const supabase = createClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey)

const PASSWORD = 'Client2026'

const accounts = [
  { email: 'client.pe2026005@proengineering.in', full_name: 'Client Pe2026005' },
  { email: 'client1@proengineering.in', full_name: 'Mrs Sharma' },
  { email: 'client2@proengineering.in', full_name: 'Mr Gupta' },
  { email: 'client3@proengineering.in', full_name: 'Mrs Verma' },
  { email: 'client4@proengineering.in', full_name: 'Mr Agarwal' },
  { email: 'client5@proengineering.in', full_name: 'Mrs Joshi' },
  { email: 'client6@proengineering.in', full_name: 'Mr Saxena' },
  { email: 'client62@proengineering.in', full_name: 'Client_62' },
  { email: 'client63@proengineering.in', full_name: 'Client_63' },
  { email: 'client64@proengineering.in', full_name: 'Client_64' },
  { email: 'client7@proengineering.in', full_name: 'ABC Enterprises' },
]

async function run() {
  const { data: existing, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listErr) { console.log('listUsers FAILED:', JSON.stringify(listErr)); return }
  const existingUsers = existing?.users || []

  for (const account of accounts) {
    const found = existingUsers.find(u => u.email === account.email)

    if (found) {
      const { error } = await supabase.auth.admin.updateUserById(found.id, {
        password: PASSWORD,
        email_confirm: true,
      })
      if (error) { console.log('RESET FAILED:', account.email, JSON.stringify(error)); continue }
      console.log('Password reset:', account.email, found.id)

      const { error: upsertErr } = await supabase.from('users').upsert({
        id: found.id, email: account.email, full_name: account.full_name, platform_role: 'client',
      }, { onConflict: 'id' })
      if (upsertErr) console.log('users upsert failed:', account.email, JSON.stringify(upsertErr))
      continue
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: account.full_name },
    })
    if (error) { console.log('CREATE FAILED:', account.email, JSON.stringify(error)); continue }
    console.log('Created:', account.email, data.user.id)

    const { error: upsertErr } = await supabase.from('users').upsert({
      id: data.user.id, email: account.email, full_name: account.full_name, platform_role: 'client',
    }, { onConflict: 'id' })
    if (upsertErr) console.log('users upsert failed:', account.email, JSON.stringify(upsertErr))
  }

  console.log('Done -- every account above should now sign in with password:', PASSWORD)
}

run().catch(console.error)

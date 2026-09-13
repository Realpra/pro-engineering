import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const serviceKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.+)/)?.[1]?.trim()
const supabase = createClient('https://xhlpdbcrncpznrqpcrht.supabase.co', serviceKey)

const keep = [
  'coordinator@proengineering.in',
  'admin@proengineering.in',
  'supervisor62@proengineering.in',
  'siteincharge62@proengineering.in',
  'subcoordinator@proengineering.in'
]

const accounts = [
  { email: 'sussin5969@gmail.com', password: 'Coord2026', full_name: 'Sus Sin', role: 'supervisor' },
  { email: 'worker1@proengineering.in', password: 'Coord2026', full_name: 'Sach Kumar', role: 'worker' },
  { email: 'worker2@proengineering.in', password: 'Coord2026', full_name: 'Sachin Kumar', role: 'worker' },
  { email: 'worker3@proengineering.in', password: 'Coord2026', full_name: 'Har Govind', role: 'worker' },
  { email: 'superadmin@proengineering.in', password: 'Coord2026', full_name: 'Super Admin', role: 'super_admin' },
  { email: 'client1@proengineering.in', password: 'Client2026', full_name: 'Mrs Sharma', role: 'client' },
  { email: 'client2@proengineering.in', password: 'Client2026', full_name: 'Mr Gupta', role: 'client' },
  { email: 'client3@proengineering.in', password: 'Client2026', full_name: 'Mrs Verma', role: 'client' },
  { email: 'client4@proengineering.in', password: 'Client2026', full_name: 'Mr Agarwal', role: 'client' },
  { email: 'client5@proengineering.in', password: 'Client2026', full_name: 'Mrs Joshi', role: 'client' },
  { email: 'client6@proengineering.in', password: 'Client2026', full_name: 'Mr Saxena', role: 'client' },
  { email: 'client7@proengineering.in', password: 'Client2026', full_name: 'ABC Enterprises', role: 'client' },
]

async function run() {
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const existingUsers = existing?.users || []

  for (const account of accounts) {
    if (keep.includes(account.email)) {
      console.log('SKIP:', account.email)
      continue
    }

    const found = existingUsers.find(u => u.email === account.email)
    const oldId = found?.id || null

    if (found) {
      const { error: delErr } = await supabase.auth.admin.deleteUser(found.id)
      if (delErr) { console.log('DELETE FAILED:', account.email, JSON.stringify(delErr)); continue }
      console.log('Deleted:', account.email, oldId)
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: { full_name: account.full_name, email_verified: true }
    })

    if (error) { console.log('CREATE FAILED:', account.email, JSON.stringify(error)); continue }

    const newId = data.user.id
    console.log('Created:', account.email, newId)

    const { error: upsertErr } = await supabase.from('users').upsert({
      id: newId,
      email: account.email,
      full_name: account.full_name,
      platform_role: account.role
    }, { onConflict: 'id' })
    if (upsertErr) console.log('users upsert failed:', account.email, JSON.stringify(upsertErr))

    if (oldId) {
      await supabase.from('users').delete().eq('id', oldId)

      if (account.role === 'worker' || account.role === 'supervisor') {
        await supabase.from('workers')
          .update({ auth_user_id: newId, user_id: newId })
          .eq('auth_user_id', oldId)
      }

      if (account.role === 'client') {
        await supabase.from('guest_enquiries')
          .update({ client_user_id: newId })
          .eq('client_user_id', oldId)
      }
    }
  }

  console.log('Done')
}

run().catch(console.error)

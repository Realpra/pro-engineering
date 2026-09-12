'use server'

import { randomUUID } from 'crypto'
import { createClient } from '@/lib/supabase/server'

type ActionResult = {
  success?: true
  error?: string
  message?: string
  token?: string
  bookingRef?: string
}

export async function sendMagicLink(contact: string): Promise<ActionResult> {
  const supabase = await createClient()

  const [byEmail, byPhone] = await Promise.all([
    supabase
      .from('guest_enquiries')
      .select('id, status')
      .eq('contact_email', contact)
      .neq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('guest_enquiries')
      .select('id, status')
      .eq('client_phone', contact)
      .neq('status', 'new')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const row = byEmail.data ?? byPhone.data

  if (!row) {
    return { error: 'No booking found for this contact. Please check your details.' }
  }

  const token = randomUUID()
  const expiresAt = new Date(Date.now() + 86400000).toISOString()

  const { error: updateErr } = await supabase
    .from('guest_enquiries')
    .update({ client_access_token: token, client_access_token_expires_at: expiresAt })
    .eq('id', row.id)

  if (updateErr) return { error: updateErr.message }

  return { success: true, message: 'Link sent', token }
}

export async function sendOtp(phone: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('guest_enquiries')
    .select('id')
    .eq('client_phone', phone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return { error: 'No booking found for this mobile number.' }
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  const expiresAt = new Date(Date.now() + 600000).toISOString()

  const { error: updateErr } = await supabase
    .from('guest_enquiries')
    .update({ client_otp: otp, client_otp_expires_at: expiresAt })
    .eq('id', row.id)

  if (updateErr) return { error: updateErr.message }

  return { success: true }
}

export async function verifyOtp(phone: string, otp: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('guest_enquiries')
    .select('id, booking_ref, client_otp_expires_at')
    .eq('client_phone', phone)
    .eq('client_otp', otp)
    .maybeSingle()

  if (!row) {
    return { error: 'Invalid OTP. Please try again.' }
  }

  if (!row.client_otp_expires_at || new Date(row.client_otp_expires_at).getTime() <= Date.now()) {
    return { error: 'OTP has expired. Please request a new one.' }
  }

  const { error: updateErr } = await supabase
    .from('guest_enquiries')
    .update({ client_last_login_at: new Date().toISOString(), client_otp: null })
    .eq('id', row.id)

  if (updateErr) return { error: updateErr.message }

  return { success: true, bookingRef: row.booking_ref }
}

export async function verifyMagicToken(token: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('guest_enquiries')
    .select('id, booking_ref, client_access_token_expires_at')
    .eq('client_access_token', token)
    .maybeSingle()

  if (!row) {
    return { error: 'Invalid link. Please request a new link.' }
  }

  if (!row.client_access_token_expires_at || new Date(row.client_access_token_expires_at).getTime() <= Date.now()) {
    return { error: 'Link has expired. Please request a new link.' }
  }

  const { error: updateErr } = await supabase
    .from('guest_enquiries')
    .update({ client_last_login_at: new Date().toISOString(), client_access_token: null })
    .eq('id', row.id)

  if (updateErr) return { error: updateErr.message }

  return { success: true, bookingRef: row.booking_ref }
}

export async function getBookingRefForUser(userId: string): Promise<ActionResult> {
  const supabase = await createClient()

  const { data: row } = await supabase
    .from('guest_enquiries')
    .select('booking_ref')
    .eq('client_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!row) {
    return { error: 'No booking found for this account.' }
  }

  return { success: true, bookingRef: row.booking_ref }
}

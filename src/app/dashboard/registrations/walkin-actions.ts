'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { sendVerifiedEmail } from '@/lib/email'
import { resolveRegistrationPricing } from '@/lib/pricing'
import { revalidatePath } from 'next/cache'
import type { PaymentStatus } from '@/lib/types/database'

export async function createWalkinRegistration(data: {
  event_id: string
  full_name: string
  email: string
  phone: string | null
  gms_church: string
  nij: string | null
  package_id: string | null
  payment_status: PaymentStatus
}): Promise<{ error?: string }> {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    return { error: 'Unauthorised' }
  }

  if (!data.full_name.trim()) return { error: 'Full name is required' }
  if (!data.email.trim())     return { error: 'Email is required' }
  if (!data.gms_church)       return { error: 'Church branch is required' }

  const supabase = createServiceClient()

  // Duplicate check
  const { data: existing } = await supabase
    .from('registrations')
    .select('id')
    .eq('event_id', data.event_id)
    .eq('email', data.email.trim().toLowerCase())
    .maybeSingle()

  if (existing) return { error: 'This email is already registered for this event.' }

  const { data: eventRow } = await supabase
    .from('events')
    .select('early_bird_enabled, early_bird_auto_change, early_bird_end_date')
    .eq('id', data.event_id)
    .single()

  let amount_paid: number | null = null
  let is_early_bird = false

  if (data.package_id && eventRow) {
    const { data: pkg } = await supabase
      .from('packages')
      .select('price, early_bird_price')
      .eq('id', data.package_id)
      .eq('event_id', data.event_id)
      .single()
    if (pkg) {
      const pricing = resolveRegistrationPricing(pkg, eventRow)
      amount_paid = pricing.amount_paid
      is_early_bird = pricing.is_early_bird
    }
  }

  const { data: reg, error } = await supabase
    .from('registrations')
    .insert({
      event_id:       data.event_id,
      full_name:      data.full_name.trim(),
      email:          data.email.trim().toLowerCase(),
      phone:          data.phone?.trim() || null,
      gms_church:     data.gms_church,
      nij:            data.nij?.trim() || null,
      package_id:     data.package_id || null,
      payment_status: data.payment_status,
      custom_answers: {},
      amount_paid,
      is_early_bird,
    })
    .select(
      `id, qr_token, full_name, email, gms_church, nij, amount_paid, is_early_bird,
       packages(name, price, toolkit_items),
       events(name, date, location, currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date)`
    )
    .single()

  if (error || !reg) {
    if (error?.code === '23505') return { error: 'Email already registered.' }
    return { error: 'Registration failed. Please try again.' }
  }

  // Send QR email if immediately verified
  if (data.payment_status === 'verified') {
    try {
      const pkg = reg.packages as unknown as { name: string; price: number; toolkit_items: string[] } | null
      const evt = reg.events as unknown as {
        name: string
        date: string
        location: string
        currency: string
        early_bird_enabled: boolean
        early_bird_auto_change: boolean
        early_bird_end_date: string | null
      }
      if (pkg && evt) {
        await sendVerifiedEmail(
          { full_name: reg.full_name, email: reg.email, gms_church: reg.gms_church, nij: reg.nij, qr_token: reg.qr_token },
          pkg,
          evt,
          reg.amount_paid != null
            ? { amount_paid: Number(reg.amount_paid), is_early_bird: reg.is_early_bird }
            : undefined
        )
      }
    } catch (e) {
      console.error('[walkin email error]', e)
    }
  }

  revalidatePath('/dashboard/registrations')
  return {}
}

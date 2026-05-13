'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { sendVerifiedEmail } from '@/lib/email'
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
    })
    .select('id, qr_token, full_name, email, gms_church, nij, packages(name,price,toolkit_items), events(name,date,location)')
    .single()

  if (error || !reg) {
    if (error?.code === '23505') return { error: 'Email already registered.' }
    return { error: 'Registration failed. Please try again.' }
  }

  // Send QR email if immediately verified
  if (data.payment_status === 'verified') {
    try {
      const pkg = reg.packages as unknown as { name: string; price: number; toolkit_items: string[] } | null
      const evt = reg.events as unknown as { name: string; date: string; location: string }
      if (pkg && evt) {
        await sendVerifiedEmail(
          { full_name: reg.full_name, email: reg.email, gms_church: reg.gms_church, nij: reg.nij, qr_token: reg.qr_token },
          pkg,
          evt
        )
      }
    } catch (e) {
      console.error('[walkin email error]', e)
    }
  }

  revalidatePath('/dashboard/registrations')
  return {}
}

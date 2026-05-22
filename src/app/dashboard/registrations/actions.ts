'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { sendVerifiedEmail, sendRejectionEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { STORAGE_BUCKET } from '@/lib/constants'
import type { PaymentStatus } from '@/lib/types/database'

// ── CSV export ────────────────────────────────────────────────
export async function exportRegistrations(filters: {
  eventId?: string | null
  search?: string
  status?: string
  church?: string
  package?: string
}): Promise<{ csv?: string; error?: string }> {
  const staff = await getCurrentStaffUser()
  if (!staff) return { error: 'Unauthorised' }

  const supabase = createServiceClient()

  let query = supabase
    .from('registrations')
    .select(
      `full_name, email, phone, gms_church, nij,
       payment_status, payment_notes, qr_token, amount_paid, is_early_bird, created_at,
       packages(name, price),
       events(name, currency),
       attendance_logs(scan_type)`
    )
    .order('created_at', { ascending: false })

  if (filters.eventId) query = query.eq('event_id', filters.eventId)
  if (staff.event_scope)  query = query.eq('event_id', staff.event_scope)

  if (filters.search) {
    const q = filters.search
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,nij.ilike.%${q}%,gms_church.ilike.%${q}%`
    )
  }
  if (filters.status) query = query.eq('payment_status', filters.status as PaymentStatus)
  if (filters.church) query = query.eq('gms_church', filters.church)

  const { data, error } = await query
  if (error) return { error: error.message }

  let rows = (data ?? []) as any[]
  if (filters.package) {
    rows = rows.filter((r) => r.packages?.name === filters.package)
  }

  const escape = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const headers = [
    'Full Name', 'Email', 'Phone', 'Church', 'NIJ',
    'Package', 'Price', 'Currency', 'Early Bird', 'Payment Status', 'Payment Notes',
    'Toolkit Collected', 'Event Attended', 'Registered At',
  ]

  const csvRows = rows.map((r) => {
    const logs: string[] = (r.attendance_logs ?? []).map((l: any) => l.scan_type)
    return [
      r.full_name,
      r.email,
      r.phone ?? '',
      r.gms_church,
      r.nij ?? '',
      r.packages?.name ?? '',
      r.amount_paid ?? r.packages?.price ?? '',
      r.events?.currency ?? '',
      r.is_early_bird ? 'Yes' : 'No',
      r.payment_status,
      r.payment_notes ?? '',
      logs.includes('toolkit') ? 'Yes' : 'No',
      logs.includes('event')   ? 'Yes' : 'No',
      r.created_at,
    ].map(escape).join(',')
  })

  return { csv: [headers.join(','), ...csvRows].join('\n') }
}

// ── Screenshot signed URL (2-minute expiry) ───────────────────
export async function getSignedScreenshotUrl(
  storagePath: string
): Promise<string | null> {
  const supabase = createServiceClient()
  const { data } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(storagePath, 120)
  return data?.signedUrl ?? null
}

// ── QR code as base64 data URL (server-side only) ─────────────
export async function getQRDataUrl(qrToken: string): Promise<string> {
  return QRCode.toDataURL(qrToken, {
    width: 400,
    margin: 2,
    color: { dark: '#111111', light: '#FFFFFF' },
  })
}

// ── Verify payment ────────────────────────────────────────────
export async function verifyPayment(
  registrationId: string
): Promise<{ error?: string; status?: PaymentStatus }> {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    return { error: 'Unauthorised' }
  }

  const supabase = createServiceClient()

  const { data: reg, error } = await supabase
    .from('registrations')
    .update({ payment_status: 'verified', payment_notes: null })
    .eq('id', registrationId)
    .select(
      `full_name, email, gms_church, nij, qr_token, amount_paid, is_early_bird,
       packages(name, price, toolkit_items),
       events(name, date, location, currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date)`
    )
    .single()

  if (error || !reg) return { error: 'Update failed. Please try again.' }

  try {
    const pkg = reg.packages as unknown as { name: string; price: number; toolkit_items: string[] }
    const evt = reg.events as unknown as {
      name: string
      date: string
      location: string
      currency: string
      early_bird_enabled: boolean
      early_bird_auto_change: boolean
      early_bird_end_date: string | null
    }
    await sendVerifiedEmail(
      {
        full_name: reg.full_name,
        email: reg.email,
        gms_church: reg.gms_church,
        nij: reg.nij,
        qr_token: reg.qr_token,
      },
      pkg,
      evt,
      reg.amount_paid != null
        ? {
            amount_paid: Number(reg.amount_paid),
            is_early_bird: reg.is_early_bird,
          }
        : undefined
    )
  } catch (e) {
    console.error('[email error]', e)
  }

  revalidatePath('/dashboard/registrations')
  return { status: 'verified' }
}

// ── Reject payment ────────────────────────────────────────────
export async function rejectPayment(
  registrationId: string,
  reason: string
): Promise<{ error?: string; status?: PaymentStatus }> {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    return { error: 'Unauthorised' }
  }

  if (!reason.trim()) return { error: 'Please enter a rejection reason.' }

  const supabase = createServiceClient()

  const { data: reg, error } = await supabase
    .from('registrations')
    .update({ payment_status: 'rejected', payment_notes: reason.trim() })
    .eq('id', registrationId)
    .select('full_name, email, events(name, date, location)')
    .single()

  if (error || !reg) return { error: 'Update failed. Please try again.' }

  try {
    await sendRejectionEmail(
      { full_name: reg.full_name, email: reg.email },
      reg.events as unknown as { name: string; date: string; location: string },
      reason.trim()
    )
  } catch (e) {
    console.error('[email error]', e)
  }

  revalidatePath('/dashboard/registrations')
  return { status: 'rejected' }
}

// ── Edit registration fields ──────────────────────────────────
export async function updateRegistration(
  registrationId: string,
  updates: {
    full_name: string
    phone: string | null
    gms_church: string
    nij: string | null
  }
): Promise<{ error?: string }> {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    return { error: 'Unauthorised' }
  }

  if (!updates.full_name.trim()) return { error: 'Full name is required.' }

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('registrations')
    .update({
      full_name: updates.full_name.trim(),
      phone: updates.phone?.trim() || null,
      gms_church: updates.gms_church,
      nij: updates.nij?.trim() || null,
    })
    .eq('id', registrationId)

  if (error) return { error: 'Update failed. Please try again.' }

  revalidatePath('/dashboard/registrations')
  return {}
}

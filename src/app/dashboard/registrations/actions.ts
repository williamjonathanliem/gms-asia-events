'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { sendVerifiedEmail, sendRejectionEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { STORAGE_BUCKET } from '@/lib/constants'
import type { PaymentStatus } from '@/lib/types/database'

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
      'full_name, email, gms_church, nij, qr_token, packages(name, price, toolkit_items), events(name, date, location)'
    )
    .single()

  if (error || !reg) return { error: 'Update failed. Please try again.' }

  try {
    await sendVerifiedEmail(
      {
        full_name: reg.full_name,
        email: reg.email,
        gms_church: reg.gms_church,
        nij: reg.nij,
        qr_token: reg.qr_token,
      },
      reg.packages as unknown as { name: string; price: number; toolkit_items: string[] },
      reg.events as unknown as { name: string; date: string; location: string }
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

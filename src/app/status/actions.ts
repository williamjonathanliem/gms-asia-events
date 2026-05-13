'use server'

import { createServiceClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export type StatusResult =
  | { found: false }
  | {
      found: true
      full_name: string
      event_name: string
      event_date: string
      package_name: string | null
      payment_status: 'pending' | 'verified' | 'rejected'
      payment_notes: string | null
      qr_data_url: string | null // only when verified
    }

export async function checkRegistrationStatus(email: string): Promise<StatusResult> {
  if (!email?.trim()) return { found: false }

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('registrations')
    .select(
      `full_name, payment_status, payment_notes, qr_token,
       packages(name),
       events(name, date, is_active)`
    )
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { found: false }

  const evt  = data.events  as unknown as { name: string; date: string; is_active: boolean } | null
  const pkg  = data.packages as unknown as { name: string } | null

  let qr_data_url: string | null = null
  if (data.payment_status === 'verified') {
    try {
      qr_data_url = await QRCode.toDataURL(data.qr_token, {
        width: 300,
        margin: 2,
        color: { dark: '#111111', light: '#FFFFFF' },
      })
    } catch { /* ignore */ }
  }

  return {
    found:          true,
    full_name:      data.full_name,
    event_name:     evt?.name ?? '',
    event_date:     evt?.date ?? '',
    package_name:   pkg?.name ?? null,
    payment_status: data.payment_status as 'pending' | 'verified' | 'rejected',
    payment_notes:  data.payment_notes,
    qr_data_url,
  }
}

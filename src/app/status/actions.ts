'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { resolveEventCurrency } from '@/lib/currencies'
import QRCode from 'qrcode'

export type RegistrationEntry = {
  event_name:     string
  event_date:     string
  event_end_date: string | null
  package_name:   string | null
  amount_paid:    number | null
  currency:       string
  payment_status: 'pending' | 'verified' | 'rejected'
  payment_notes:  string | null
  qr_data_url:    string | null  // only when verified
}

export type StatusResult =
  | { found: false }
  | {
      found:         true
      full_name:     string
      registrations: RegistrationEntry[]
    }

export async function checkRegistrationStatus(email: string): Promise<StatusResult> {
  if (!email?.trim()) return { found: false }

  const supabase = createServiceClient()

  const { data } = await supabase
    .from('registrations')
    .select(
      `full_name, payment_status, payment_notes, qr_token, amount_paid,
       packages(name, price),
       events(name, date, end_date, is_active, currency)`
    )
    .eq('email', email.trim().toLowerCase())
    .order('created_at', { ascending: false })
    .limit(20)

  if (!data || data.length === 0) return { found: false }

  const registrations: RegistrationEntry[] = await Promise.all(
    data.map(async (reg) => {
      const evt = reg.events as unknown as {
        name: string; date: string; end_date: string | null
        is_active: boolean; currency: string
      } | null
      const pkg = reg.packages as unknown as { name: string; price: number } | null

      const currency    = resolveEventCurrency(evt?.currency)
      const amount_paid = reg.amount_paid != null ? Number(reg.amount_paid) : (pkg?.price ?? null)

      let qr_data_url: string | null = null
      if (reg.payment_status === 'verified') {
        try {
          qr_data_url = await QRCode.toDataURL(reg.qr_token, {
            width: 300, margin: 2,
            color: { dark: '#111111', light: '#FFFFFF' },
          })
        } catch { /* ignore */ }
      }

      return {
        event_name:     evt?.name ?? '',
        event_date:     evt?.date ?? '',
        event_end_date: evt?.end_date ?? null,
        package_name:   pkg?.name ?? null,
        amount_paid,
        currency,
        payment_status: reg.payment_status as 'pending' | 'verified' | 'rejected',
        payment_notes:  reg.payment_notes,
        qr_data_url,
      }
    })
  )

  return {
    found:     true,
    full_name: data[0].full_name,
    registrations,
  }
}

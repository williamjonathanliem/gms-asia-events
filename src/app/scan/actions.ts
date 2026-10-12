'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ScanMode = 'toolkit' | 'event'

export type ScanResponse =
  | { success: true; name: string; packageName: string; toolkitItems: string[] }
  | { success: false; message: string }

export async function processScan(
  token: string,
  mode: ScanMode
): Promise<ScanResponse> {
  const cleanToken = token?.trim()
  // qr_token is a UUID column, so anything else can't match and isn't worth a query.
  if (!cleanToken || !UUID_RE.test(cleanToken)) {
    return { success: false, message: 'QR not found' }
  }

  const supabase = createServiceClient()

  // ── 1. Auth check and registration lookup run together ───────
  const [staff, { data: reg }] = await Promise.all([
    getCurrentStaffUser(),
    supabase
      .from('registrations')
      .select(
        'id, full_name, payment_status, event_id, packages(name, toolkit_items), events(is_active)'
      )
      .eq('qr_token', cleanToken)
      .maybeSingle(),
  ])

  if (!staff || !['super_admin', 'admin', 'scanner'].includes(staff.role)) {
    return { success: false, message: 'Unauthorised' }
  }

  if (!reg) return { success: false, message: 'QR not found' }

  // ── 2. Active event ───────────────────────────────────────────
  const event = reg.events as unknown as { is_active: boolean } | null
  if (!event?.is_active) return { success: false, message: 'Wrong event' }

  // ── 3. Payment verified ───────────────────────────────────────
  if (reg.payment_status !== 'verified') {
    return { success: false, message: 'Payment not verified' }
  }

  // ── 4. Write log ──────────────────────────────────────────────
  // UNIQUE (registration_id, scan_type) rejects a repeat scan, so no separate lookup is needed.
  const { error } = await supabase.from('attendance_logs').insert({
    registration_id: reg.id,
    event_id: reg.event_id,
    scan_type: mode,
    scanned_by: staff.id,
  })

  if (error) {
    if (error.code === '23505') return { success: false, message: 'Already scanned' }
    return { success: false, message: 'Scan failed — try again' }
  }

  const pkg = reg.packages as unknown as { name: string; toolkit_items: string[] }

  return {
    success: true,
    name: reg.full_name,
    packageName: pkg?.name ?? '',
    toolkitItems: pkg?.toolkit_items ?? [],
  }
}

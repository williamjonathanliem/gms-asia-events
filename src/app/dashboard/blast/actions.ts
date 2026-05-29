'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { getTransporter, FROM } from '@/lib/email/transporter'
import { revalidatePath } from 'next/cache'

export interface BlastFilters {
  eventId: string | 'all'
  status: 'all' | 'pending' | 'verified' | 'rejected'
  packageId: string | 'all'
  church: string | 'all'
}

export interface EmailBlast {
  id: string
  subject: string
  body_html: string
  filters: BlastFilters
  recipient_count: number
  sent_at: string
  sent_by: string | null
}

async function requireAdminOrAbove() {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) {
    throw new Error('Unauthorised')
  }
  return staff
}

// ── Build recipient query from filters ────────────────────────
function buildQuery(supabase: ReturnType<typeof createServiceClient>, filters: BlastFilters) {
  let q = supabase
    .from('registrations')
    .select('email, full_name')

  if (filters.eventId !== 'all') q = q.eq('event_id', filters.eventId)
  if (filters.status !== 'all')  q = q.eq('payment_status', filters.status)
  if (filters.church !== 'all')  q = q.eq('gms_church', filters.church)
  if (filters.packageId !== 'all') q = q.eq('package_id', filters.packageId)

  return q
}

// ── Preview: return distinct recipient count ──────────────────
export async function previewBlastRecipients(
  filters: BlastFilters
): Promise<{ count: number; error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    const { data, error } = await buildQuery(supabase, filters)
    if (error) return { count: 0, error: error.message }

    // Deduplicate by email
    const unique = new Set((data ?? []).map((r) => r.email))
    return { count: unique.size }
  } catch (e: any) {
    return { count: 0, error: e.message }
  }
}

// ── Send blast ────────────────────────────────────────────────
export async function sendEmailBlast(
  subject: string,
  bodyHtml: string,
  filters: BlastFilters
): Promise<{ sent: number; error?: string }> {
  try {
    const staff = await requireAdminOrAbove()
    if (!subject.trim()) return { sent: 0, error: 'Subject is required' }
    if (!bodyHtml.trim() || bodyHtml === '<p></p>') return { sent: 0, error: 'Message body is required' }

    const supabase = createServiceClient()
    const { data, error } = await buildQuery(supabase, filters)
    if (error) return { sent: 0, error: error.message }

    // Deduplicate
    const seen = new Set<string>()
    const recipients = (data ?? []).filter((r) => {
      if (seen.has(r.email)) return false
      seen.add(r.email)
      return true
    })

    if (recipients.length === 0) return { sent: 0, error: 'No recipients match these filters' }

    // Wrap body in branded layout
    const html = emailLayout(subject, bodyHtml)

    const transporter = getTransporter()
    const from = FROM()

    // Send in batches of 20 (avoid SMTP rate limits)
    const BATCH = 20
    for (let i = 0; i < recipients.length; i += BATCH) {
      const batch = recipients.slice(i, i + BATCH)
      await Promise.all(
        batch.map((r) =>
          transporter.sendMail({
            from,
            to: r.email,
            subject,
            html,
          })
        )
      )
    }

    // Save to history
    await supabase.from('email_blasts').insert({
      subject,
      body_html: bodyHtml,
      filters,
      recipient_count: recipients.length,
      sent_by: staff.id,
    })

    revalidatePath('/dashboard/blast')
    return { sent: recipients.length }
  } catch (e: any) {
    return { sent: 0, error: e.message }
  }
}

// ── Get blast history ─────────────────────────────────────────
export async function getEmailBlasts(): Promise<EmailBlast[]> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('email_blasts')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50)
    return (data ?? []) as EmailBlast[]
  } catch {
    return []
  }
}

// ── Email layout wrapper ──────────────────────────────────────
function emailLayout(subject: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
  <style>
    body { margin:0; padding:0; background:#f4f4f4; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif; }
    a { color:#111111; }
    p { margin:0 0 12px; }
    ul,ol { margin:0 0 12px; padding-left:20px; }
    h1,h2,h3 { margin:0 0 12px; color:#111111; }
    blockquote { margin:0 0 12px; padding-left:12px; border-left:3px solid #E5E5E5; color:#6B6B6B; }
  </style>
</head>
<body>
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #E5E5E5;overflow:hidden;">
        <tr>
          <td style="padding:28px 36px;border-bottom:1px solid #E5E5E5;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B6B6B;">GMS Events</p>
            <p style="margin:0;font-size:18px;font-weight:600;color:#111111;">${subject}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 36px;font-size:14px;color:#111111;line-height:1.6;">
            ${body}
          </td>
        </tr>
        <tr>
          <td style="padding:18px 36px;border-top:1px solid #E5E5E5;background:#fafafa;">
            <p style="margin:0;font-size:11px;color:#6B6B6B;">This message was sent by GMS Events. Please do not reply to this email.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

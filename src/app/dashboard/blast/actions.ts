'use server'

import { createServiceClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { getTransporter, FROM } from '@/lib/email/transporter'
import { sendVerifiedEmail } from '@/lib/email'
import { revalidatePath } from 'next/cache'
import { qrCodeUrl } from '@/lib/email'
import { formatDateRange, formatCurrency } from '@/lib/utils'

export interface BlastFilters {
  eventId: string | 'all'
  status: 'all' | 'pending' | 'verified' | 'rejected'
  packageId: string | 'all'
  church: string | 'all'
}

export type RecipientMode = 'filters' | 'emails'

export interface EmailBlast {
  id: string
  subject: string
  body_html: string
  filters: BlastFilters
  recipient_mode: RecipientMode
  manual_emails: string[] | null
  queued_emails: string[] | null
  recipient_count: number
  status: 'complete' | 'partial'
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Recipient = {
  email: string
  full_name: string
  qr_token?: string | null
  gms_church?: string | null
  event_name?: string | null
  event_date?: string | null
  event_end_date?: string | null
  event_location?: string | null
  event_currency?: string | null
  package_name?: string | null
  package_price?: number | null
  toolkit_items?: string[] | null
}

const REG_SELECT = `
  email, full_name, qr_token, gms_church,
  events(name, date, end_date, location, currency),
  packages(name, price, toolkit_items)
`

// ── Build recipient query from filters ────────────────────────
function buildQuery(supabase: ReturnType<typeof createServiceClient>, filters: BlastFilters) {
  let q = supabase.from('registrations').select(REG_SELECT)
  if (filters.eventId   !== 'all') q = q.eq('event_id',       filters.eventId)
  if (filters.status    !== 'all') q = q.eq('payment_status', filters.status)
  if (filters.church    !== 'all') q = q.eq('gms_church',     filters.church)
  if (filters.packageId !== 'all') q = q.eq('package_id',     filters.packageId)
  return q
}

function mapRow(r: any): Recipient {
  return {
    email:          r.email,
    full_name:      r.full_name ?? '',
    qr_token:       r.qr_token,
    gms_church:     r.gms_church,
    event_name:     r.events?.name,
    event_date:     r.events?.date,
    event_end_date: r.events?.end_date,
    event_location: r.events?.location,
    event_currency: r.events?.currency,
    package_name:   r.packages?.name,
    package_price:  r.packages?.price,
    toolkit_items:  r.packages?.toolkit_items,
  }
}

function dedup(rows: any[]): Recipient[] {
  const seen = new Set<string>()
  return rows
    .filter((r) => {
      if (seen.has(r.email)) return false
      seen.add(r.email)
      return true
    })
    .map(mapRow)
}


// ── Preview recipient count ───────────────────────────────────
export async function previewBlastRecipients(
  mode: RecipientMode,
  filters: BlastFilters,
  manualEmails: string[]
): Promise<{ count: number; error?: string }> {
  try {
    await requireAdminOrAbove()

    if (mode === 'emails') {
      const valid = manualEmails.filter((e) => EMAIL_RE.test(e.trim()))
      return { count: new Set(valid.map((e) => e.trim().toLowerCase())).size }
    }

    const supabase = createServiceClient()
    const { data, error } = await buildQuery(supabase, filters)
    if (error) return { count: 0, error: error.message }
    return { count: new Set((data ?? []).map((r) => r.email)).size }
  } catch (e: any) {
    return { count: 0, error: e.message }
  }
}

const DAILY_LIMIT = 300

function applyTags(bodyHtml: string, subjectRaw: string, r: Recipient): { body: string; subject: string } {
  const dateStr = r.event_date ? formatDateRange(r.event_date, r.event_end_date) : ''
  const priceStr = r.package_price != null
    ? formatCurrency(r.package_price, r.event_currency ?? 'JPY')
    : ''
  const packageStr = [r.package_name, priceStr].filter(Boolean).join(' — ')
  const toolkitStr = r.toolkit_items?.length
    ? r.toolkit_items.map((i) => `<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">· ${i}</p>`).join('')
    : ''
  const qrImg = r.qr_token
    ? `<img src="${qrCodeUrl(r.qr_token)}" width="220" height="220" alt="Your QR Code" style="display:block;margin:16px auto;border-radius:8px;" />`
    : ''

  const replace = (s: string) => s
    .replace(/\{\{QR\}\}/g,       qrImg)
    .replace(/\{\{NAME\}\}/g,     r.full_name ?? '')
    .replace(/\{\{CHURCH\}\}/g,   r.gms_church ?? '')
    .replace(/\{\{EVENT\}\}/g,    r.event_name ?? '')
    .replace(/\{\{DATE\}\}/g,     dateStr)
    .replace(/\{\{LOCATION\}\}/g, r.event_location ?? '')
    .replace(/\{\{PACKAGE\}\}/g,  packageStr)
    .replace(/\{\{TOOLKIT\}\}/g,  toolkitStr)

  return { body: replace(bodyHtml), subject: replace(subjectRaw) }
}

async function sendBatch(
  recipients: Recipient[],
  bodyHtml: string,
  subject: string
): Promise<{ sent: number; failed: number }> {
  const transporter = getTransporter()
  const from = FROM()
  const BATCH = 20
  let sent = 0
  let failed = 0

  for (let i = 0; i < recipients.length; i += BATCH) {
    const batch = recipients.slice(i, i + BATCH)
    await Promise.all(
      batch.map(async (r) => {
        try {
          const { body, subject: subj } = applyTags(bodyHtml, subject, r)
          await transporter.sendMail({ from, to: r.email, subject: subj, html: emailLayout(subj, body) })
          sent++
        } catch {
          failed++
        }
      })
    )
  }
  return { sent, failed }
}

// ── Send blast ────────────────────────────────────────────────
export async function sendEmailBlast(
  subject: string,
  bodyHtml: string,
  mode: RecipientMode,
  filters: BlastFilters,
  manualEmails: string[]
): Promise<{ sent: number; failed: number; queued: number; error?: string }> {
  try {
    const staff = await requireAdminOrAbove()
    if (!subject.trim()) return { sent: 0, failed: 0, queued: 0, error: 'Subject is required' }
    if (!bodyHtml.trim() || bodyHtml === '<p></p>') return { sent: 0, failed: 0, queued: 0, error: 'Message body is required' }

    const supabase = createServiceClient()
    let allRecipients: Recipient[] = []

    if (mode === 'emails') {
      const valid = Array.from(new Set(
        manualEmails.map((e) => e.trim().toLowerCase()).filter((e) => EMAIL_RE.test(e))
      ))
      if (valid.length === 0) return { sent: 0, failed: 0, queued: 0, error: 'No valid email addresses entered' }

      const { data: regs } = await supabase
        .from('registrations').select(REG_SELECT)
        .in('email', valid)
      const regMap = new Map((regs ?? []).map((r: any) => [r.email, mapRow(r)]))
      allRecipients = valid.map((email) => regMap.get(email) ?? { email, full_name: email })
    } else {
      const { data, error } = await buildQuery(supabase, filters)
      if (error) return { sent: 0, failed: 0, queued: 0, error: error.message }
      allRecipients = dedup(data ?? [])
      if (allRecipients.length === 0) return { sent: 0, failed: 0, queued: 0, error: 'No recipients match these filters' }
    }

    const toSend = allRecipients.slice(0, DAILY_LIMIT)
    const overflow = allRecipients.slice(DAILY_LIMIT)

    const { sent, failed } = await sendBatch(toSend, bodyHtml, subject)

    const queuedEmails = overflow.map((r) => r.email)
    const isPartial = queuedEmails.length > 0

    await supabase.from('email_blasts').insert({
      subject,
      body_html: bodyHtml,
      filters,
      recipient_mode: mode,
      manual_emails: mode === 'emails' ? allRecipients.map((r) => r.email) : null,
      queued_emails: isPartial ? queuedEmails : null,
      recipient_count: sent,
      status: isPartial ? 'partial' : 'complete',
      sent_by: staff.id,
    })

    revalidatePath('/dashboard/blast')
    return { sent, failed, queued: queuedEmails.length }
  } catch (e: any) {
    return { sent: 0, failed: 0, queued: 0, error: e.message }
  }
}

// ── Continue a partial blast ──────────────────────────────────
export async function continueEmailBlast(
  blastId: string
): Promise<{ sent: number; failed: number; queued: number; error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    const { data: blast, error: fetchErr } = await supabase
      .from('email_blasts')
      .select('id, subject, body_html, queued_emails, recipient_count')
      .eq('id', blastId)
      .single()

    if (fetchErr || !blast) return { sent: 0, failed: 0, queued: 0, error: 'Blast not found' }
    const queue: string[] = blast.queued_emails ?? []
    if (queue.length === 0) return { sent: 0, failed: 0, queued: 0, error: 'No queued recipients' }

    const toSendEmails = queue.slice(0, DAILY_LIMIT)
    const remainingEmails = queue.slice(DAILY_LIMIT)

    const { data: regs } = await supabase
      .from('registrations').select(REG_SELECT)
      .in('email', toSendEmails)
    const regMap = new Map((regs ?? []).map((r: any) => [r.email, mapRow(r)]))
    const recipients: Recipient[] = toSendEmails.map((email) => regMap.get(email) ?? { email, full_name: email })

    const { sent, failed } = await sendBatch(recipients, blast.body_html, blast.subject)

    const isPartial = remainingEmails.length > 0
    await supabase.from('email_blasts').update({
      queued_emails: isPartial ? remainingEmails : null,
      status: isPartial ? 'partial' : 'complete',
      recipient_count: (blast.recipient_count ?? 0) + sent,
    }).eq('id', blastId)

    revalidatePath('/dashboard/blast')
    return { sent, failed, queued: remainingEmails.length }
  } catch (e: any) {
    return { sent: 0, failed: 0, queued: 0, error: e.message }
  }
}

// ── Resend QR codes ───────────────────────────────────────────
export async function resendQRCodes(
  eventId: string
): Promise<{ sent: number; failed: number; error?: string }> {
  try {
    await requireAdminOrAbove()
    const supabase = createServiceClient()

    let query = supabase
      .from('registrations')
      .select(
        `full_name, email, gms_church, nij, qr_token, amount_paid, is_early_bird,
         packages(name, price, toolkit_items),
         events(name, date, end_date, location, currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date)`
      )
      .eq('payment_status', 'verified')

    if (eventId !== 'all') query = query.eq('event_id', eventId)

    const { data, error } = await query
    if (error) return { sent: 0, failed: 0, error: error.message }

    const rows = data ?? []
    if (rows.length === 0) return { sent: 0, failed: 0, error: 'No verified registrations found for this event' }

    // QR generation is memory-heavy — process in small batches
    const BATCH = 5
    let sent = 0
    let failed = 0

    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      await Promise.all(
        batch.map(async (reg) => {
          try {
            await sendVerifiedEmail(
              {
                full_name: reg.full_name,
                email:     reg.email,
                gms_church: reg.gms_church,
                nij:       reg.nij,
                qr_token:  reg.qr_token,
              },
              reg.packages as any,
              reg.events   as any,
              reg.amount_paid != null
                ? { amount_paid: Number(reg.amount_paid), is_early_bird: reg.is_early_bird }
                : undefined
            )
            sent++
          } catch {
            failed++
          }
        })
      )
    }

    return { sent, failed }
  } catch (e: any) {
    return { sent: 0, failed: 0, error: e.message }
  }
}

// ── Delete blasts ─────────────────────────────────────────────
export async function deleteEmailBlasts(ids: string[]): Promise<{ error?: string }> {
  try {
    await requireAdminOrAbove()
    if (!ids.length) return {}
    const supabase = createServiceClient()
    const { error } = await supabase.from('email_blasts').delete().in('id', ids)
    if (error) return { error: error.message }
    revalidatePath('/dashboard/blast')
    return {}
  } catch (e: any) {
    return { error: e.message }
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

import QRCode from 'qrcode'
import { getTransporter, FROM } from './transporter'
import {
  confirmationTemplate,
  verifiedTemplate,
  rejectionTemplate,
} from './templates'
import type { EmailPricing } from './templates'
import type { Event, Package, Registration } from '@/lib/types/database'

type RegSummary = Pick<Registration, 'full_name' | 'email' | 'gms_church' | 'nij' | 'qr_token'>
type PkgSummary = Pick<Package, 'name' | 'price' | 'toolkit_items'>
type EventSummary = Pick<
  Event,
  | 'name'
  | 'date'
  | 'location'
  | 'currency'
  | 'early_bird_enabled'
  | 'early_bird_auto_change'
  | 'early_bird_end_date'
>

async function makeQR(token: string): Promise<Buffer> {
  return QRCode.toBuffer(token, {
    width: 400,
    margin: 2,
    color: { dark: '#111111', light: '#FFFFFF' },
  })
}

const qrAttachment = (buffer: Buffer) => ({
  filename: 'qr-code.png',
  content: buffer,
  cid: 'qr-code',
})

// ── Sent immediately on registration (no QR yet — pending review) ────
export async function sendConfirmationEmail(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary,
  pricing?: EmailPricing
) {
  const subject = pricing?.is_early_bird
    ? `Registration Received (Early Bird) — ${event.name}`
    : `Registration Received — ${event.name}`
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject,
    html: confirmationTemplate(reg, pkg, event, pricing),
    // No QR attachment — QR is only sent once payment is verified
  })
}

// ── Sent when admin verifies payment ─────────────────────────
export async function sendVerifiedEmail(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary,
  pricing?: EmailPricing
) {
  const qr = await makeQR(reg.qr_token)
  const subject = pricing?.is_early_bird
    ? `Registration Confirmed (Early Bird) — ${event.name}`
    : `Registration Confirmed — ${event.name}`
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject,
    html: verifiedTemplate(reg, pkg, event, pricing),
    attachments: [qrAttachment(qr)],
  })
}

// ── Sent when admin rejects payment ──────────────────────────
export async function sendRejectionEmail(
  reg: Pick<Registration, 'full_name' | 'email'>,
  event: Pick<Event, 'name' | 'date' | 'location'>,
  reason: string
) {
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject: `Registration Update — ${event.name}`,
    html: rejectionTemplate(reg, event, reason),
  })
}

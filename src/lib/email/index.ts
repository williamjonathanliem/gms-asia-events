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
  | 'end_date'
  | 'location'
  | 'currency'
  | 'early_bird_enabled'
  | 'early_bird_auto_change'
  | 'early_bird_end_date'
>

function appUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'https://gms-asia-events.vercel.app'
}

export function qrCodeUrl(token: string) {
  return `${appUrl()}/api/qr/${token}`
}

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
  })
}

// ── Sent when admin verifies payment ─────────────────────────
export async function sendVerifiedEmail(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary,
  pricing?: EmailPricing
) {
  const subject = pricing?.is_early_bird
    ? `Registration Confirmed (Early Bird) — ${event.name}`
    : `Registration Confirmed — ${event.name}`
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject,
    html: verifiedTemplate(reg, pkg, event, pricing, qrCodeUrl(reg.qr_token)),
  })
}

// ── Sent when admin rejects payment ──────────────────────────
export async function sendRejectionEmail(
  reg: Pick<Registration, 'full_name' | 'email'>,
  event: Pick<Event, 'name' | 'date' | 'end_date' | 'location'>,
  reason: string
) {
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject: `Registration Update — ${event.name}`,
    html: rejectionTemplate(reg, event, reason),
  })
}

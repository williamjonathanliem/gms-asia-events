import QRCode from 'qrcode'
import { getTransporter, FROM } from './transporter'
import {
  confirmationTemplate,
  verifiedTemplate,
  rejectionTemplate,
} from './templates'
import type { Event, Package, Registration } from '@/lib/types/database'

type RegSummary = Pick<Registration, 'full_name' | 'email' | 'gms_church' | 'nij' | 'qr_token'>
type PkgSummary = Pick<Package, 'name' | 'price' | 'toolkit_items'>
type EventSummary = Pick<Event, 'name' | 'date' | 'location'>

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

// ── Sent immediately on registration ─────────────────────────
export async function sendConfirmationEmail(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary
) {
  const qr = await makeQR(reg.qr_token)
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject: `Registration Received — ${event.name}`,
    html: confirmationTemplate(reg, pkg, event),
    attachments: [qrAttachment(qr)],
  })
}

// ── Sent when admin verifies payment ─────────────────────────
export async function sendVerifiedEmail(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary
) {
  const qr = await makeQR(reg.qr_token)
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject: `Registration Confirmed — ${event.name}`,
    html: verifiedTemplate(reg, pkg, event),
    attachments: [qrAttachment(qr)],
  })
}

// ── Sent when admin rejects payment ──────────────────────────
export async function sendRejectionEmail(
  reg: Pick<Registration, 'full_name' | 'email'>,
  event: EventSummary,
  reason: string
) {
  await getTransporter().sendMail({
    from: FROM(),
    to: reg.email,
    subject: `Registration Update — ${event.name}`,
    html: rejectionTemplate(reg, event, reason),
  })
}

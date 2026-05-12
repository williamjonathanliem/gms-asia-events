import { formatCurrency, formatDate } from '@/lib/utils'
import type { Event, Package, Registration } from '@/lib/types/database'

type RegSummary = Pick<Registration, 'full_name' | 'email' | 'gms_church' | 'nij'>
type PkgSummary = Pick<Package, 'name' | 'price' | 'toolkit_items'>
type EventSummary = Pick<Event, 'name' | 'date' | 'location'>

// ── Shared layout wrapper ─────────────────────────────────────
function layout(eventName: string, body: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width" />
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #E5E5E5;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 36px;border-bottom:1px solid #E5E5E5;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#6B6B6B;">GMS Events</p>
              <p style="margin:0;font-size:18px;font-weight:600;color:#111111;">${eventName}</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 36px;">
              ${body}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:18px 36px;border-top:1px solid #E5E5E5;background:#fafafa;">
              <p style="margin:0;font-size:11px;color:#6B6B6B;">
                This is an automated message. Please do not reply to this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ── Shared registration detail block ─────────────────────────
function registrationBlock(reg: RegSummary, pkg: PkgSummary) {
  const nijRow = reg.nij
    ? `<tr>
        <td style="padding:14px 18px;border-bottom:1px solid #E5E5E5;">
          <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">NIJ / Disciple ID</p>
          <p style="margin:0;font-size:13px;color:#111111;">${reg.nij}</p>
        </td>
      </tr>`
    : ''

  const toolkitRows = pkg.toolkit_items
    .map(
      (item) =>
        `<p style="margin:0 0 4px;font-size:13px;color:#6B6B6B;">· ${item}</p>`
    )
    .join('')

  return `
  <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E5E5;border-radius:8px;margin-bottom:24px;">
    <tr>
      <td style="padding:14px 18px;border-bottom:1px solid #E5E5E5;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">Name</p>
        <p style="margin:0;font-size:13px;color:#111111;">${reg.full_name}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 18px;border-bottom:1px solid #E5E5E5;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">Church</p>
        <p style="margin:0;font-size:13px;color:#111111;">${reg.gms_church}</p>
      </td>
    </tr>
    ${nijRow}
    <tr>
      <td style="padding:14px 18px;border-bottom:1px solid #E5E5E5;">
        <p style="margin:0 0 3px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">Package</p>
        <p style="margin:0;font-size:13px;font-weight:600;color:#111111;">Package ${pkg.name} — ${formatCurrency(pkg.price)}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 18px;">
        <p style="margin:0 0 8px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#6B6B6B;">Toolkit Items</p>
        ${toolkitRows}
      </td>
    </tr>
  </table>`
}

// ── 1. Confirmation email (sent on registration) ──────────────
export function confirmationTemplate(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary
) {
  const body = `
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111111;">Hi ${reg.full_name},</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6B6B6B;line-height:1.6;">
      Your registration for <strong style="color:#111111;">${event.name}</strong> on
      ${formatDate(event.date)} has been received. Our team will review your
      payment and confirm your spot shortly.
    </p>

    ${registrationBlock(reg, pkg)}

    <!-- QR Code -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E5E5;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px 24px 12px;">
          <img src="cid:qr-code" width="180" height="180" alt="QR Code"
            style="display:block;border-radius:4px;" />
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#6B6B6B;line-height:1.5;">
            Your QR code — keep this private.<br />
            It will be activated once your payment is verified.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#6B6B6B;line-height:1.6;">
      You will receive a follow-up email once your registration is confirmed.
      If you have any questions, please contact your church coordinator.
    </p>`

  return layout(event.name, body)
}

// ── 2. Verified email (sent when admin approves payment) ──────
export function verifiedTemplate(
  reg: RegSummary,
  pkg: PkgSummary,
  event: EventSummary
) {
  const body = `
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111111;">Hi ${reg.full_name},</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6B6B6B;line-height:1.6;">
      Your payment for <strong style="color:#111111;">${event.name}</strong> has been
      verified. Your registration is confirmed — we look forward to seeing you on
      ${formatDate(event.date)}.
    </p>

    ${registrationBlock(reg, pkg)}

    <!-- QR Code -->
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E5E5;border-radius:8px;margin-bottom:24px;">
      <tr>
        <td align="center" style="padding:24px 24px 12px;">
          <img src="cid:qr-code" width="180" height="180" alt="QR Code"
            style="display:block;border-radius:4px;" />
        </td>
      </tr>
      <tr>
        <td style="padding:0 20px 20px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#6B6B6B;line-height:1.5;">
            Present this QR code at the event entrance and toolkit counter.<br />
            Keep it private — do not share with others.
          </p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:12px;color:#6B6B6B;line-height:1.6;">
      Please arrive at <strong style="color:#111111;">${event.location}</strong> on
      ${formatDate(event.date)}. The QR code covers both toolkit pickup and event entry.
    </p>`

  return layout(event.name, body)
}

// ── 3. Rejection email (sent when admin rejects payment) ──────
export function rejectionTemplate(
  reg: Pick<Registration, 'full_name'>,
  event: EventSummary,
  reason: string
) {
  const body = `
    <p style="margin:0 0 6px;font-size:15px;font-weight:600;color:#111111;">Hi ${reg.full_name},</p>
    <p style="margin:0 0 24px;font-size:13px;color:#6B6B6B;line-height:1.6;">
      We were unable to verify your payment for
      <strong style="color:#111111;">${event.name}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0"
      style="border:1px solid #E5E5E5;border-left:3px solid #DC2626;border-radius:0 8px 8px 0;margin-bottom:24px;">
      <tr>
        <td style="padding:14px 18px;">
          <p style="margin:0 0 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:#DC2626;">Reason</p>
          <p style="margin:0;font-size:13px;color:#111111;">${reason}</p>
        </td>
      </tr>
    </table>

    <p style="margin:0;font-size:13px;color:#6B6B6B;line-height:1.6;">
      Please contact your church coordinator to resolve this.
      Once corrected, you may re-register using the registration link.
    </p>`

  return layout(event.name, body)
}

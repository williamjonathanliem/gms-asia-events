import { BrevoClient } from '@getbrevo/brevo'

type MailOptions = {
  from: string
  to: string
  subject: string
  html: string
}

class BrevoTransporter {
  private client: BrevoClient

  constructor(apiKey: string) {
    this.client = new BrevoClient({ apiKey })
  }

  async sendMail(options: MailOptions) {
    const fromMatch = options.from.match(/^(.+?)\s*<(.+?)>$/)
    const sender = fromMatch
      ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
      : { email: options.from }

    await this.client.transactionalEmails.sendTransacEmail({
      sender,
      to: [{ email: options.to }],
      subject: options.subject,
      htmlContent: options.html,
    })
  }
}

let _transporter: BrevoTransporter | null = null

export function getTransporter(): BrevoTransporter {
  if (_transporter) return _transporter
  _transporter = new BrevoTransporter(process.env.BREVO_API_KEY!)
  return _transporter
}

export const FROM = () =>
  `${process.env.EMAIL_FROM_NAME ?? 'GMS Events'} <${process.env.EMAIL_FROM ?? process.env.EMAIL_USER}>`

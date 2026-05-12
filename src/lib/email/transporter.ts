import nodemailer from 'nodemailer'

let _transporter: nodemailer.Transporter | null = null

export function getTransporter() {
  if (_transporter) return _transporter

  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST!,
    port: Number(process.env.EMAIL_PORT ?? 587),
    // port 465 = SSL, everything else = STARTTLS
    secure: process.env.EMAIL_PORT === '465',
    auth: {
      user: process.env.EMAIL_USER!,
      pass: process.env.EMAIL_PASS!,
    },
  })

  return _transporter
}

export const FROM = () =>
  `${process.env.EMAIL_FROM_NAME ?? 'GMS Events'} <${process.env.EMAIL_USER}>`

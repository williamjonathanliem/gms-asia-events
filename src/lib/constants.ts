export const GMS_CHURCHES = [
  'GMS Hong Kong',
  'GMS Kaohsiung Satellite',
  'GMS Kota Kinabalu Satellite',
  'GMS Kuala Lumpur',
  'GMS Kuching',
  'GMS Osaka Satellite',
  'GMS Taipei',
  'GMS Tokyo Satellite',
  'GMS Surabaya',
  'GMS Jakarta',
] as const

export type GMSChurch = (typeof GMS_CHURCHES)[number]

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
}

export const SCAN_TYPE_LABELS: Record<string, string> = {
  toolkit: 'Toolkit Pickup',
  event: 'Event Attendance',
}

export const STORAGE_BUCKET = 'payment-screenshots'

// ── Stripe fee gross-up ────────────────────────────────────────
// stripe_price_jpy in DB = NET amount organizer wants to receive.
// We charge registrants more so the organizer nets exactly that amount.
// Using 4.0% based on observed Stripe rate (~3.97% for Visa).
export const STRIPE_FEE_RATE = 0.0395 // Observed rate from sandbox: ~3.95% (incl. cross-border for MY/SG/ID cards)

export function stripeGrossAmount(netJpy: number): number {
  return Math.ceil(netJpy / (1 - STRIPE_FEE_RATE))
}

export function stripeFeeAmount(netJpy: number): number {
  return stripeGrossAmount(netJpy) - netJpy
}

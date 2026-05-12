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

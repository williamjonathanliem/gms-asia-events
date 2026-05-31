export type PaymentStatus = 'pending' | 'verified' | 'rejected'
export type PaymentMethod = 'manual' | 'stripe'
export type ScanType = 'toolkit' | 'event'
export type StaffRole = 'super_admin' | 'admin' | 'scanner'
export type CustomFieldType = 'text' | 'textarea' | 'select' | 'checkbox'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  required: boolean
  placeholder?: string
  options?: string[] // only for type='select'
}

export type CoreFieldKey = 'full_name' | 'email' | 'phone' | 'gms_church' | 'nij'
export type CoreFieldInputType = 'text' | 'email' | 'tel' | 'textarea' | 'select'

export interface CoreField {
  key: CoreFieldKey
  label: string
  required: boolean
  enabled: boolean
  inputType: CoreFieldInputType
  options?: string[] // only when inputType === 'select'
}

export const DEFAULT_CORE_FIELDS: CoreField[] = [
  { key: 'full_name',  label: 'Full Name',          required: true,  enabled: true, inputType: 'text' },
  { key: 'email',      label: 'Email Address',       required: true,  enabled: true, inputType: 'email' },
  { key: 'phone',      label: 'Phone Number',        required: false, enabled: true, inputType: 'tel' },
  { key: 'gms_church', label: 'GMS Church Branch',   required: true,  enabled: true, inputType: 'select' },
  { key: 'nij',        label: 'NIJ / Disciple ID',   required: false, enabled: true, inputType: 'text' },
]

/** Merge saved overrides with defaults — always returns all 5 fields */
export function resolveCoreFields(saved: CoreField[] | null | undefined): CoreField[] {
  if (!saved || saved.length === 0) return DEFAULT_CORE_FIELDS
  return DEFAULT_CORE_FIELDS.map((def) => {
    const override = saved.find((f) => f.key === def.key)
    return override ?? def
  })
}

export interface Event {
  id: string
  name: string
  slug: string
  date: string
  location: string
  is_active: boolean
  form_title: string | null
  form_subtitle: string | null
  registration_open: boolean
  custom_fields: CustomField[]
  core_fields: CoreField[] | null
  early_bird_enabled: boolean
  early_bird_auto_change: boolean
  early_bird_end_date: string | null
  currency: string
  created_at: string
}

export interface EventWithPackages extends Event {
  packages: Package[]
}

export interface Package {
  id: string
  event_id: string
  name: string
  price: number
  early_bird_price: number | null
  stripe_price_jpy: number | null
  toolkit_items: string[]
  created_at: string
}

export interface Registration {
  id: string
  event_id: string
  full_name: string
  email: string
  phone: string | null
  gms_church: string
  nij: string | null
  package_id: string | null
  payment_method: PaymentMethod
  payment_screenshot_url: string | null
  payment_status: PaymentStatus
  stripe_payment_intent_id: string | null
  payment_notes: string | null
  qr_token: string
  custom_answers: Record<string, string | boolean>
  amount_paid: number | null
  is_early_bird: boolean
  created_at: string
}

export interface AttendanceLog {
  id: string
  registration_id: string
  event_id: string
  scan_type: ScanType
  scanned_at: string
  scanned_by: string | null
}

export interface StaffUser {
  id: string
  email: string
  role: StaffRole
  event_scope: string | null
  created_at: string
}

// ── Join types ────────────────────────────────────────────────

export interface RegistrationWithPackage extends Registration {
  packages: Package
}

export interface RegistrationWithDetails extends Registration {
  packages: Package
  events: Event
  attendance_logs: AttendanceLog[]
}

export interface AttendanceLogWithStaff extends AttendanceLog {
  staff_users: Pick<StaffUser, 'email' | 'role'> | null
}

// ── API response types ────────────────────────────────────────

export interface ScanResult {
  success: boolean
  message: string
  registration?: Pick<Registration, 'full_name' | 'package_id'>
  package?: Package
}

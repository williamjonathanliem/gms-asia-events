export type PaymentStatus = 'pending' | 'verified' | 'rejected'
export type ScanType = 'toolkit' | 'event'
export type StaffRole = 'super_admin' | 'admin' | 'viewer' | 'scanner'
export type CustomFieldType = 'text' | 'textarea' | 'select' | 'checkbox'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  required: boolean
  placeholder?: string
  options?: string[] // only for type='select'
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
  payment_screenshot_url: string | null
  payment_status: PaymentStatus
  payment_notes: string | null
  qr_token: string
  custom_answers: Record<string, string | boolean>
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

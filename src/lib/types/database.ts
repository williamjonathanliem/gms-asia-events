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
  { key: 'full_name',  label: 'Full Name',                        required: true,  enabled: true, inputType: 'text' },
  { key: 'email',      label: 'Email Address',                     required: true,  enabled: true, inputType: 'email' },
  { key: 'phone',      label: 'Phone Number (WhatsApp)',           required: true,  enabled: true, inputType: 'tel' },
  { key: 'gms_church', label: 'GMS Church Origin / Church Origin', required: true,  enabled: true, inputType: 'select' },
  { key: 'nij',        label: 'NIJ / Disciple ID',                required: false, enabled: true, inputType: 'text' },
]

/** Merge saved overrides with defaults — always returns all 5 fields */
export function resolveCoreFields(saved: CoreField[] | null | undefined): CoreField[] {
  if (!saved || saved.length === 0) return DEFAULT_CORE_FIELDS
  return DEFAULT_CORE_FIELDS.map((def) => {
    const override = saved.find((f) => f.key === def.key)
    return override ?? def
  })
}

export type FormBgType      = 'solid' | 'gradient'
export type FormCardStyle   = 'transparent' | 'glass' | 'white' | 'dark'
export type FormButtonShape = 'sharp' | 'rounded' | 'pill'
export type FormInputStyle  = 'outlined' | 'filled' | 'underline'
export type FormFontFamily  = 'geist' | 'inter' | 'poppins' | 'raleway' | 'playfair' | 'montserrat'

export interface FormTheme {
  // Background
  type:          FormBgType
  color1:        string   // solid: bg colour | gradient: from colour
  color2:        string   // gradient: to colour (unused for solid)
  angle:         number   // gradient angle in degrees (0-360)
  // Particles — independent overlay on top of any background
  particles:      boolean
  particleColor:  string
  // Text colours ('' = auto-derive from background darkness)
  textColor:     string
  mutedColor:    string
  // Accent
  accentColor:   string   // buttons, radio fills, focus rings
  // Typography
  fontFamily:    FormFontFamily
  // Layout
  cardStyle:     FormCardStyle
  // Components
  buttonShape:   FormButtonShape
  inputStyle:    FormInputStyle
  // Header banner
  bannerMode?:   'none' | 'color' | 'image'
  bannerColor?:  string   // hex — used when bannerMode === 'color'
  bannerUrl?:    string   // URL  — used when bannerMode === 'image'
}

export const DEFAULT_FORM_THEME: FormTheme = {
  type:          'solid',
  color1:        '#ffffff',
  color2:        '#6366f1',
  angle:         135,
  particles:     false,
  particleColor: '#6366f1',
  textColor:     '',
  mutedColor:    '',
  accentColor:   '#111111',
  fontFamily:    'geist',
  cardStyle:     'transparent',
  buttonShape:   'rounded',
  inputStyle:    'outlined',
  bannerMode:    'none',
  bannerColor:   '#6366f1',
}

export function resolveTheme(saved: Partial<FormTheme> | null | undefined): FormTheme {
  return { ...DEFAULT_FORM_THEME, ...(saved ?? {}) }
}

/** Returns true if the color is dark enough to need white text */
export function isColorDark(hex: string): boolean {
  const c = hex.replace('#', '')
  if (c.length < 6) return false
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  // Perceived luminance
  return (r * 299 + g * 587 + b * 114) / 1000 < 128
}

export interface Event {
  id: string
  name: string
  slug: string
  date: string
  end_date: string | null   // optional — if set, event spans multiple days
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
  form_theme: Partial<FormTheme> | null
  popup_enabled: boolean
  popup_content: string | null
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

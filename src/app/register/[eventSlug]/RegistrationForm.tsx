'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { submitRegistration, createStripeRegistration, type RegisterFormState } from './actions'
import { type Event, type Package, type CustomField, resolveCoreFields, resolveTheme, isColorDark } from '@/lib/types/database'
import FormBackground, { themeDark, getBackgroundCSS } from '@/components/registration/FormBackground'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatJPY, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select-native'
import { getStripePromise } from '@/lib/stripe-client'

// ── Bank / payment data ───────────────────────────────────────
const PAYPAY_QR_IMAGE = '/paypay-qr.png'
const PAYPAY_LINK = 'https://qr.paypay.ne.jp/p2p01_zCcb7GDpzP9swuRY'

type BankRow     = { label: string; value: string; copyValue?: string; copyable?: boolean }
type BankSection = { title?: string; rows: BankRow[] }
type BankOption  = { id: string; label: string; sections?: BankSection[]; note?: string; hasQR?: boolean }

const BANK_OPTIONS: BankOption[] = [
  {
    id: 'jppost',
    label: 'JP Post Bank',
    sections: [
      {
        title: 'JP Post Transfer',
        rows: [
          { label: 'Account Name', value: 'Andrew Getty Tantomo' },
          { label: 'Code No.',     value: '10950',    copyable: true },
          { label: 'Account No.', value: '17568871', copyable: true },
        ],
      },
      {
        title: 'Other Bank Transfer',
        rows: [
          { label: 'Account Name', value: 'Andrew Getty Tantomo' },
          { label: 'Branch Code',  value: '098',     copyable: true },
          { label: 'Account No.', value: '1756887', copyable: true },
        ],
      },
    ],
  },
  {
    id: 'rakuten',
    label: 'Rakuten Bank',
    sections: [
      {
        rows: [
          { label: 'Bank Name',    value: '楽天銀行 (Rakuten Bank)' },
          { label: 'Branch No.',   value: '254',     copyable: true },
          { label: 'Branch Name',  value: '第四営業支店 (Daiyon Eigyou Shiten)' },
          { label: 'Account Name', value: 'シヤ）ゴスペルミッションステュワーズチャーチ' },
          { label: 'Account No.', value: '7760827', copyable: true },
        ],
      },
    ],
  },
  {
    id: 'cash',
    label: 'Cash',
    note: 'Pay in cash directly to your Church or CG leader. You will receive a receipt as proof. No screenshot upload needed — our admin will verify manually.',
  },
  {
    id: 'paypay',
    label: 'PayPay',
    sections: [
      {
        rows: [
          { label: 'Number', value: '070-9194-7415', copyValue: '07091947415', copyable: true },
          { label: 'Name',   value: 'VERICO CHRISTIAN JONATHAN' },
        ],
      },
    ],
    hasQR: true,
  },
]

// ── Font map ─────────────────────────────────────────────────
const FONT_MAP: Record<string, { css: string; url: string | null }> = {
  geist:      { css: '"Geist", system-ui, sans-serif',         url: null },
  inter:      { css: '"Inter", system-ui, sans-serif',          url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap' },
  poppins:    { css: '"Poppins", system-ui, sans-serif',        url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600&display=swap' },
  raleway:    { css: '"Raleway", system-ui, sans-serif',        url: 'https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600&display=swap' },
  playfair:   { css: '"Playfair Display", Georgia, serif',      url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600&display=swap' },
  montserrat: { css: '"Montserrat", system-ui, sans-serif',     url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600&display=swap' },
}

// ── Stripe appearance ─────────────────────────────────────────
const STRIPE_APPEARANCE = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary:  '#111111',
    colorBackground: '#ffffff',
    colorText:     '#111111',
    colorDanger:   '#DC2626',
    fontFamily:    '"Geist", system-ui, -apple-system, sans-serif',
    borderRadius:  '6px',
    fontSizeBase:  '14px',
  },
  rules: {
    '.Input':       { border: '1px solid #E5E5E5', boxShadow: 'none' },
    '.Input:focus': { border: '1px solid #111111', boxShadow: 'none' },
    '.Label':       { fontWeight: '500', color: '#111111', marginBottom: '6px' },
  },
}

const STRIPE_FONTS = [
  { cssSrc: 'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap' },
]

// ── ManualSubmitButton — uses CSS vars set on ancestor ────────
function ManualSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full mt-2 flex items-center justify-center py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        backgroundColor: 'var(--form-accent)',
        color:           'var(--form-accent-text)',
        borderRadius:    'var(--form-btn-radius)',
      }}
    >
      {pending ? (
        <span className="flex items-center gap-2">
          <Spinner />
          Submitting...
        </span>
      ) : (
        'Submit Registration'
      )}
    </button>
  )
}

// ── Stripe payment section ────────────────────────────────────
interface StripeSectionProps {
  formRef:        React.RefObject<HTMLFormElement>
  paymentIntentId: string
  fieldErrors:    Partial<Record<string, string>>
  onFieldErrors:  (errors: Partial<Record<string, string>>) => void
  onError:        (msg: string) => void
}

function StripePaymentSection({ formRef, paymentIntentId, fieldErrors, onFieldErrors, onError }: StripeSectionProps) {
  const stripe   = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements || !formRef.current) return
    setSubmitting(true)

    const formData = new FormData(formRef.current)
    formData.set('stripe_payment_intent_id', paymentIntentId)

    const result = await createStripeRegistration(formData)

    if (!result.success) {
      if (result.fieldErrors) onFieldErrors(result.fieldErrors)
      if (result.error) onError(result.error)
      setSubmitting(false)
      return
    }

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/register/success?id=${result.registrationId}`,
      },
    })

    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="button"
        disabled={!stripe || !elements || submitting}
        onClick={handlePay}
        className="w-full mt-2 flex items-center justify-center py-3 text-sm font-semibold transition-opacity hover:opacity-80 disabled:opacity-50"
        style={{
          backgroundColor: 'var(--form-accent)',
          color:           'var(--form-accent-text)',
          borderRadius:    'var(--form-btn-radius)',
        }}
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Processing payment...
          </span>
        ) : (
          'Pay & Register'
        )}
      </button>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-error">{message}</p>
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="ml-2 text-xs text-muted hover:text-[#111111] transition-colors shrink-0"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  )
}

// ── Main form ─────────────────────────────────────────────────
interface Props {
  event:          Event
  packages:       Package[]
  globalChurches?: string[]
}

type PaymentMethod = 'manual' | 'card'

const initial: RegisterFormState = {}
const stripePromise = getStripePromise()

export default function RegistrationForm({ event, packages, globalChurches }: Props) {
  const churches = globalChurches && globalChurches.length > 0 ? globalChurches : GMS_CHURCHES
  const [state,          formAction]       = useFormState(submitRegistration, initial)
  const [paymentMethod,  setPaymentMethod] = useState<PaymentMethod>('manual')
  const [openBank,       setOpenBank]      = useState<string | null>(null)
  const [selectedPkg,    setSelectedPkg]   = useState<string>(packages[0]?.id ?? '')
  const [fileName,       setFileName]      = useState<string>('')
  const [clientSecret,   setClientSecret]  = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string>('')
  const [feeBreakdown,   setFeeBreakdown]  = useState<{ net: number; fee: number; total: number } | null>(null)
  const [stripeLoading,  setStripeLoading] = useState(false)
  const [stripeError,    setStripeError]   = useState<string | null>(null)
  const [globalError,    setGlobalError]   = useState<string | null>(state.error ?? null)
  const [fieldErrors,    setFieldErrors]   = useState<Partial<Record<string, string>>>(state.fieldErrors ?? {})
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    setGlobalError(state.error ?? null)
    setFieldErrors(state.fieldErrors ?? {})
  }, [state])

  const fetchPaymentIntent = useCallback(async (packageId: string) => {
    setStripeLoading(true)
    setStripeError(null)
    setClientSecret(null)
    setPaymentIntentId('')

    try {
      const res  = await fetch('/api/stripe/create-payment-intent', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ package_id: packageId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setStripeError(data.error ?? 'Could not initialise payment. Try again.')
        return
      }

      setClientSecret(data.clientSecret)
      setFeeBreakdown({ net: data.netAmount, fee: data.fee, total: data.totalAmount })
      setPaymentIntentId(data.clientSecret.split('_secret_')[0])
    } catch {
      setStripeError('Network error. Please check your connection and try again.')
    } finally {
      setStripeLoading(false)
    }
  }, [])

  useEffect(() => {
    if (paymentMethod === 'card' && selectedPkg) {
      fetchPaymentIntent(selectedPkg)
    }
  }, [paymentMethod, selectedPkg, fetchPaymentIntent])

  // ── Theme derivations ─────────────────────────────────────
  const theme = resolveTheme(event.form_theme)

  // isDark: card style takes priority; otherwise follow background darkness
  const isDark =
    theme.cardStyle === 'dark'  ? true  :
    theme.cardStyle === 'white' ? false :
    themeDark(theme)

  const isAccentDark  = isColorDark(theme.accentColor)
  const accentText    = isAccentDark ? '#ffffff' : '#111111'
  const btnRadius     = theme.buttonShape === 'sharp' ? '0px' : theme.buttonShape === 'pill' ? '9999px' : '8px'
  const fontEntry     = FONT_MAP[theme.fontFamily] ?? FONT_MAP.geist
  const isCard          = theme.cardStyle !== 'transparent'
  const selectedPackage = packages.find((p) => p.id === selectedPkg)

  // Load Google Font
  useEffect(() => {
    if (!fontEntry.url) return
    const id = `form-font-${theme.fontFamily}`
    if (document.getElementById(id)) return
    const link  = document.createElement('link')
    link.id     = id
    link.rel    = 'stylesheet'
    link.href   = fontEntry.url
    document.head.appendChild(link)
  }, [theme.fontFamily, fontEntry.url])

  // Auto text colours (used when the theme doesn't override)
  const autoText  = isDark ? '#ffffff'             : '#111111'
  const autoMuted = isDark ? 'rgba(255,255,255,0.55)' : '#888888'

  // CSS variables — exposed to all descendants including ManualSubmitButton/StripePaymentSection
  const formVars = {
    '--form-accent':      theme.accentColor,
    '--form-accent-text': accentText,
    '--form-btn-radius':  btnRadius,
    '--form-text':        theme.textColor  || autoText,
    '--form-muted':       theme.mutedColor || autoMuted,
    fontFamily:           fontEntry.css,
  } as React.CSSProperties

  // Colour tokens — text uses CSS vars so manual overrides take effect everywhere
  const c = {
    heading:      'text-[var(--form-text)]',
    subtext:      'text-[var(--form-muted)]',
    sectionHead:  'text-[var(--form-text)]',
    label:        'text-[var(--form-text)]',
    headerBorder: isDark ? 'border-white/10'  : 'border-[#E5E5E5]',
    headerBg:     isCard ? '' : isDark
                    ? 'bg-black/20 backdrop-blur-sm'
                    : 'bg-white/80 backdrop-blur-sm',
    errorBg:      isDark ? 'bg-error/20 border-error/40' : 'bg-error/5 border-error/30',
  }

  // Input classes — text/placeholder use CSS vars; borders/bg still follow isDark
  const inputCls = cn(
    'w-full text-sm focus:outline-none transition-colors text-[var(--form-text)] placeholder:text-[var(--form-muted)]',
    theme.inputStyle === 'underline' && [
      'border-0 border-b-2 rounded-none bg-transparent px-0 py-1.5',
      isDark ? 'border-white/30 focus:border-white' : 'border-[#E5E5E5] focus:border-[#111111]',
    ],
    theme.inputStyle === 'filled' && [
      'rounded-btn border border-transparent px-3 py-2',
      isDark ? 'bg-white/10 focus:bg-white/15 focus:border-white/40'
             : 'bg-[#F5F5F5] focus:bg-white focus:border-[#E5E5E5] border border-transparent',
    ],
    theme.inputStyle === 'outlined' && [
      'rounded-btn border px-3 py-2',
      isDark ? 'bg-white/8 border-white/20 focus:border-white/60'
             : 'border-[#E5E5E5] bg-white focus:border-[#111111]',
    ]
  )

  // Card wrapper classes
  const cardCls = cn(
    isCard && 'w-full max-w-xl mx-auto overflow-hidden shadow-2xl',
    theme.cardStyle === 'glass' && 'my-8 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/25',
    theme.cardStyle === 'white' && 'my-8 rounded-2xl bg-white border border-[#E5E5E5]',
    theme.cardStyle === 'dark'  && 'my-8 rounded-2xl bg-[#111111] border border-white/10',
  )

  // Inner boxes (package cards, payment toggles, accordion) use frosted glass
  // whenever the coloured background is visible behind them.
  const boxGlass = !isCard || theme.cardStyle === 'glass'

  const box = {
    base:     boxGlass ? 'bg-white/15 backdrop-blur-md border border-white/20'
                       : isDark ? 'bg-white/8 border border-white/10'
                                : 'bg-white border border-[#E5E5E5]',
    hover:    boxGlass ? 'hover:bg-white/22' : isDark ? 'hover:bg-white/15' : 'hover:border-[#999]',
    active:   boxGlass ? 'bg-white/28 backdrop-blur-md' : isDark ? 'bg-white/15' : 'bg-[#fafafa]',
    divide:   boxGlass ? 'divide-white/15' : isDark ? 'divide-white/10' : 'divide-[#E5E5E5]',
    subtle:   boxGlass ? 'bg-white/10' : isDark ? 'bg-white/5' : 'bg-[#fafafa]',
  }

  // Selected package-card accent border via inline style
  const pkgSelectedStyle = { borderColor: theme.accentColor }

  // ── Render ────────────────────────────────────────────────
  const content = (
    <>
      {/* Page header */}
      <div className={`border-b ${c.headerBorder} ${c.headerBg}`}>
        <div className={cn('px-6 py-10', isCard ? 'max-w-none' : 'mx-auto max-w-xl')}>
          <p className={`text-xs font-medium uppercase tracking-widest ${c.subtext}`}>
            Event Registration
          </p>
          <h1 className={`mt-2 text-2xl font-semibold ${c.heading}`}>{event.name}</h1>
          <p className={`mt-1 text-sm ${c.subtext}`}>
            {formatDate(event.date)}&ensp;&middot;&ensp;{event.location}
          </p>
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => { if (paymentMethod === 'card') e.preventDefault() }}
        className={cn('space-y-10 px-6', isCard ? 'py-6' : 'mx-auto max-w-xl')}
      >
        {/* Global error */}
        {globalError && (
          <div className={`rounded-lg border px-4 py-3 text-sm text-error ${c.errorBg}`}>
            {globalError}
          </div>
        )}

        {/* ── Core fields ── */}
        {(() => {
          const coreFields     = resolveCoreFields(event.core_fields).filter(f => f.enabled)
          const personalFields = coreFields.filter(f => ['full_name', 'email', 'phone'].includes(f.key))
          const churchFields   = coreFields.filter(f => ['gms_church', 'nij'].includes(f.key))

          const placeholders: Record<string, string> = {
            full_name: 'As per ID',
            email:     'you@example.com',
            phone:     '+62 8xx xxxx xxxx',
            nij:       'e.g. 21004592',
          }

          return (
            <>
              {personalFields.length > 0 && (
                <section className="space-y-5">
                  <h2 className={`text-xs font-semibold uppercase tracking-widest ${c.sectionHead}`}>
                    Personal Information
                  </h2>
                  {personalFields.map((field) => {
                    const fe = fieldErrors[field.key]
                    return (
                      <div key={field.key}>
                        <Label htmlFor={field.key} required={field.required} className={c.label}>
                          {field.label}
                          {!field.required && <span className="font-normal text-muted">&ensp;(optional)</span>}
                        </Label>
                        <input
                          id={field.key}
                          name={field.key}
                          type={field.inputType === 'tel' ? 'tel' : field.inputType === 'email' ? 'email' : 'text'}
                          placeholder={placeholders[field.key] ?? ''}
                          className={cn(inputCls, fe && 'border-error')}
                        />
                        <FieldError message={fe} />
                      </div>
                    )
                  })}
                </section>
              )}

              {churchFields.length > 0 && (
                <section className="space-y-5">
                  <h2 className={`text-xs font-semibold uppercase tracking-widest ${c.sectionHead}`}>
                    Church Information
                  </h2>
                  {churchFields.map((field) => {
                    const fe = fieldErrors[field.key]
                    if (field.key === 'gms_church') {
                      return (
                        <div key={field.key}>
                          <Label htmlFor="gms_church" required={field.required} className={c.label}>{field.label}</Label>
                          <select
                            id="gms_church"
                            name="gms_church"
                            defaultValue=""
                            className={cn(inputCls, fe && 'border-error')}
                          >
                            <option value="" disabled>Select your church branch</option>
                            {churches.map((ch) => (
                              <option key={ch} value={ch}>{ch}</option>
                            ))}
                          </select>
                          <FieldError message={fe} />
                        </div>
                      )
                    }
                    return (
                      <div key={field.key}>
                        <Label htmlFor={field.key} required={field.required} className={c.label}>
                          {field.label}
                          {!field.required && <span className="font-normal text-muted">&ensp;(optional)</span>}
                        </Label>
                        <input
                          id={field.key}
                          name={field.key}
                          type="text"
                          placeholder={placeholders[field.key] ?? ''}
                          className={cn(inputCls, fe && 'border-error')}
                        />
                        <FieldError message={fe} />
                      </div>
                    )
                  })}
                </section>
              )}
            </>
          )
        })()}

        {/* ── Custom fields ── */}
        {(event.custom_fields ?? []).length > 0 && (
          <section className="space-y-5">
            <h2 className={`text-xs font-semibold uppercase tracking-widest ${c.sectionHead}`}>
              Additional Information
            </h2>
            {(event.custom_fields as CustomField[]).map((field) => {
              const key = `custom_${field.id}`
              const fe  = (fieldErrors as Record<string, string>)[key]

              if (field.type === 'checkbox') {
                return (
                  <div key={field.id} className="flex items-start gap-3">
                    <input
                      id={key}
                      name={key}
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-[#E5E5E5]"
                      style={{ accentColor: theme.accentColor }}
                    />
                    <label htmlFor={key} className={`text-sm leading-snug ${c.label}`}>
                      {field.label}
                    </label>
                  </div>
                )
              }

              if (field.type === 'textarea') {
                return (
                  <div key={field.id}>
                    <Label htmlFor={key} required={field.required} className={c.label}>{field.label}</Label>
                    <textarea
                      id={key}
                      name={key}
                      rows={3}
                      placeholder={field.placeholder ?? ''}
                      required={field.required}
                      className={cn(inputCls, 'resize-none', fe && 'border-error')}
                    />
                    <FieldError message={fe} />
                  </div>
                )
              }

              if (field.type === 'select') {
                return (
                  <div key={field.id}>
                    <Label htmlFor={key} required={field.required} className={c.label}>{field.label}</Label>
                    <select
                      id={key}
                      name={key}
                      defaultValue=""
                      required={field.required}
                      className={cn(inputCls, fe && 'border-error')}
                    >
                      <option value="" disabled>Select an option</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </select>
                    <FieldError message={fe} />
                  </div>
                )
              }

              return (
                <div key={field.id}>
                  <Label htmlFor={key} required={field.required} className={c.label}>{field.label}</Label>
                  <input
                    id={key}
                    name={key}
                    type="text"
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    className={cn(inputCls, fe && 'border-error')}
                  />
                  <FieldError message={fe} />
                </div>
              )
            })}
          </section>
        )}

        {/* ── Package selection ── */}
        <section className="space-y-4">
          <h2 className={`text-xs font-semibold uppercase tracking-widest ${c.sectionHead}`}>
            Package
          </h2>
          <FieldError message={fieldErrors.package_id} />

          <div className="space-y-3">
            {packages.map((pkg) => {
              const isSelected = selectedPkg === pkg.id
              return (
                <label
                  key={pkg.id}
                  className={cn(
                    'flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition-all',
                    isSelected
                      ? cn(box.active, 'backdrop-blur-md')
                      : cn(box.base, box.hover)
                  )}
                  style={isSelected ? pkgSelectedStyle : undefined}
                >
                  <input
                    type="radio"
                    name="package_id"
                    value={pkg.id}
                    checked={isSelected}
                    onChange={() => setSelectedPkg(pkg.id)}
                    className="sr-only"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className={`font-semibold ${c.heading}`}>{pkg.name}</span>
                      <span className={`shrink-0 font-semibold ${c.heading}`}>
                        {formatJPY(pkg.stripe_price_jpy ?? pkg.price)}
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {pkg.toolkit_items.map((item, i) => (
                        <li key={i} className={`flex items-center gap-2 text-sm ${c.subtext}`}>
                          <span className="size-1 shrink-0 rounded-full bg-current" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Radio indicator */}
                  <div
                    className="mt-0.5 size-4 shrink-0 rounded-full border-2 flex items-center justify-center"
                    style={isSelected
                      ? { borderColor: theme.accentColor }
                      : { borderColor: isDark ? 'rgba(255,255,255,0.3)' : '#D1D1D1' }
                    }
                  >
                    {isSelected && (
                      <div className="size-2 rounded-full" style={{ backgroundColor: theme.accentColor }} />
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </section>

        {/* ── Payment method ── */}
        <section className="space-y-4">
          <h2 className={`text-xs font-semibold uppercase tracking-widest ${c.sectionHead}`}>
            Payment Method
          </h2>

          <div className="grid grid-cols-2 gap-3">
            {(['manual', 'card'] as const).map((m) => {
              const active = paymentMethod === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={cn(
                    'rounded-lg border-2 px-4 py-3 text-left transition-all',
                    active ? cn(box.active, 'backdrop-blur-md') : cn(box.base, box.hover)
                  )}
                  style={active ? { borderColor: theme.accentColor } : undefined}
                >
                  <div className={`text-sm font-semibold ${c.heading}`}>
                    {m === 'manual' ? 'Manual Payment' : 'Pay by Card'}
                  </div>
                  <div className={`mt-0.5 text-xs ${c.subtext}`}>
                    {m === 'manual' ? 'Japan local · Bank / PayPay' : 'International · All currencies'}
                  </div>
                </button>
              )
            })}
          </div>

          {/* ── Manual payment ── */}
          {paymentMethod === 'manual' && (
            <div className="space-y-5">
              <div className={cn('rounded-lg overflow-hidden divide-y', box.base, box.divide)}>
                {BANK_OPTIONS.map((bank) => {
                  const isOpen = openBank === bank.id
                  return (
                    <div key={bank.id}>
                      <button
                        type="button"
                        onClick={() => setOpenBank(isOpen ? null : bank.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                          isOpen ? box.subtle : cn('bg-transparent', box.hover)
                        )}
                      >
                        <span className={`text-xs font-semibold uppercase tracking-widest ${c.subtext}`}>
                          {bank.label}
                        </span>
                        <svg
                          className={cn('size-4 transition-transform duration-200', c.subtext, isOpen && 'rotate-180')}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {isOpen && (
                        <div className={cn(
                          'border-t p-4 space-y-4',
                          boxGlass ? 'border-white/15 bg-white/10' : isDark ? 'border-white/10 bg-white/5' : 'border-[#E5E5E5] bg-[#fafafa]'
                        )}>
                          {bank.note && (
                            <p className={`text-xs leading-relaxed ${c.subtext}`}>{bank.note}</p>
                          )}
                          {bank.sections?.map((section, si) => (
                            <div key={si} className={cn(si > 0 && cn('pt-4 border-t', isDark ? 'border-white/10' : 'border-[#E5E5E5]'))}>
                              {section.title && (
                                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${c.sectionHead}`}>
                                  {section.title}
                                </p>
                              )}
                              <div className="space-y-1.5">
                                {section.rows.map((row, ri) => (
                                  <div key={ri} className="flex items-start justify-between gap-3">
                                    <span className={`text-[11px] shrink-0 min-w-[90px] pt-px ${c.subtext}`}>
                                      {row.label}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className={`text-xs font-medium text-right break-all ${c.heading}`}>
                                        {row.value}
                                      </span>
                                      {row.copyable && <CopyButton text={row.copyValue ?? row.value} />}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                          {bank.hasQR && (
                            <div className={cn('pt-4 border-t flex flex-col items-center gap-3', isDark ? 'border-white/10' : 'border-[#E5E5E5]')}>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={PAYPAY_QR_IMAGE}
                                alt="PayPay QR"
                                className="h-40 w-40 object-contain rounded-md"
                                onError={(e) => {
                                  ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                                  const next = e.currentTarget.nextElementSibling as HTMLElement
                                  if (next) next.style.display = 'flex'
                                }}
                              />
                              <div
                                className={cn(
                                  'h-40 w-40 flex-col items-center justify-center rounded-md border-2 border-dashed text-center',
                                  isDark ? 'border-white/20' : 'border-[#E5E5E5]'
                                )}
                                style={{ display: 'none' }}
                              >
                                <p className={`text-xs ${c.subtext}`}>QR coming soon</p>
                              </div>
                              <a
                                href={PAYPAY_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`text-xs font-medium underline ${c.heading}`}
                              >
                                Open PayPay link
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Screenshot upload */}
              {openBank !== 'cash' && (
                <div className="space-y-2">
                  <div>
                    <p className={`text-sm font-medium ${c.heading}`}>
                      Upload Payment Proof <span className="text-error">*</span>
                    </p>
                    <p className={`mt-0.5 text-xs ${c.subtext}`}>
                      Screenshot of your bank or PayPay transfer &mdash; JPG, PNG, or WebP, max 5 MB.
                    </p>
                  </div>
                  <FieldError message={fieldErrors.payment_screenshot} />
                  <label
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-8 transition-all',
                      fileName
                        ? cn(box.active, 'backdrop-blur-md')
                        : fieldErrors.payment_screenshot
                        ? 'border-error/40 bg-error/5'
                        : cn(boxGlass ? 'border-white/20 bg-white/10' : isDark ? 'border-white/20 bg-white/5' : 'border-[#E5E5E5] bg-transparent',
                             box.hover)
                    )}
                    style={fileName ? { borderColor: theme.accentColor } : undefined}
                  >
                    <input
                      type="file"
                      name="payment_screenshot"
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      onChange={(e) => setFileName(e.target.files?.[0]?.name ?? '')}
                    />
                    {fileName ? (
                      <>
                        <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: theme.accentColor }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className={`max-w-full break-all text-center text-sm font-medium ${c.heading}`}>{fileName}</span>
                        <span className={`text-xs ${c.subtext}`}>Click to change</span>
                      </>
                    ) : (
                      <>
                        <svg className={`size-5 ${c.subtext}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span className={`text-sm font-medium ${c.heading}`}>Click to upload</span>
                        <span className={`text-xs ${c.subtext}`}>JPG &middot; PNG &middot; WebP &middot; max 5 MB</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              <input type="hidden" name="event_id" value={event.id} />
              <ManualSubmitButton />
              <div className="pb-8" />
            </div>
          )}

          {/* ── Card / Stripe ── */}
          {paymentMethod === 'card' && (
            <div className="space-y-4">
              {stripeLoading && (
                <div className={`flex items-center justify-center gap-2 py-8 text-sm ${c.subtext}`}>
                  <Spinner />
                  Setting up payment...
                </div>
              )}

              {stripeError && (
                <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
                  {stripeError}
                  {selectedPackage && !selectedPackage.stripe_price_jpy && (
                    <p className="mt-1 text-xs">
                      Please contact the event organizer to arrange international payment for this package.
                    </p>
                  )}
                </div>
              )}

              {!stripeLoading && !stripeError && clientSecret && (
                <>
                  {feeBreakdown && (
                    <div className={cn('rounded-lg overflow-hidden text-sm', box.base)}>
                      <div className={cn('flex justify-between px-4 py-2.5', box.subtle)}>
                        <span className={c.subtext}>Ticket price</span>
                        <span className={c.heading}>{formatJPY(feeBreakdown.net)}</span>
                      </div>
                      <div className={cn('flex justify-between px-4 py-2.5 border-t', box.subtle,
                        boxGlass ? 'border-white/15' : isDark ? 'border-white/10' : 'border-[#E5E5E5]')}>
                        <span className={c.subtext}>Card processing fee</span>
                        <span className={c.heading}>3.95%</span>
                      </div>
                      <div className={cn('flex justify-between px-4 py-3 border-t',
                        boxGlass ? 'border-white/15' : isDark ? 'border-white/10' : 'border-[#E5E5E5]')}>
                        <span className={`font-semibold ${c.heading}`}>Total charged</span>
                        <span className={`font-semibold ${c.heading}`}>{formatJPY(feeBreakdown.net)} + 3.95%</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <label htmlFor="card_remark" className={`block text-sm font-medium mb-1.5 ${c.label}`}>
                      Payment remark{' '}
                      <span className={`font-normal ${c.subtext}`}>(optional)</span>
                    </label>
                    <input
                      id="card_remark"
                      name="card_remark"
                      type="text"
                      placeholder="e.g. Card belongs to Andrew Tantomo (my husband)"
                      className={inputCls}
                    />
                    <p className={`mt-1 text-xs ${c.subtext}`}>
                      Use this if the card holder&apos;s name differs from the registrant&apos;s name.
                    </p>
                  </div>

                  <Elements
                    stripe={stripePromise}
                    options={{ clientSecret, appearance: STRIPE_APPEARANCE, fonts: STRIPE_FONTS }}
                  >
                    <StripePaymentSection
                      formRef={formRef}
                      paymentIntentId={paymentIntentId}
                      fieldErrors={fieldErrors}
                      onFieldErrors={(errs) => {
                        setFieldErrors(errs)
                        formRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      onError={(msg) => setGlobalError(msg)}
                    />
                  </Elements>

                  <p className={`text-center text-xs ${c.subtext}`}>
                    Your card details are processed securely by Stripe. We never store card information.
                  </p>
                </>
              )}

              <input type="hidden" name="event_id" value={event.id} />
            </div>
          )}
        </section>
        <div className="pb-8" />
      </form>
    </>
  )

  return (
    <FormBackground theme={theme}>
      <div style={formVars} className={isCard ? 'min-h-screen px-4 py-0' : 'contents'}>
        {isCard ? (
          <div className={cardCls}>{content}</div>
        ) : (
          content
        )}
      </div>
    </FormBackground>
  )
}

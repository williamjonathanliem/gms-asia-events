'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { submitRegistration, createStripeRegistration, type RegisterFormState } from './actions'
import { type Event, type Package, type CustomField, resolveCoreFields } from '@/lib/types/database'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatJPY, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { getStripePromise } from '@/lib/stripe-client'

// ── Bank / payment accordion data ────────────────────────────
const PAYPAY_QR_IMAGE = '/paypay-qr.png'
const PAYPAY_LINK = 'https://qr.paypay.ne.jp/p2p01_zCcb7GDpzP9swuRY'

type BankRow = { label: string; value: string; copyValue?: string; copyable?: boolean }
type BankSection = { title?: string; rows: BankRow[] }
type BankOption = {
  id: string
  label: string
  sections?: BankSection[]
  note?: string
  hasQR?: boolean
}

const BANK_OPTIONS: BankOption[] = [
  {
    id: 'jppost',
    label: 'JP Post Bank',
    sections: [
      {
        title: 'JP Post Transfer',
        rows: [
          { label: 'Account Name', value: 'Andrew Getty Tantomo' },
          { label: 'Code No.', value: '10950', copyable: true },
          { label: 'Account No.', value: '17568871', copyable: true },
        ],
      },
      {
        title: 'Other Bank Transfer',
        rows: [
          { label: 'Account Name', value: 'Andrew Getty Tantomo' },
          { label: 'Branch Code', value: '098', copyable: true },
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
          { label: 'Bank Name', value: '楽天銀行 (Rakuten Bank)' },
          { label: 'Branch No.', value: '254', copyable: true },
          { label: 'Branch Name', value: '第四営業支店 (Daiyon Eigyou Shiten)' },
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
          { label: 'Name', value: 'VERICO CHRISTIAN JONATHAN' },
        ],
      },
    ],
    hasQR: true,
  },
]

// ── Stripe appearance matching the design system ──────────────
// Note: Stripe runs in an iframe — CSS vars don't work, load font via `fonts` prop on Elements
const STRIPE_APPEARANCE = {
  theme: 'stripe' as const,
  variables: {
    colorPrimary: '#111111',
    colorBackground: '#ffffff',
    colorText: '#111111',
    colorDanger: '#DC2626',
    fontFamily: '"Geist", system-ui, -apple-system, sans-serif',
    borderRadius: '6px',
    fontSizeBase: '14px',
  },
  rules: {
    '.Input': {
      border: '1px solid #E5E5E5',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '1px solid #111111',
      boxShadow: 'none',
    },
    '.Label': {
      fontWeight: '500',
      color: '#111111',
      marginBottom: '6px',
    },
  },
}

// Load Geist into Stripe's iframe
const STRIPE_FONTS = [
  {
    cssSrc:
      'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&display=swap',
  },
]

// ── Manual submit button (uses useFormStatus) ─────────────────
function ManualSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="lg" disabled={pending} className="w-full mt-2">
      {pending ? (
        <span className="flex items-center gap-2">
          <Spinner />
          Submitting…
        </span>
      ) : (
        'Submit Registration'
      )}
    </Button>
  )
}

// ── Stripe payment section (must live inside <Elements>) ───────
interface StripeSectionProps {
  formRef: React.RefObject<HTMLFormElement>
  paymentIntentId: string
  fieldErrors: Partial<Record<string, string>>
  onFieldErrors: (errors: Partial<Record<string, string>>) => void
  onError: (msg: string) => void
}

function StripePaymentSection({
  formRef,
  paymentIntentId,
  fieldErrors,
  onFieldErrors,
  onError,
}: StripeSectionProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [submitting, setSubmitting] = useState(false)

  const handlePay = async () => {
    if (!stripe || !elements || !formRef.current) return
    setSubmitting(true)

    // Collect form data from the parent form element
    const formData = new FormData(formRef.current)
    formData.set('stripe_payment_intent_id', paymentIntentId)

    // 1. Create the pending registration in DB
    const result = await createStripeRegistration(formData)

    if (!result.success) {
      if (result.fieldErrors) onFieldErrors(result.fieldErrors)
      if (result.error) onError(result.error)
      setSubmitting(false)
      return
    }

    // 2. Confirm the Stripe payment — Stripe redirects to return_url on success
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/register/success?id=${result.registrationId}`,
      },
    })

    // If we get here, confirmPayment failed (otherwise we'd have been redirected)
    if (error) {
      onError(error.message ?? 'Payment failed. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <PaymentElement
        options={{
          layout: 'tabs',
        }}
      />
      <Button
        type="button"
        size="lg"
        className="w-full mt-2"
        disabled={!stripe || !elements || submitting}
        onClick={handlePay}
      >
        {submitting ? (
          <span className="flex items-center gap-2">
            <Spinner />
            Processing payment…
          </span>
        ) : (
          'Pay & Register'
        )}
      </Button>
    </div>
  )
}

// ── Spinner helper ─────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  )
}

// ── Field error helper ─────────────────────────────────────────
function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="mt-1.5 text-xs text-error">{message}</p>
}

// ── Copy-to-clipboard button ───────────────────────────────────
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
  event: Event
  packages: Package[]
  globalChurches?: string[]
}

type PaymentMethod = 'manual' | 'card'

const initial: RegisterFormState = {}
const stripePromise = getStripePromise()

export default function RegistrationForm({ event, packages, globalChurches }: Props) {
  const churches = globalChurches && globalChurches.length > 0 ? globalChurches : GMS_CHURCHES
  const [state, formAction] = useFormState(submitRegistration, initial)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('manual')
  const [openBank, setOpenBank] = useState<string | null>(null)
  const [selectedPkg, setSelectedPkg] = useState<string>(packages[0]?.id ?? '')
  const [fileName, setFileName] = useState<string>('')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [paymentIntentId, setPaymentIntentId] = useState<string>('')
  const [feeBreakdown, setFeeBreakdown] = useState<{ net: number; fee: number; total: number } | null>(null)
  const [stripeLoading, setStripeLoading] = useState(false)
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [globalError, setGlobalError] = useState<string | null>(state.error ?? null)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>(
    state.fieldErrors ?? {}
  )
  const formRef = useRef<HTMLFormElement>(null)

  // Sync server action errors back into state (manual flow)
  useEffect(() => {
    setGlobalError(state.error ?? null)
    setFieldErrors(state.fieldErrors ?? {})
  }, [state])

  // Create / refresh PaymentIntent whenever card is selected + package changes
  const fetchPaymentIntent = useCallback(async (packageId: string) => {
    setStripeLoading(true)
    setStripeError(null)
    setClientSecret(null)
    setPaymentIntentId('')

    try {
      const res = await fetch('/api/stripe/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_id: packageId }),
      })
      const data = await res.json()

      if (!res.ok) {
        setStripeError(data.error ?? 'Could not initialise payment. Try again.')
        return
      }

      setClientSecret(data.clientSecret)
      setFeeBreakdown({ net: data.netAmount, fee: data.fee, total: data.totalAmount })
      // Extract PaymentIntent ID from the client secret (format: pi_xxx_secret_yyy)
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

  const selectedPackage = packages.find((p) => p.id === selectedPkg)

  return (
    <div className="min-h-screen bg-white">
      {/* ── Page header ── */}
      <div className="border-b border-[#E5E5E5]">
        <div className="mx-auto max-w-xl px-6 py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-muted">
            Event Registration
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-[#111111]">{event.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatDate(event.date)}&ensp;·&ensp;{event.location}
          </p>
        </div>
      </div>

      <form
        ref={formRef}
        action={formAction}
        onSubmit={(e) => {
          // Intercept form submit for card flow — manual uses server action normally
          if (paymentMethod === 'card') e.preventDefault()
        }}
        className="mx-auto max-w-xl space-y-10 px-6"
      >
        {/* Global error */}
        {globalError && (
          <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
            {globalError}
          </div>
        )}

        {/* ── Section: Personal Information ── */}
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
            Personal Information
          </h2>

          <div>
            <Label htmlFor="full_name" required>Full Name</Label>
            <Input
              id="full_name"
              name="full_name"
              placeholder="As per ID"
              className={fieldErrors.full_name ? 'border-error' : ''}
            />
            <FieldError message={fieldErrors.full_name} />
          </div>

          <div>
            <Label htmlFor="email" required>Email Address</Label>
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@example.com"
              className={fieldErrors.email ? 'border-error' : ''}
            />
            <FieldError message={fieldErrors.email} />
          </div>

          <div>
            <Label htmlFor="phone">
              Phone Number&ensp;
              <span className="font-normal text-muted">(optional)</span>
            </Label>
            <Input id="phone" name="phone" type="tel" placeholder="+62 8xx xxxx xxxx" />
          </div>
        </section>

        {/* ── Section: Church Information ── */}
        <section className="space-y-5">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
            Church Information
          </h2>

          <div>
            <Label htmlFor="gms_church" required>GMS Church Branch</Label>
            <Select
              id="gms_church"
              name="gms_church"
              defaultValue=""
              className={fieldErrors.gms_church ? 'border-error' : ''}
            >
              <option value="" disabled>Select your church branch</option>
              {churches.map((church) => (
                <option key={church} value={church}>
                  {church}
                </option>
              ))}
            </Select>
            <FieldError message={fieldErrors.gms_church} />
          </div>

          <div>
            <Label htmlFor="nij">
              NIJ / Disciple ID&ensp;
              <span className="font-normal text-muted">(optional)</span>
            </Label>
            <Input id="nij" name="nij" placeholder="e.g. 21004592" />
          </div>
        </section>

        {/* ── Section: Custom Fields ── */}
        {(event.custom_fields ?? []).length > 0 && (
          <section className="space-y-5">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
              Additional Information
            </h2>
            {(event.custom_fields as CustomField[]).map((field) => {
              const key = `custom_${field.id}`
              const fe = (fieldErrors as Record<string, string>)[key]
              if (field.type === 'checkbox') {
                return (
                  <div key={field.id} className="flex items-start gap-3">
                    <input
                      id={key}
                      name={key}
                      type="checkbox"
                      className="mt-0.5 size-4 rounded border-[#E5E5E5] accent-[#111111]"
                    />
                    <label htmlFor={key} className="text-sm text-[#111111] leading-snug">
                      {field.label}
                    </label>
                  </div>
                )
              }
              if (field.type === 'textarea') {
                return (
                  <div key={field.id}>
                    <Label htmlFor={key} required={field.required}>{field.label}</Label>
                    <textarea
                      id={key}
                      name={key}
                      rows={3}
                      placeholder={field.placeholder ?? ''}
                      required={field.required}
                      className={cn(
                        'w-full rounded-btn border px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:border-[#111111] focus:outline-none resize-none',
                        fe ? 'border-error' : 'border-[#E5E5E5]'
                      )}
                    />
                    <FieldError message={fe} />
                  </div>
                )
              }
              if (field.type === 'select') {
                return (
                  <div key={field.id}>
                    <Label htmlFor={key} required={field.required}>{field.label}</Label>
                    <Select id={key} name={key} defaultValue="" required={field.required} className={fe ? 'border-error' : ''}>
                      <option value="" disabled>Select an option</option>
                      {(field.options ?? []).map((opt) => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                    </Select>
                    <FieldError message={fe} />
                  </div>
                )
              }
              // default: text
              return (
                <div key={field.id}>
                  <Label htmlFor={key} required={field.required}>{field.label}</Label>
                  <Input
                    id={key}
                    name={key}
                    type="text"
                    placeholder={field.placeholder ?? ''}
                    required={field.required}
                    className={fe ? 'border-error' : ''}
                  />
                  <FieldError message={fe} />
                </div>
              )
            })}
          </section>
        )}

        {/* ── Section: Package Selection ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
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
                    'flex cursor-pointer gap-4 rounded-lg border-2 p-4 transition-colors',
                    isSelected
                      ? 'border-[#111111] bg-[#fafafa]'
                      : 'border-[#E5E5E5] hover:border-[#999999]'
                  )}
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
                      <span className="font-semibold text-[#111111]">Package {pkg.name}</span>
                      <span className="shrink-0 font-semibold text-[#111111]">
                        {formatJPY(pkg.stripe_price_jpy ?? pkg.price)}
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {pkg.toolkit_items.map((item, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-muted">
                          <span className="size-1 shrink-0 rounded-full bg-muted" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Radio indicator */}
                  <div
                    className={cn(
                      'mt-0.5 size-4 shrink-0 rounded-full border-2 flex items-center justify-center',
                      isSelected ? 'border-[#111111]' : 'border-[#D1D1D1]'
                    )}
                  >
                    {isSelected && <div className="size-2 rounded-full bg-[#111111]" />}
                  </div>
                </label>
              )
            })}
          </div>
        </section>

        {/* ── Section: Payment Method ── */}
        <section className="space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
            Payment Method
          </h2>

          {/* Toggle */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPaymentMethod('manual')}
              className={cn(
                'rounded-lg border-2 px-4 py-3 text-left transition-colors',
                paymentMethod === 'manual'
                  ? 'border-[#111111] bg-[#fafafa]'
                  : 'border-[#E5E5E5] hover:border-[#999999]'
              )}
            >
              <div className="text-sm font-semibold text-[#111111]">Manual Payment</div>
              <div className="mt-0.5 text-xs text-muted">Japan local · Bank / PayPay</div>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('card')}
              className={cn(
                'rounded-lg border-2 px-4 py-3 text-left transition-colors',
                paymentMethod === 'card'
                  ? 'border-[#111111] bg-[#fafafa]'
                  : 'border-[#E5E5E5] hover:border-[#999999]'
              )}
            >
              <div className="text-sm font-semibold text-[#111111]">Pay by Card</div>
              <div className="mt-0.5 text-xs text-muted">International · All currencies</div>
            </button>
          </div>

          {/* ── Manual Payment Details ── */}
          {paymentMethod === 'manual' && (
            <div className="space-y-5">
              {/* Bank accordion */}
              <div className="rounded-lg border border-[#E5E5E5] overflow-hidden divide-y divide-[#E5E5E5]">
                {BANK_OPTIONS.map((bank) => {
                  const isOpen = openBank === bank.id
                  return (
                    <div key={bank.id}>
                      {/* Accordion header */}
                      <button
                        type="button"
                        onClick={() => setOpenBank(isOpen ? null : bank.id)}
                        className={cn(
                          'w-full flex items-center justify-between px-4 py-3 text-left transition-colors',
                          isOpen ? 'bg-[#fafafa]' : 'bg-white hover:bg-[#fafafa]'
                        )}
                      >
                        <span className="text-xs font-semibold uppercase tracking-widest text-muted">
                          {bank.label}
                        </span>
                        <svg
                          className={cn('size-4 text-muted transition-transform duration-200', isOpen && 'rotate-180')}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>

                      {/* Accordion body */}
                      {isOpen && (
                        <div className="border-t border-[#E5E5E5] bg-[#fafafa] p-4 space-y-4">
                          {/* Note (e.g. Cash) */}
                          {bank.note && (
                            <p className="text-xs text-muted leading-relaxed">{bank.note}</p>
                          )}

                          {/* Detail sections */}
                          {bank.sections?.map((section, si) => (
                            <div key={si} className={cn(si > 0 && 'pt-4 border-t border-[#E5E5E5]')}>
                              {section.title && (
                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#111111] mb-2">
                                  {section.title}
                                </p>
                              )}
                              <div className="space-y-1.5">
                                {section.rows.map((row, ri) => (
                                  <div key={ri} className="flex items-start justify-between gap-3">
                                    <span className="text-[11px] text-muted shrink-0 min-w-[90px] pt-px">
                                      {row.label}
                                    </span>
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="text-xs font-medium text-[#111111] text-right break-all">
                                        {row.value}
                                      </span>
                                      {row.copyable && (
                                        <CopyButton text={row.copyValue ?? row.value} />
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}

                          {/* PayPay QR */}
                          {bank.hasQR && (
                            <div className="pt-4 border-t border-[#E5E5E5] flex flex-col items-center gap-3">
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
                                className="h-40 w-40 flex-col items-center justify-center rounded-md border-2 border-dashed border-[#E5E5E5] text-center"
                                style={{ display: 'none' }}
                              >
                                <p className="text-xs text-muted">QR coming soon</p>
                              </div>
                              <a
                                href={PAYPAY_LINK}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-[#111111] underline"
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

              {/* Screenshot upload — hidden for cash */}
              {openBank !== 'cash' && (
                <div className="space-y-2">
                  <div>
                    <p className="text-sm font-medium text-[#111111]">
                      Upload Payment Proof <span className="text-error">*</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Screenshot of your bank or PayPay transfer — JPG, PNG, or WebP, max 5 MB.
                    </p>
                  </div>
                  <FieldError message={fieldErrors.payment_screenshot} />
                  <label
                    className={cn(
                      'flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-lg border-2 border-dashed px-6 py-8 transition-colors',
                      fileName
                        ? 'border-[#111111] bg-[#fafafa]'
                        : fieldErrors.payment_screenshot
                        ? 'border-error/40 bg-error/5'
                        : 'border-[#E5E5E5] hover:border-[#999999]'
                    )}
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
                        <svg className="size-5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        <span className="max-w-full break-all text-center text-sm font-medium text-[#111111]">{fileName}</span>
                        <span className="text-xs text-muted">Click to change</span>
                      </>
                    ) : (
                      <>
                        <svg className="size-5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                        <span className="text-sm font-medium text-[#111111]">Click to upload</span>
                        <span className="text-xs text-muted">JPG · PNG · WebP · max 5 MB</span>
                      </>
                    )}
                  </label>
                </div>
              )}

              {/* Hidden inputs */}
              <input type="hidden" name="event_id" value={event.id} />

              <ManualSubmitButton />
            </div>
          )}

          {/* ── Card / Stripe Payment ── */}
          {paymentMethod === 'card' && (
            <div className="space-y-4">
              {stripeLoading && (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted">
                  <Spinner />
                  Setting up payment…
                </div>
              )}

              {stripeError && (
                <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-sm text-error">
                  {stripeError}
                  {selectedPackage && !selectedPackage.stripe_price_jpy && (
                    <p className="mt-1 text-xs">
                      Please contact the event organizer to arrange international payment for this
                      package.
                    </p>
                  )}
                </div>
              )}

              {!stripeLoading && !stripeError && clientSecret && (
                <>
                  {/* JPY price callout */}
                  {feeBreakdown && (
                    <div className="rounded-lg border border-[#E5E5E5] overflow-hidden text-sm">
                      <div className="flex justify-between px-4 py-2.5 bg-[#fafafa]">
                        <span className="text-muted">Ticket price</span>
                        <span className="text-[#111111]">{formatJPY(feeBreakdown.net)}</span>
                      </div>
                      <div className="flex justify-between px-4 py-2.5 border-t border-[#E5E5E5] bg-[#fafafa]">
                        <span className="text-muted">Card processing fee</span>
                        <span className="text-[#111111]">3.95%</span>
                      </div>
                      <div className="flex justify-between px-4 py-3 border-t border-[#E5E5E5]">
                        <span className="font-semibold text-[#111111]">Total charged</span>
                        <span className="font-semibold text-[#111111]">{formatJPY(feeBreakdown.net)} + 3.95%</span>
                      </div>
                    </div>
                  )}

                  {/* Payment remark */}
                  <div>
                    <label htmlFor="card_remark" className="block text-sm font-medium text-[#111111] mb-1.5">
                      Payment remark{' '}
                      <span className="font-normal text-muted">(optional)</span>
                    </label>
                    <input
                      id="card_remark"
                      name="card_remark"
                      type="text"
                      placeholder="e.g. Card belongs to Andrew Tantomo (my husband)"
                      className="w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:border-[#111111] focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-muted">
                      Use this if the card holder&apos;s name differs from the registrant&apos;s name.
                    </p>
                  </div>

                  {/* Stripe Elements */}
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
                        // Scroll to top of form to show errors
                        formRef.current?.scrollIntoView({ behavior: 'smooth' })
                      }}
                      onError={(msg) => setGlobalError(msg)}
                    />
                  </Elements>

                  <p className="text-center text-xs text-muted">
                    Your card details are processed securely by Stripe. We never store card
                    information.
                  </p>
                </>
              )}

              {/* Hidden event_id for stripe path too (used by createStripeRegistration) */}
              <input type="hidden" name="event_id" value={event.id} />
            </div>
          )}
        </section>
      </form>
    </div>
  )
}

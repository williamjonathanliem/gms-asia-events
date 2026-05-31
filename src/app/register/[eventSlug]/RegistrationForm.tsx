'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { submitRegistration, createStripeRegistration, type RegisterFormState } from './actions'
import { type Event, type Package } from '@/lib/types/database'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatJPY, formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { getStripePromise } from '@/lib/stripe-client'

// ── PayPay / Bank transfer details ────────────────────────────
// Upload the PayPay QR image to /public/paypay-qr.png when ready
const PAYPAY_QR_IMAGE = '/paypay-qr.png' // set to null if not yet uploaded
const PAYPAY_LINK = 'https://qr.paypay.ne.jp/p2p01_zCcb7GDpzP9swuRY'
const BANK_DETAILS = [
  { bank: 'Yuucho Bank', account: '10950 - 17568871', name: 'ANDREW GETTY TANTOMO' },
  { bank: 'Rakuten Bank', account: '12345 - 12345678', name: 'GMS TOKYO' },
  { bank: 'PayPay', account: '070-9194-7415', name: 'VERICO CHRISTIAN JONATHAN' },
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
              {/* Bank details */}
              <div className="rounded-lg border border-[#E5E5E5] divide-y divide-[#E5E5E5] overflow-hidden">
                {BANK_DETAILS.map((detail) => (
                  <div key={detail.bank} className="px-4 py-3">
                    <p className="text-xs font-medium text-muted uppercase tracking-wide">
                      {detail.bank}
                    </p>
                    <div className="mt-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#111111]">{detail.account}</p>
                      <CopyButton text={detail.account} />
                    </div>
                    <p className="text-xs text-muted">{detail.name}</p>
                  </div>
                ))}
              </div>

              {/* PayPay QR */}
              <div className="rounded-lg border border-[#E5E5E5] p-4 space-y-3">
                <p className="text-xs font-medium text-muted uppercase tracking-wide">
                  PayPay QR Code
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={PAYPAY_QR_IMAGE}
                  alt="PayPay QR Code"
                  className="mx-auto h-48 w-48 object-contain rounded-md"
                  onError={(e) => {
                    // If QR image not yet uploaded, show a placeholder
                    ;(e.currentTarget as HTMLImageElement).style.display = 'none'
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement
                    if (placeholder) placeholder.style.display = 'flex'
                  }}
                />
                {/* Fallback placeholder (hidden by default) */}
                <div
                  className="hidden mx-auto h-48 w-48 flex-col items-center justify-center rounded-md border-2 border-dashed border-[#E5E5E5] text-center"
                  style={{ display: 'none' }}
                >
                  <svg
                    className="size-8 text-muted"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75V16.5zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z"
                    />
                  </svg>
                  <p className="mt-2 text-xs text-muted">QR image coming soon</p>
                  <a
                    href={PAYPAY_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 text-xs font-medium text-[#111111] underline"
                  >
                    Open PayPay link
                  </a>
                </div>

                <p className="text-center text-xs text-muted">
                  Or pay via link:{' '}
                  <a
                    href={PAYPAY_LINK}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-[#111111] underline"
                  >
                    PayPay
                  </a>
                </p>
              </div>

              {/* Screenshot upload */}
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
                      <svg
                        className="size-5 text-[#111111]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M4.5 12.75l6 6 9-13.5"
                        />
                      </svg>
                      <span className="max-w-full break-all text-center text-sm font-medium text-[#111111]">
                        {fileName}
                      </span>
                      <span className="text-xs text-muted">Click to change</span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="size-5 text-muted"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={1.5}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                        />
                      </svg>
                      <span className="text-sm font-medium text-[#111111]">Click to upload</span>
                      <span className="text-xs text-muted">JPG · PNG · WebP · max 5 MB</span>
                    </>
                  )}
                </label>
              </div>

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

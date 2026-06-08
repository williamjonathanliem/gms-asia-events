import { createServiceClient } from '@/lib/supabase/server'
import StripeProofUpload from './StripeProofUpload'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Registration Received' }

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  let name:          string | null = null
  let email:         string | null = null
  let paymentMethod: string | null = null

  if (searchParams.id) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('registrations')
      .select('full_name, email, payment_method')
      .eq('id', searchParams.id)
      .single()

    name          = data?.full_name     ?? null
    email         = data?.email         ?? null
    paymentMethod = data?.payment_method ?? null
  }

  const isStripe = paymentMethod === 'stripe'

  return (
    <main className="flex min-h-screen items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Icon */}
        <div className="mx-auto flex size-16 items-center justify-center rounded-full border-2 border-success">
          <svg
            className="size-7 text-success"
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
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-[#111111]">
            {isStripe ? 'Payment Received!' : 'Registration Received'}
          </h1>
          {name ? (
            <p className="text-sm text-muted">
              Thank you,{' '}
              <span className="font-medium text-[#111111]">{name}</span>.{' '}
              {isStripe
                ? 'Your card payment is being confirmed automatically.'
                : 'We will review your payment and confirm your registration shortly.'}
            </p>
          ) : (
            <p className="text-sm text-muted">
              {isStripe
                ? 'Your card payment is being confirmed automatically.'
                : 'We will review your payment and confirm your registration shortly.'}
            </p>
          )}
        </div>

        {/* Info card */}
        <div className="rounded-lg border border-[#E5E5E5] px-5 py-4 text-left space-y-3">
          {email && (
            <p className="text-sm text-muted">
              {isStripe ? (
                <>
                  Your QR code will be sent automatically to{' '}
                  <span className="font-medium text-[#111111]">{email}</span>{' '}
                  once your payment is confirmed.
                </>
              ) : (
                <>
                  A confirmation email has been sent to{' '}
                  <span className="font-medium text-[#111111]">{email}</span>.
                </>
              )}
            </p>
          )}
          {!isStripe && (
            <div className="text-sm text-muted space-y-2">
              <p>Your QR code will be emailed once our team verifies your payment.</p>
              <p>If you have any questions, contact your regional PICs.</p>
              <p>Please check your <strong>spam folder</strong> if you do not see the email within that time frame.</p>
            </div>
          )}
        </div>

        {/* Stripe proof upload */}
        {isStripe && searchParams.id && (
          <StripeProofUpload registrationId={searchParams.id} />
        )}
      </div>
    </main>
  )
}

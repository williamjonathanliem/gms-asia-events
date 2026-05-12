import { createServiceClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Registration Received' }

export default async function SuccessPage({
  searchParams,
}: {
  searchParams: { id?: string }
}) {
  let name: string | null = null
  let email: string | null = null

  if (searchParams.id) {
    const supabase = createServiceClient()
    const { data } = await supabase
      .from('registrations')
      .select('full_name, email')
      .eq('id', searchParams.id)
      .single()

    name = data?.full_name ?? null
    email = data?.email ?? null
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
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
          <h1 className="text-xl font-semibold text-[#111111]">Registration Received</h1>
          {name ? (
            <p className="text-sm text-muted">
              Thank you,{' '}
              <span className="font-medium text-[#111111]">{name}</span>. We will
              review your payment and confirm your registration shortly.
            </p>
          ) : (
            <p className="text-sm text-muted">
              We will review your payment and confirm your registration shortly.
            </p>
          )}
        </div>

        {/* Info card */}
        <div className="rounded-lg border border-[#E5E5E5] px-5 py-4 text-left space-y-3">
          {email && (
            <p className="text-sm text-muted">
              A confirmation email with your QR code has been sent to{' '}
              <span className="font-medium text-[#111111]">{email}</span>.
            </p>
          )}
          <p className="text-sm text-muted">
            Your QR code will be activated once payment is verified by our team.
            You will receive a second email when this is done.
          </p>
        </div>
      </div>
    </main>
  )
}

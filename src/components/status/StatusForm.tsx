'use client'

import { useState, useTransition } from 'react'
import { checkRegistrationStatus, type StatusResult } from '@/app/status/actions'
import { formatDate } from '@/lib/utils'

export default function StatusForm() {
  const [email,   setEmail]   = useState('')
  const [result,  setResult]  = useState<StatusResult | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCheck() {
    if (!email.trim()) return
    startTransition(async () => {
      const res = await checkRegistrationStatus(email)
      setResult(res)
    })
  }

  return (
    <div className="mx-auto max-w-md w-full space-y-6">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleCheck() }}
          placeholder="Enter your registration email…"
          className="flex-1 rounded-btn border border-[#E5E5E5] px-4 py-2.5 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent"
        />
        <button
          onClick={handleCheck}
          disabled={pending || !email.trim()}
          className="shrink-0 rounded-btn bg-[#111111] px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {pending ? (
            <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
            </svg>
          ) : 'Check'}
        </button>
      </div>

      {/* Result */}
      {result !== null && (
        <>
          {!result.found ? (
            <div className="rounded-lg border border-[#E5E5E5] px-5 py-8 text-center">
              <p className="text-sm font-medium text-[#111111]">No registration found</p>
              <p className="mt-1 text-xs text-muted">
                No record matches <strong>{email}</strong>. Check the email address and try again.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-[#E5E5E5] overflow-hidden">
              {/* Status banner */}
              <div className={`px-6 py-4 ${
                result.payment_status === 'verified'  ? 'bg-success/10 border-b border-success/20' :
                result.payment_status === 'rejected'  ? 'bg-error/10 border-b border-error/20' :
                                                        'bg-[#fafafa] border-b border-[#E5E5E5]'
              }`}>
                <p className={`text-xs font-semibold uppercase tracking-widest ${
                  result.payment_status === 'verified' ? 'text-success' :
                  result.payment_status === 'rejected' ? 'text-error'   : 'text-warning'
                }`}>
                  {result.payment_status === 'verified' ? 'Payment Verified ✓' :
                   result.payment_status === 'rejected' ? 'Payment Rejected' :
                   'Pending Review'}
                </p>
                <p className="mt-1 text-lg font-semibold text-[#111111]">{result.full_name}</p>
              </div>

              {/* Details */}
              <div className="px-6 py-5 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Event</span>
                  <span className="font-medium text-[#111111] text-right max-w-[60%]">{result.event_name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Date</span>
                  <span className="text-[#111111]">{result.event_date ? formatDate(result.event_date) : '—'}</span>
                </div>
                {result.package_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted">Package</span>
                    <span className="text-[#111111]">{result.package_name}</span>
                  </div>
                )}

                {/* Rejection reason */}
                {result.payment_status === 'rejected' && result.payment_notes && (
                  <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-xs text-error mt-2">
                    <p className="font-semibold">Reason:</p>
                    <p className="mt-0.5">{result.payment_notes}</p>
                    <p className="mt-2 text-error/70">Please contact the organiser to resolve this.</p>
                  </div>
                )}

                {/* Pending message */}
                {result.payment_status === 'pending' && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-xs text-warning mt-2">
                    Your payment is being reviewed. You&apos;ll receive an email once it&apos;s verified.
                  </div>
                )}

                {/* QR Code */}
                {result.payment_status === 'verified' && result.qr_data_url && (
                  <div className="mt-4 flex flex-col items-center gap-3 rounded-xl border border-[#E5E5E5] bg-[#fafafa] p-6">
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your QR Code</p>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={result.qr_data_url}
                      alt="Registration QR Code"
                      className="size-52 rounded-lg"
                    />
                    <p className="text-xs text-muted text-center">
                      Present this at the event entrance. A copy was also sent to your email.
                    </p>
                    <a
                      href={result.qr_data_url}
                      download="gms-qr-code.png"
                      className="rounded-btn border border-[#E5E5E5] px-4 py-2 text-xs font-medium text-[#111111] hover:bg-white transition-colors"
                    >
                      Download QR
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

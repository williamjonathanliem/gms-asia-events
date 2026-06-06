'use client'

import { useState, useTransition } from 'react'
import { checkRegistrationStatus, type StatusResult, type RegistrationEntry } from '@/app/status/actions'
import { PackagePrice } from '@/components/registration/PackagePrice'
import { formatDateRange } from '@/lib/utils'

// ── Single registration card ──────────────────────────────────

function RegistrationCard({ reg }: { reg: RegistrationEntry }) {
  const statusColor =
    reg.payment_status === 'verified' ? 'text-success' :
    reg.payment_status === 'rejected' ? 'text-error'   : 'text-warning'

  const statusBannerBg =
    reg.payment_status === 'verified' ? 'bg-success/10 border-b border-success/20' :
    reg.payment_status === 'rejected' ? 'bg-error/10 border-b border-error/20'     :
                                        'bg-[#fafafa] border-b border-[#E5E5E5]'

  const statusLabel =
    reg.payment_status === 'verified' ? 'Payment Verified ✓' :
    reg.payment_status === 'rejected' ? 'Payment Rejected'   : 'Pending Review'

  return (
    <div className="rounded-2xl border border-[#E5E5E5] overflow-hidden">
      {/* Status banner */}
      <div className={`px-5 py-3 ${statusBannerBg}`}>
        <p className={`text-xs font-semibold uppercase tracking-widest ${statusColor}`}>
          {statusLabel}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-[#111111]">{reg.event_name}</p>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-2.5">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Date</span>
          <span className="text-[#111111]">
            {reg.event_date ? formatDateRange(reg.event_date, reg.event_end_date) : '—'}
          </span>
        </div>

        {reg.package_name && (
          <div className="flex justify-between items-start gap-4 text-sm">
            <span className="text-muted shrink-0">Package</span>
            <div className="text-right">
              <p className="text-[#111111]">{reg.package_name}</p>
              {reg.amount_paid != null && (
                <div className="mt-0.5">
                  <PackagePrice amount={reg.amount_paid} currency={reg.currency} size="sm" />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Rejection reason */}
        {reg.payment_status === 'rejected' && reg.payment_notes && (
          <div className="rounded-lg border border-error/20 bg-error/5 px-4 py-3 text-xs text-error mt-1">
            <p className="font-semibold">Reason:</p>
            <p className="mt-0.5">{reg.payment_notes}</p>
            <p className="mt-2 text-error/70">Please contact the organiser to resolve this.</p>
          </div>
        )}

        {/* Pending message */}
        {reg.payment_status === 'pending' && (
          <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3 text-xs text-warning mt-1">
            Your payment is being reviewed. You&apos;ll receive an email once it&apos;s verified.
          </div>
        )}

        {/* QR Code */}
        {reg.payment_status === 'verified' && reg.qr_data_url && (
          <div className="mt-3 flex flex-col items-center gap-3 rounded-xl border border-[#E5E5E5] bg-[#fafafa] p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Your QR Code</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={reg.qr_data_url}
              alt="Registration QR Code"
              className="size-52 rounded-lg"
            />
            <p className="text-xs text-muted text-center">
              Present this at the event entrance. A copy was also sent to your email.
            </p>
            <a
              href={reg.qr_data_url}
              download="gms-qr-code.png"
              className="rounded-btn border border-[#E5E5E5] px-4 py-2 text-xs font-medium text-[#111111] hover:bg-white transition-colors"
            >
              Download QR
            </a>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────

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

      {/* Results */}
      {result !== null && (
        !result.found ? (
          <div className="rounded-lg border border-[#E5E5E5] px-5 py-8 text-center">
            <p className="text-sm font-medium text-[#111111]">No registration found</p>
            <p className="mt-1 text-xs text-muted">
              No record matches <strong>{email}</strong>. Check the email address and try again.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Name header */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[#111111]">{result.full_name}</p>
              {result.registrations.length > 1 && (
                <span className="rounded-full border border-[#E5E5E5] px-2.5 py-0.5 text-[11px] font-medium text-muted">
                  {result.registrations.length} events
                </span>
              )}
            </div>

            {/* One card per event */}
            {result.registrations.map((reg, i) => (
              <RegistrationCard key={i} reg={reg} />
            ))}
          </div>
        )
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createWalkinRegistration } from '@/app/dashboard/registrations/walkin-actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select-native'
import { resolveEventCurrency } from '@/lib/currencies'
import { CurrencyBanner, PackagePrice } from '@/components/registration/PackagePrice'
import { cn, formatDate } from '@/lib/utils'
import { getEffectivePackagePrice, isEarlyBirdPricingActive } from '@/lib/pricing'
import { GMS_CHURCHES } from '@/lib/constants'
import type { Event, Package, PaymentStatus } from '@/lib/types/database'

type EventPricing = Pick<
  Event,
  'currency' | 'early_bird_enabled' | 'early_bird_auto_change' | 'early_bird_end_date'
>

interface Props {
  eventId: string
  packages: Package[]
  eventPricing: EventPricing | null
  onClose: () => void
}

export default function WalkinDrawer({ eventId, packages, eventPricing, onClose }: Props) {
  const ebEvent = eventPricing ?? {
    currency: 'IDR',
    early_bird_enabled: false,
    early_bird_auto_change: true,
    early_bird_end_date: null,
  }
  const currency = resolveEventCurrency(ebEvent.currency)
  const earlyBirdActive = isEarlyBirdPricingActive(ebEvent)
  const router = useRouter()

  const [fullName,   setFullName]   = useState('')
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [church,     setChurch]     = useState('')
  const [nij,        setNij]        = useState('')
  const [packageId,  setPackageId]  = useState(packages[0]?.id ?? '')
  const [status,     setStatus]     = useState<PaymentStatus>('pending')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  async function handleSubmit() {
    const fe: Record<string, string> = {}
    if (!fullName.trim()) fe.full_name = 'Required'
    if (!email.trim())    fe.email     = 'Required'
    if (!church)          fe.church    = 'Required'
    if (Object.keys(fe).length) { setFieldErrors(fe); return }

    setFieldErrors({})
    setError(null)
    setSaving(true)

    const res = await createWalkinRegistration({
      event_id:       eventId,
      full_name:      fullName,
      email,
      phone:          phone || null,
      gms_church:     church,
      nij:            nij || null,
      package_id:     packageId || null,
      payment_status: status,
    })

    setSaving(false)

    if (res.error) { setError(res.error); return }
    router.refresh()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-md flex-col bg-white shadow-2xl">

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5E5] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-[#111111]">Walk-in Registration</h2>
            <p className="mt-0.5 text-xs text-muted">Add a registrant manually ” no payment upload needed</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {error && (
            <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
              {error}
            </p>
          )}

          <div>
            <Label htmlFor="wk-name" required>Full Name</Label>
            <Input
              id="wk-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="As per ID"
              className={fieldErrors.full_name ? 'border-error' : ''}
            />
            {fieldErrors.full_name && <p className="mt-1 text-xs text-error">{fieldErrors.full_name}</p>}
          </div>

          <div>
            <Label htmlFor="wk-email" required>Email</Label>
            <Input
              id="wk-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={fieldErrors.email ? 'border-error' : ''}
            />
            {fieldErrors.email && <p className="mt-1 text-xs text-error">{fieldErrors.email}</p>}
          </div>

          <div>
            <Label htmlFor="wk-phone">Phone <span className="font-normal text-muted">(optional)</span></Label>
            <Input
              id="wk-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+62 8xx xxxx xxxx"
            />
          </div>

          <div>
            <Label htmlFor="wk-church" required>GMS Church Branch</Label>
            <Select
              id="wk-church"
              value={church}
              onChange={(e) => setChurch(e.target.value)}
              className={fieldErrors.church ? 'border-error' : ''}
            >
              <option value="" disabled>Select branch</option>
              {GMS_CHURCHES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            {fieldErrors.church && <p className="mt-1 text-xs text-error">{fieldErrors.church}</p>}
          </div>

          <div>
            <Label htmlFor="wk-nij">NIJ / Disciple ID <span className="font-normal text-muted">(optional)</span></Label>
            <Input id="wk-nij" value={nij} onChange={(e) => setNij(e.target.value)} placeholder="e.g. 21004592" />
          </div>

          {/* Package */}
          {packages.length > 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Label>Package <span className="font-normal text-muted">(optional)</span></Label>
                <span className="rounded-full border border-[#E5E5E5] px-2 py-0.5 text-[10px] font-semibold uppercase text-muted">
                  {currency}
                </span>
              </div>
              <CurrencyBanner currency={currency} className="mt-2" />
              <div className="mt-2 space-y-2">
                <label className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors',
                  !packageId ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999999]'
                )}>
                  <input type="radio" name="wk-pkg" value="" checked={!packageId}
                    onChange={() => setPackageId('')} className="sr-only" />
                  <div className={cn('size-3.5 shrink-0 rounded-full border-2 flex items-center justify-center',
                    !packageId ? 'border-[#111111]' : 'border-[#D1D1D1]')}>
                    {!packageId && <div className="size-1.5 rounded-full bg-[#111111]" />}
                  </div>
                  <span className="text-sm text-muted italic">No package</span>
                </label>
                {earlyBirdActive && eventPricing?.early_bird_end_date && (
                  <p className="text-xs text-muted mb-2">
                    Early bird until {formatDate(eventPricing.early_bird_end_date)}
                  </p>
                )}
                {packages.map((pkg) => {
                  const effective = getEffectivePackagePrice(pkg, ebEvent)
                  const showEb =
                    earlyBirdActive &&
                    pkg.early_bird_price != null &&
                    effective < pkg.price
                  return (
                  <label key={pkg.id} className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border-2 p-3 transition-colors',
                    packageId === pkg.id ? 'border-[#111111] bg-[#fafafa]' : 'border-[#E5E5E5] hover:border-[#999999]'
                  )}>
                    <input type="radio" name="wk-pkg" value={pkg.id} checked={packageId === pkg.id}
                      onChange={() => setPackageId(pkg.id)} className="sr-only" />
                    <div className={cn('size-3.5 shrink-0 rounded-full border-2 flex items-center justify-center',
                      packageId === pkg.id ? 'border-[#111111]' : 'border-[#D1D1D1]')}>
                      {packageId === pkg.id && <div className="size-1.5 rounded-full bg-[#111111]" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#111111]">{pkg.name}</p>
                      <div className="mt-1">
                        <PackagePrice
                          amount={effective}
                          currency={currency}
                          compareAt={showEb ? pkg.price : null}
                          size="sm"
                        />
                      </div>
                    </div>
                  </label>
                )})}
              </div>
            </div>
          )}

          {/* Payment status */}
          <div>
            <Label>Initial Payment Status</Label>
            <div className="mt-2 flex gap-2">
              {(['pending', 'verified'] as PaymentStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    'flex-1 rounded-btn border-2 py-2 text-sm font-medium capitalize transition-colors',
                    status === s
                      ? s === 'verified' ? 'border-success bg-success/5 text-success'
                                         : 'border-[#111111] bg-[#fafafa] text-[#111111]'
                      : 'border-[#E5E5E5] text-muted hover:border-[#999999]'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            {status === 'verified' && (
              <p className="mt-1.5 text-xs text-muted">QR code will be emailed immediately.</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-[#E5E5E5] px-6 py-4">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="w-full rounded-btn bg-[#111111] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {saving ? 'Adding' : 'Add Registrant'}
          </button>
        </div>
      </div>
    </>
  )
}


'use client'

import { useState, useEffect, useCallback } from 'react'
import { cn, formatDateTime, formatCurrency, formatDate } from '@/lib/utils'
import { StatusBadge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select-native'
import { GMS_CHURCHES } from '@/lib/constants'
import {
  getSignedScreenshotUrl,
  getQRDataUrl,
  verifyPayment,
  rejectPayment,
  updateRegistration,
} from '@/app/dashboard/registrations/actions'
import type { PaymentStatus, StaffRole } from '@/lib/types/database'

export interface DrawerRegistration {
  id: string
  full_name: string
  email: string
  phone: string | null
  gms_church: string
  nij: string | null
  payment_status: PaymentStatus
  payment_notes: string | null
  payment_screenshot_url: string | null
  qr_token: string
  amount_paid: number | null
  is_early_bird: boolean
  created_at: string
  package_id: string
  custom_answers: Record<string, string | boolean>
  packages: { name: string; price: number; toolkit_items: string[] } | null
  events: { name: string; date: string; currency: string; custom_fields: { id: string; label: string; type: string }[] } | null
  attendance_logs: { scan_type: string; scanned_at: string }[]
}

interface Props {
  registration: DrawerRegistration | null
  onClose: () => void
  onUpdate: (id: string, updates: Partial<DrawerRegistration>) => void
  staffRole: StaffRole
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
      {children}
    </p>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 border-b border-[#E5E5E5] py-3 last:border-0">
      <span className="w-28 shrink-0 text-xs font-medium text-muted pt-0.5">{label}</span>
      <span className="text-sm text-[#111111]">
        {value ?? <span className="text-muted">”</span>}
      </span>
    </div>
  )
}

export default function RegistrantDrawer({ registration, onClose, onUpdate, staffRole }: Props) {
  const isOpen = !!registration
  const canEdit = ['super_admin', 'admin'].includes(staffRole)

  // ”” Local state ”””””””””””””””””””””””””””””””””””””””””””””””
  const [localStatus, setLocalStatus] = useState<PaymentStatus | null>(null)
  const [localNotes, setLocalNotes] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [screenshotModal, setScreenshotModal] = useState(false)
  const [tokenCopied, setTokenCopied] = useState(false)

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editChurch, setEditChurch] = useState('')
  const [editNij, setEditNij] = useState('')
  const [editPending, setEditPending] = useState(false)
  const [editError, setEditError] = useState('')

  // Reject mode
  const [isRejecting, setIsRejecting] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [actionPending, setActionPending] = useState(false)
  const [actionError, setActionError] = useState('')

  const reg = registration
  const currentStatus = localStatus ?? reg?.payment_status ?? 'pending'
  const currentNotes = localNotes !== null ? localNotes : reg?.payment_notes ?? null

  // ”” Load screenshot + QR when drawer opens ””””””””””””””””””””
  useEffect(() => {
    if (!reg) return

    setLocalStatus(null)
    setLocalNotes(null)
    setScreenshotUrl(null)
    setQrDataUrl(null)
    setIsEditing(false)
    setIsRejecting(false)
    setRejectReason('')
    setActionError('')
    setTokenCopied(false)

    // QR ” always load for admin
    getQRDataUrl(reg.qr_token).then(setQrDataUrl).catch(console.error)

    // Screenshot
    if (reg.payment_screenshot_url) {
      setScreenshotLoading(true)
      getSignedScreenshotUrl(reg.payment_screenshot_url)
        .then(setScreenshotUrl)
        .catch(console.error)
        .finally(() => setScreenshotLoading(false))
    }
  }, [reg?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const startEdit = () => {
    if (!reg) return
    setEditName(reg.full_name)
    setEditPhone(reg.phone ?? '')
    setEditChurch(reg.gms_church)
    setEditNij(reg.nij ?? '')
    setEditError('')
    setIsEditing(true)
  }

  const saveEdit = async () => {
    if (!reg) return
    setEditPending(true)
    setEditError('')
    const result = await updateRegistration(reg.id, {
      full_name: editName,
      phone: editPhone || null,
      gms_church: editChurch,
      nij: editNij || null,
    })
    setEditPending(false)
    if (result.error) {
      setEditError(result.error)
      return
    }
    onUpdate(reg.id, {
      full_name: editName,
      phone: editPhone || null,
      gms_church: editChurch,
      nij: editNij || null,
    })
    setIsEditing(false)
  }

  const handleVerify = async () => {
    if (!reg) return
    setActionPending(true)
    setActionError('')
    const result = await verifyPayment(reg.id)
    setActionPending(false)
    if (result.error) { setActionError(result.error); return }
    setLocalStatus('verified')
    setLocalNotes(null)
    onUpdate(reg.id, { payment_status: 'verified', payment_notes: null })
    // Now generate the QR since it's verified
    getQRDataUrl(reg.qr_token).then(setQrDataUrl).catch(console.error)
  }

  const handleReject = async () => {
    if (!reg) return
    setActionPending(true)
    setActionError('')
    const result = await rejectPayment(reg.id, rejectReason)
    setActionPending(false)
    if (result.error) { setActionError(result.error); return }
    setLocalStatus('rejected')
    setLocalNotes(rejectReason)
    onUpdate(reg.id, { payment_status: 'rejected', payment_notes: rejectReason })
    setIsRejecting(false)
    setRejectReason('')
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-40 bg-black/20 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      {/* Panel */}
      <aside
        className={cn(
          'fixed inset-y-0 right-0 z-50 flex w-full sm:w-[500px] flex-col bg-white border-l border-[#E5E5E5]',
          'transition-transform duration-200',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        {!reg ? null : (
          <>
            {/* ”” Header ”” */}
            <div className="flex items-start justify-between border-b border-[#E5E5E5] px-6 py-4 gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-[#111111] truncate">
                  {isEditing ? editName || reg.full_name : reg.full_name}
                </p>
                <p className="text-xs text-muted mt-0.5 truncate">{reg.email}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={currentStatus} />
                {canEdit && !isEditing && (
                  <Button variant="secondary" size="sm" onClick={startEdit}>
                    Edit
                  </Button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-btn p-1.5 text-muted hover:bg-[#f5f5f5] hover:text-[#111111] transition-colors"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* ”” Scrollable body ”” */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

              {/* ”” Details / Edit form ”” */}
              <section>
                <SectionTitle>Details</SectionTitle>

                {isEditing ? (
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="edit_name" required>Full Name</Label>
                      <Input id="edit_name" value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div>
                      <Label htmlFor="edit_phone">Phone</Label>
                      <Input id="edit_phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Optional" />
                    </div>
                    <div>
                      <Label htmlFor="edit_church" required>Church</Label>
                      <Select id="edit_church" value={editChurch} onChange={(e) => setEditChurch(e.target.value)}>
                        {GMS_CHURCHES.map((c) => <option key={c} value={c}>{c}</option>)}
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="edit_nij">NIJ</Label>
                      <Input id="edit_nij" value={editNij} onChange={(e) => setEditNij(e.target.value)} placeholder="Optional" />
                    </div>
                    {editError && <p className="text-xs text-error">{editError}</p>}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} disabled={editPending}>
                        {editPending ? 'Saving¦' : 'Save'}
                      </Button>
                      <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)} disabled={editPending}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {reg.events && (
                      <Row
                        label="Event"
                        value={`${reg.events.name} · ${formatDate(reg.events.date)}`}
                      />
                    )}
                    <Row
                      label="Package"
                      value={
                        reg.packages
                          ? `Package ${reg.packages.name} ” ${formatCurrency(
                              reg.amount_paid ?? reg.packages.price,
                              reg.events?.currency ?? 'IDR'
                            )}${reg.is_early_bird ? ' (Early bird)' : ''}`
                          : null
                      }
                    />
                    <Row label="Church" value={reg.gms_church} />
                    <Row label="NIJ" value={reg.nij} />
                    <Row label="Phone" value={reg.phone} />
                    <Row label="Registered" value={formatDateTime(reg.created_at)} />
                    {/* Custom field answers */}
                    {(reg.events?.custom_fields ?? []).map((field) => {
                      const val = reg.custom_answers?.[field.id]
                      if (val === undefined || val === null || val === '') return null
                      const display = field.type === 'checkbox'
                        ? (val ? 'Yes' : 'No')
                        : String(val)
                      return <Row key={field.id} label={field.label} value={display} />
                    })}
                  </div>
                )}
              </section>

              {/* ”” Toolkit items ”” */}
              <section>
                <SectionTitle>Toolkit Items</SectionTitle>
                {reg.packages?.toolkit_items?.length ? (
                  <ul className="space-y-1.5">
                    {reg.packages.toolkit_items.map((item, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-muted">
                        <span className="size-1 rounded-full bg-muted shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No toolkit items (package missing or empty).</p>
                )}
              </section>

              {/* ”” Payment screenshot ”” */}
              <section>
                <SectionTitle>Payment Screenshot</SectionTitle>
                {screenshotLoading && (
                  <div className="h-32 rounded-lg border border-[#E5E5E5] animate-pulse bg-[#f5f5f5]" />
                )}
                {!screenshotLoading && screenshotUrl && (
                  <button
                    onClick={() => setScreenshotModal(true)}
                    className="block w-full overflow-hidden rounded-lg border border-[#E5E5E5] hover:border-[#999] transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={screenshotUrl}
                      alt="Payment screenshot"
                      className="max-h-48 w-full object-contain bg-[#fafafa]"
                    />
                    <p className="border-t border-[#E5E5E5] py-2 text-center text-xs text-muted">
                      Click to view full size
                    </p>
                  </button>
                )}
                {!screenshotLoading && !screenshotUrl && (
                  <p className="text-sm text-muted">No screenshot uploaded.</p>
                )}
              </section>

              {/* ”” QR Code ”” */}
              <section>
                <SectionTitle>QR Code</SectionTitle>
                {qrDataUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-start gap-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={qrDataUrl}
                        alt="QR Code"
                        className="size-36 rounded-lg border border-[#E5E5E5]"
                      />
                      <div className="space-y-2 pt-1">
                        <a
                          href={qrDataUrl}
                          download={`qr-${reg.id.slice(0, 8)}.png`}
                          className="inline-flex items-center gap-1.5 rounded-btn border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-muted hover:bg-[#f5f5f5] hover:text-[#111111] transition-colors"
                        >
                          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                          </svg>
                          Download PNG
                        </a>
                        <p className="text-xs text-muted leading-relaxed">
                          {currentStatus === 'verified'
                            ? 'Active ” scanner will accept this.'
                            : 'Inactive until payment is verified.'}
                        </p>
                      </div>
                    </div>

                    {/* Manual token ” for manual check-in */}
                    <div className="rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-4 py-3">
                      <p className="mb-1.5 text-xs font-medium text-muted">Manual check-in token</p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate rounded bg-white border border-[#E5E5E5] px-2.5 py-1.5 text-xs font-mono text-[#111111] select-all">
                          {reg.qr_token}
                        </code>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(reg.qr_token)
                            setTokenCopied(true)
                            setTimeout(() => setTokenCopied(false), 2000)
                          }}
                          className="shrink-0 rounded-btn border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-muted hover:bg-white hover:text-[#111111] transition-colors"
                        >
                          {tokenCopied ? 'Copied œ“' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="size-36 rounded-lg border border-[#E5E5E5] animate-pulse bg-[#f5f5f5]" />
                )}
              </section>

              {/* ”” Attendance ”” */}
              <section>
                <SectionTitle>Attendance</SectionTitle>
                {(() => {
                  const toolkit = reg.attendance_logs.find((l) => l.scan_type === 'toolkit')
                  const event = reg.attendance_logs.find((l) => l.scan_type === 'event')
                  return (
                    <div>
                      <Row
                        label="Toolkit"
                        value={
                          toolkit ? (
                            <span className="text-success text-xs font-medium">
                              Collected · {formatDateTime(toolkit.scanned_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Not collected</span>
                          )
                        }
                      />
                      <Row
                        label="Event"
                        value={
                          event ? (
                            <span className="text-success text-xs font-medium">
                              Attended · {formatDateTime(event.scanned_at)}
                            </span>
                          ) : (
                            <span className="text-xs text-muted">Not attended</span>
                          )
                        }
                      />
                    </div>
                  )
                })()}
              </section>

              {/* ”” Payment actions ”” */}
              {canEdit && (
                <section>
                  <SectionTitle>Payment</SectionTitle>

                  {currentNotes && currentStatus === 'rejected' && (
                    <div className="mb-4 rounded-lg border border-error/30 bg-error/5 px-4 py-3">
                      <p className="text-xs font-medium text-error mb-1">Rejection reason</p>
                      <p className="text-sm text-[#111111]">{currentNotes}</p>
                    </div>
                  )}

                  {actionError && (
                    <p className="mb-3 text-xs text-error">{actionError}</p>
                  )}

                  {/* Reject mode: reason input */}
                  {isRejecting && (
                    <div className="mb-4 space-y-3">
                      <div>
                        <Label htmlFor="reject_reason" required>Rejection reason</Label>
                        <textarea
                          id="reject_reason"
                          rows={3}
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Explain why the payment was rejected¦"
                          className="w-full rounded-btn border border-[#E5E5E5] px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent resize-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleReject}
                          disabled={actionPending || !rejectReason.trim()}
                          className="bg-error hover:bg-error/90"
                        >
                          {actionPending ? 'Rejecting¦' : 'Confirm Rejection'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => { setIsRejecting(false); setRejectReason('') }}
                          disabled={actionPending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {!isRejecting && (
                    <div className="flex gap-2">
                      {currentStatus !== 'verified' && (
                        <Button
                          size="sm"
                          onClick={handleVerify}
                          disabled={actionPending}
                          className="border border-success bg-white text-success hover:bg-success/5"
                        >
                          {actionPending ? 'Updating¦' : 'Verify Payment'}
                        </Button>
                      )}
                      {currentStatus !== 'rejected' && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setIsRejecting(true)}
                          disabled={actionPending}
                          className="border-error/40 text-error hover:bg-error/5"
                        >
                          Reject Payment
                        </Button>
                      )}
                      {currentStatus === 'verified' && (
                        <p className="text-xs text-success font-medium self-center">
                          Payment verified ” confirmation email sent.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        )}
      </aside>

      {/* ”” Screenshot full-size modal ”” */}
      {screenshotModal && screenshotUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-6"
          onClick={() => setScreenshotModal(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={screenshotUrl}
            alt="Payment screenshot"
            className="max-h-full max-w-full rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setScreenshotModal(false)}
            className="absolute top-4 right-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}


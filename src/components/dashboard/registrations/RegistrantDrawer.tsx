'use client'

import { useState, useEffect } from 'react'
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
  deleteRegistration,
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
  onDelete: (id: string) => void
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
        {value ?? <span className="text-muted">--</span>}
      </span>
    </div>
  )
}

export default function RegistrantDrawer({ registration, onClose, onUpdate, onDelete, staffRole }: Props) {
  const isOpen = !!registration
  const canEdit = ['super_admin', 'admin'].includes(staffRole)

  // Local state
  const [localStatus, setLocalStatus] = useState<PaymentStatus | null>(null)
  const [localNotes, setLocalNotes] = useState<string | null>(null)
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null)
  const [screenshotLoading, setScreenshotLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [screenshotModal, setScreenshotModal] = useState(false)
  const [screenshotZoom, setScreenshotZoom] = useState(1)
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

  // Delete mode
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deletePending, setDeletePending] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const reg = registration
  const currentStatus = localStatus ?? reg?.payment_status ?? 'pending'
  const currentNotes = localNotes !== null ? localNotes : reg?.payment_notes ?? null

  // Load screenshot + QR when drawer opens
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
    setScreenshotModal(false)
    setConfirmDelete(false)
    setDeleteError('')

    getQRDataUrl(reg.qr_token).then(setQrDataUrl).catch(console.error)

    if (reg.payment_screenshot_url) {
      setScreenshotLoading(true)
      getSignedScreenshotUrl(reg.payment_screenshot_url)
        .then(setScreenshotUrl)
        .catch(console.error)
        .finally(() => setScreenshotLoading(false))
    }
  }, [reg?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close screenshot modal on Escape (keyCode 27); reset zoom when modal closes
  useEffect(() => {
    if (!screenshotModal) { setScreenshotZoom(1); return }
    const onKey = (e: KeyboardEvent) => { if (e.keyCode === 27) setScreenshotModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [screenshotModal])

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
    getQRDataUrl(reg.qr_token).then(setQrDataUrl).catch(console.error)
  }

  const handleDelete = async () => {
    if (!reg) return
    setDeletePending(true)
    setDeleteError('')
    const result = await deleteRegistration(reg.id)
    setDeletePending(false)
    if (result.error) { setDeleteError(result.error); return }
    onDelete(reg.id)
    onClose()
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
            {/* Header */}
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

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

              {/* Details / Edit form */}
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
                        {editPending ? 'Saving...' : 'Save'}
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
                          ? `${reg.packages.name} · ${formatCurrency(
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

              {/* Toolkit items */}
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
                  <p className="text-sm text-muted">No toolkit items.</p>
                )}
              </section>

              {/* Payment screenshot */}
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

              {/* QR Code */}
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
                            ? 'Active — scanner will accept this.'
                            : 'Inactive until payment is verified.'}
                        </p>
                      </div>
                    </div>

                    {/* Manual token for manual check-in */}
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
                          {tokenCopied ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="size-36 rounded-lg border border-[#E5E5E5] animate-pulse bg-[#f5f5f5]" />
                )}
              </section>

              {/* Attendance */}
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
                              Collected &middot; {formatDateTime(toolkit.scanned_at)}
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
                              Attended &middot; {formatDateTime(event.scanned_at)}
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

              {/* Delete registration */}
              {canEdit && (
                <section>
                  <SectionTitle>Danger Zone</SectionTitle>
                  {deleteError && (
                    <p className="mb-3 text-xs text-error">{deleteError}</p>
                  )}
                  {confirmDelete ? (
                    <div className="rounded-lg border border-error/30 bg-error/5 p-4 space-y-3">
                      <p className="text-sm font-medium text-[#111111]">Delete this registration?</p>
                      <p className="text-xs text-muted">
                        This permanently removes <strong>{reg.full_name}</strong>&apos;s record and cannot be undone.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleDelete}
                          disabled={deletePending}
                          className="bg-error hover:bg-error/90"
                        >
                          {deletePending ? 'Deleting...' : 'Yes, delete'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deletePending}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="text-xs font-medium text-error hover:underline"
                    >
                      Delete registration
                    </button>
                  )}
                </section>
              )}

              {/* Payment actions */}
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
                          placeholder="Explain why the payment was rejected"
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
                          {actionPending ? 'Rejecting...' : 'Confirm Rejection'}
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
                          {actionPending ? 'Updating...' : 'Verify Payment'}
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
                          Payment verified &mdash; confirmation email sent.
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

      {/* Screenshot full-size modal — z-[60] sits above the drawer panel (z-50) */}
      {screenshotModal && screenshotUrl && (
        <div
          className="fixed inset-0 z-[60] flex flex-col bg-black/90"
          onClick={() => setScreenshotModal(false)}
        >
          {/* Top bar */}
          <div
            className="flex shrink-0 items-center justify-between gap-3 px-4 py-3"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-white/70">Payment Screenshot</p>

            <div className="flex items-center gap-2">
              {/* Zoom controls */}
              <div className="flex items-center gap-1 rounded-lg bg-white/10 p-1">
                <button
                  onClick={() => setScreenshotZoom((z) => Math.max(0.5, parseFloat((z - 0.25).toFixed(2))))}
                  disabled={screenshotZoom <= 0.5}
                  className="flex size-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                  aria-label="Zoom out"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM13.5 10.5h-6" />
                  </svg>
                </button>
                <button
                  onClick={() => setScreenshotZoom(1)}
                  className="min-w-[3rem] text-center text-xs font-medium text-white/70 hover:text-white transition-colors"
                >
                  {Math.round(screenshotZoom * 100)}%
                </button>
                <button
                  onClick={() => setScreenshotZoom((z) => Math.min(4, parseFloat((z + 0.25).toFixed(2))))}
                  disabled={screenshotZoom >= 4}
                  className="flex size-7 items-center justify-center rounded-md text-white transition-colors hover:bg-white/20 disabled:opacity-30"
                  aria-label="Zoom in"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                  </svg>
                </button>
              </div>

              <button
                onClick={() => setScreenshotModal(false)}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-medium text-white hover:bg-white/20 transition-colors"
              >
                <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
                Close
              </button>
            </div>
          </div>

          {/* Image — scrollable in both axes when zoomed */}
          <div
            className="min-h-0 flex-1 overflow-auto p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={screenshotUrl}
              alt="Payment screenshot"
              className="mx-auto block rounded-lg transition-[width] duration-150"
              style={{ width: `${screenshotZoom * 100}%`, maxWidth: screenshotZoom > 1 ? 'none' : '100%' }}
            />
          </div>

          {/* Hint */}
          <p className="shrink-0 pb-4 text-center text-xs text-white/30">
            Tap outside or press Esc to close
          </p>
        </div>
      )}
    </>
  )
}

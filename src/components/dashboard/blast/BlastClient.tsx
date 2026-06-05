'use client'

import { useState, useEffect, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  sendEmailBlast,
  previewBlastRecipients,
  deleteEmailBlasts,
  type BlastFilters,
  type RecipientMode,
  type EmailBlast,
} from '@/app/dashboard/blast/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { formatDateTime } from '@/lib/utils'

const RichEditor = dynamic(() => import('./RichEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-[316px] animate-pulse rounded-btn border border-[#E5E5E5] bg-[#fafafa]" />
  ),
})

interface Props {
  events: { id: string; name: string; date: string }[]
  packages: { id: string; name: string; event_id: string }[]
  churches: string[]
  initialBlasts: EmailBlast[]
}

const DEFAULT_FILTERS: BlastFilters = {
  eventId: 'all',
  status: 'all',
  packageId: 'all',
  church: 'all',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export default function BlastClient({ events, packages, churches, initialBlasts }: Props) {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [recipientMode, setRecipientMode] = useState<RecipientMode>('filters')
  const [filters, setFilters] = useState<BlastFilters>(DEFAULT_FILTERS)
  const [emailInput, setEmailInput] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [invalidEmails, setInvalidEmails] = useState<string[]>([])
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blasts, setBlasts] = useState<EmailBlast[]>(initialBlasts)
  const [previewing, startPreview] = useTransition()
  // History delete state
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const visiblePackages = filters.eventId === 'all'
    ? packages
    : packages.filter((p) => p.event_id === filters.eventId)

  // Parse + validate email list
  const parsedEmails = parseEmails(emailInput)
  const validEmails = parsedEmails.filter((e) => EMAIL_RE.test(e))

  // Live preview
  useEffect(() => {
    if (recipientMode === 'emails') {
      const invalid = parsedEmails.filter((e) => e && !EMAIL_RE.test(e))
      setInvalidEmails(invalid)
      setRecipientCount(new Set(validEmails).size)
      return
    }
    startPreview(async () => {
      const res = await previewBlastRecipients('filters', filters, [])
      setRecipientCount(res.count)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, recipientMode, emailInput])

  function setFilter<K extends keyof BlastFilters>(key: K, val: BlastFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: val }
      if (key === 'eventId') next.packageId = 'all'
      return next
    })
  }

  async function handleSend() {
    setError(null)
    setSent(null)
    setSending(true)
    const res = await sendEmailBlast(
      subject,
      body,
      recipientMode,
      filters,
      recipientMode === 'emails' ? validEmails : []
    )
    setSending(false)
    if (res.error) { setError(res.error); return }
    setSent({ count: res.sent })
    setSubject('')
    setBody('')
    setFilters(DEFAULT_FILTERS)
    setEmailInput('')
    const { getEmailBlasts } = await import('@/app/dashboard/blast/actions')
    setBlasts(await getEmailBlasts())
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(selected.size === blasts.length ? new Set() : new Set(blasts.map((b) => b.id)))
  }

  async function handleDelete() {
    setDeleting(true)
    setDeleteError(null)
    const res = await deleteEmailBlasts(Array.from(selected))
    setDeleting(false)
    if (res.error) { setDeleteError(res.error); return }
    setBlasts((prev) => prev.filter((b) => !selected.has(b.id)))
    setSelected(new Set())
    setConfirmDelete(false)
  }

  const canSend =
    !sending &&
    subject.trim() &&
    body.trim() &&
    body !== '<p></p>' &&
    (recipientCount ?? 0) > 0

  return (
    <div className="space-y-0">
      {/* Tabs */}
      <div className="flex border-b border-[#E5E5E5]">
        {(['compose', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`border-b-2 px-1 pb-3 pt-3 text-xs font-medium capitalize transition-colors mr-6 ${
              tab === t
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-muted hover:text-[#111111]'
            }`}
          >
            {t === 'history' ? `History (${blasts.length})` : 'Compose'}
          </button>
        ))}
      </div>

      {/* ”” Compose ”” */}
      {tab === 'compose' && (
        <div className="space-y-6 pt-6">
          {error && (
            <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">{error}</p>
          )}
          {sent && (
            <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-xs text-success">
              œ“ Sent to {sent.count} recipient{sent.count !== 1 ? 's' : ''} successfully.
            </p>
          )}

          {/* Subject */}
          <div>
            <Label htmlFor="blast-subject" required>Subject</Label>
            <Input
              id="blast-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Important update for GMS Asia Conference 2026"
            />
          </div>

          {/* Recipient mode toggle */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Recipients</p>
              <span className="text-xs text-muted">
                {previewing ? 'Counting' : recipientCount !== null ? (
                  <span className={recipientCount === 0 ? 'text-error' : 'text-[#111111] font-medium'}>
                    {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </span>
                ) : null}
              </span>
            </div>

            {/* Mode pills */}
            <div className="mb-4 flex gap-2">
              {(['filters', 'emails'] as RecipientMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRecipientMode(m)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    recipientMode === m
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#E5E5E5] text-muted hover:border-[#999] hover:text-[#111111]'
                  }`}
                >
                  {m === 'filters' ? 'By filters' : 'By email list'}
                </button>
              ))}
            </div>

            {/* Filters panel */}
            {recipientMode === 'filters' && (
              <div className="rounded-lg border border-[#E5E5E5] bg-[#fafafa] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="f-event">Event</Label>
                    <Select id="f-event" value={filters.eventId} onChange={(e) => setFilter('eventId', e.target.value)}>
                      <option value="all">All events</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>{ev.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="f-status">Payment Status</Label>
                    <Select id="f-status" value={filters.status} onChange={(e) => setFilter('status', e.target.value as BlastFilters['status'])}>
                      <option value="all">All statuses</option>
                      <option value="verified">Verified</option>
                      <option value="pending">Pending</option>
                      <option value="rejected">Rejected</option>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="f-pkg">Package</Label>
                    <Select id="f-pkg" value={filters.packageId} onChange={(e) => setFilter('packageId', e.target.value)}>
                      <option value="all">All packages</option>
                      {visiblePackages.map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="f-church">Church</Label>
                    <Select id="f-church" value={filters.church} onChange={(e) => setFilter('church', e.target.value)}>
                      <option value="all">All churches</option>
                      {churches.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Email list panel */}
            {recipientMode === 'emails' && (
              <div className="space-y-2">
                <textarea
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder={`Paste or type email addresses, one per line or comma-separated:\n\njohn@example.com\njane@example.com, bob@example.com`}
                  rows={6}
                  className="w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2.5 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent resize-none font-mono"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted">
                    Separate with newlines, commas, or semicolons
                  </span>
                  {parsedEmails.length > 0 && (
                    <span className="text-muted">
                      <span className="text-[#111111] font-medium">{validEmails.length}</span> valid
                      {invalidEmails.length > 0 && (
                        <span className="text-error ml-2">· {invalidEmails.length} invalid</span>
                      )}
                    </span>
                  )}
                </div>
                {invalidEmails.length > 0 && (
                  <div className="rounded-lg border border-error/20 bg-error/5 px-3 py-2">
                    <p className="text-xs font-medium text-error mb-1">Invalid addresses (will be skipped):</p>
                    <p className="text-xs text-error/80 font-mono break-all">{invalidEmails.join(', ')}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Body */}
          <div>
            <Label required>Message</Label>
            <RichEditor value={body} onChange={setBody} />
          </div>

          {/* Send */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!canSend}
            className="w-full rounded-btn bg-[#111111] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Sending
              </span>
            ) : recipientCount !== null && recipientCount > 0
              ? `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`
              : 'Send'}
          </button>
        </div>
      )}

      {/* ”” History ”” */}
      {tab === 'history' && (
        <div className="pt-6 space-y-4">
          {blasts.length === 0 ? (
            <div className="rounded-lg border border-[#E5E5E5] py-16 text-center">
              <p className="text-sm text-muted">No blasts sent yet.</p>
            </div>
          ) : (
            <>
              {/* Bulk action bar */}
              <div className="flex items-center justify-between gap-3">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === blasts.length && blasts.length > 0}
                    onChange={toggleSelectAll}
                    className="size-4 rounded border-[#E5E5E5] accent-[#111111]"
                  />
                  <span className="text-xs text-muted">
                    {selected.size > 0 ? `${selected.size} selected` : 'Select all'}
                  </span>
                </label>

                {selected.size > 0 && (
                  <button
                    type="button"
                    onClick={() => { setConfirmDelete(true); setDeleteError(null) }}
                    className="rounded-btn border border-error/40 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/5 transition-colors"
                  >
                    Delete {selected.size === 1 ? '1 blast' : `${selected.size} blasts`}
                  </button>
                )}
              </div>

              {/* Confirm delete */}
              {confirmDelete && (
                <div className="rounded-lg border border-error/30 bg-error/5 px-4 py-4 space-y-3">
                  <p className="text-sm font-medium text-error">
                    Delete {selected.size === 1 ? 'this blast' : `these ${selected.size} blasts`}?
                  </p>
                  <p className="text-xs text-muted">This removes them from history only ” emails already sent are not recalled.</p>
                  {deleteError && <p className="text-xs text-error">{deleteError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setConfirmDelete(false); setDeleteError(null) }}
                      disabled={deleting}
                      className="flex-1 rounded-btn border border-[#E5E5E5] py-2 text-sm text-muted hover:bg-white disabled:opacity-40"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 rounded-btn bg-error py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
                    >
                      {deleting ? 'Deleting' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}

              {/* Blast list */}
              <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5]">
                {blasts.map((blast) => {
                  const isEmailMode = blast.recipient_mode === 'emails'
                  const f = blast.filters
                  const tags = isEmailMode
                    ? ['Email list']
                    : [
                        f.eventId !== 'all' ? (events.find(e => e.id === f.eventId)?.name ?? 'Event') : 'All events',
                        f.status !== 'all' ? f.status : 'All statuses',
                        f.church !== 'all' ? f.church : null,
                        f.packageId !== 'all' ? 'Filtered package' : null,
                      ].filter(Boolean) as string[]
                  const isSelected = selected.has(blast.id)

                  return (
                    <div
                      key={blast.id}
                      className={`flex items-start gap-3 px-4 py-4 transition-colors ${isSelected ? 'bg-[#fafafa]' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(blast.id)}
                        className="mt-0.5 size-4 shrink-0 rounded border-[#E5E5E5] accent-[#111111]"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[#111111] truncate">{blast.subject}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span key={tag} className="rounded border border-[#E5E5E5] bg-[#fafafa] px-1.5 py-0.5 text-xs text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                        {isEmailMode && blast.manual_emails && blast.manual_emails.length > 0 && (
                          <p className="mt-1 text-xs text-muted font-mono truncate">
                            {blast.manual_emails.slice(0, 3).join(', ')}
                            {blast.manual_emails.length > 3 && ` +${blast.manual_emails.length - 3} more`}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {blast.recipient_count} recipient{blast.recipient_count !== 1 ? 's' : ''} · {formatDateTime(blast.sent_at)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}


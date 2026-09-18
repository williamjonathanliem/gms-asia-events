'use client'

import { useState, useEffect, useTransition } from 'react'
import dynamic from 'next/dynamic'
import {
  sendEmailBlast,
  continueEmailBlast,
  previewBlastRecipients,
  deleteEmailBlasts,
  type BlastFilters,
  type RecipientMode,
  type EmailBlast,
} from '@/app/dashboard/blast/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { formatDateTime } from '@/lib/utils'

// Thin wrapper — maps 'all' sentinel so Radix Select works with non-empty values
function FSel({ value, onValueChange, className, children }: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={`h-9 w-full rounded-btn border-[#E5E5E5] text-sm text-[#111111] ${className ?? ''}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>{children}</SelectContent>
    </Select>
  )
}

const RichEditor = dynamic(() => import('./RichEditor'), {
  ssr: false,
  loading: () => (
    <div className="h-[316px] animate-pulse rounded-btn border border-[#E5E5E5] bg-[#fafafa]" />
  ),
})

type Contact = {
  full_name: string
  email: string
  gms_church: string
  payment_status: string
  event_name: string
}

interface Props {
  events: { id: string; name: string; date: string }[]
  packages: { id: string; name: string; event_id: string }[]
  churches: string[]
  initialBlasts: EmailBlast[]
  allContacts: Contact[]
}

const DEFAULT_FILTERS: BlastFilters = {
  eventId: 'all',
  status: 'all',
  packageId: 'all',
  church: 'all',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type TabKey = 'compose' | 'history'
type UIMode = 'filters' | 'emails' | 'pick'


const STATUS_DOT: Record<string, string> = {
  verified: 'bg-success',
  pending:  'bg-amber-400',
  rejected: 'bg-error',
}

function parseEmails(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export default function BlastClient({ events, packages, churches, initialBlasts, allContacts }: Props) {
  const [tab, setTab] = useState<TabKey>('compose')

  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [uiMode, setUiMode] = useState<UIMode>('filters')
  const [filters, setFilters] = useState<BlastFilters>(DEFAULT_FILTERS)
  const [emailInput, setEmailInput] = useState('')
  const [pickedEmails, setPickedEmails] = useState<Set<string>>(new Set())
  const [contactSearch, setContactSearch] = useState('')
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [invalidEmails, setInvalidEmails] = useState<string[]>([])

  const filteredContacts = contactSearch.trim()
    ? allContacts.filter((c) => {
        const q = contactSearch.toLowerCase()
        return c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.gms_church.toLowerCase().includes(q)
      })
    : allContacts
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ count: number; failed: number; queued: number } | null>(null)
  const [continuing, setContinuing] = useState<string | null>(null)
  const [continueResult, setContinueResult] = useState<Record<string, { sent: number; queued: number }>>({})
  const [continueError, setContinueError] = useState<Record<string, string>>({})
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
    if (uiMode === 'emails') {
      const invalid = parsedEmails.filter((e) => e && !EMAIL_RE.test(e))
      setInvalidEmails(invalid)
      setRecipientCount(new Set(validEmails).size)
      return
    }
    if (uiMode === 'pick') {
      setRecipientCount(pickedEmails.size)
      return
    }
    startPreview(async () => {
      const res = await previewBlastRecipients('filters', filters, [])
      setRecipientCount(res.count)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, uiMode, emailInput, pickedEmails])

  function setFilter<K extends keyof BlastFilters>(key: K, val: BlastFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: val }
      if (key === 'eventId') next.packageId = 'all'
      return next
    })
  }

  const recipientMode: RecipientMode = uiMode === 'filters' ? 'filters' : 'emails'

  async function handleSend() {
    setError(null)
    setSent(null)
    setSending(true)
    const emailsToSend = uiMode === 'pick'
      ? Array.from(pickedEmails)
      : uiMode === 'emails' ? validEmails : []
    const res = await sendEmailBlast(subject, body, recipientMode, filters, emailsToSend)
    setSending(false)
    if (res.error) { setError(res.error); return }
    setSent({ count: res.sent, failed: res.failed, queued: res.queued })
    setSubject('')
    setBody('')
    setFilters(DEFAULT_FILTERS)
    setEmailInput('')
    setPickedEmails(new Set())
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
    (recipientCount ?? 0) > 0 &&
    (uiMode !== 'pick' || pickedEmails.size > 0)

  return (
    <div className="space-y-0">
      {/* Tabs */}
      <div className="flex border-b border-[#E5E5E5]">
        {(
          [
            { key: 'compose' as const, label: 'Compose' },
            { key: 'history' as const, label: `History (${blasts.length})` },
          ]
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`border-b-2 px-1 pb-3 pt-3 text-xs font-medium transition-colors mr-6 ${
              tab === key
                ? 'border-[#111111] text-[#111111]'
                : 'border-transparent text-muted hover:text-[#111111]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* "" Compose "" */}
      {tab === 'compose' && (
        <div className="space-y-6 pt-6">
          {error && (
            <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">{error}</p>
          )}
          {sent && (
            <div className={`rounded-lg border px-4 py-3 text-xs space-y-1 ${sent.queued > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-success/30 bg-success/5 text-success'}`}>
              <p className="font-medium">
                {sent.queued > 0
                  ? `Sent to ${sent.count} of ${sent.count + sent.queued} recipients. ${sent.queued} queued for tomorrow.`
                  : `Sent to ${sent.count} recipient${sent.count !== 1 ? 's' : ''} successfully.`}
              </p>
              {sent.queued > 0 && (
                <p>The daily limit (300) was reached. Go to History and click <strong>Continue sending</strong> tomorrow to reach the remaining {sent.queued}.</p>
              )}
              {sent.failed > 0 && <p className="text-error">{sent.failed} failed to send.</p>}
            </div>
          )}

          {/* Templates */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Start from a template</p>
              <button
                type="button"
                onClick={() => setShowTemplates((v) => !v)}
                className="text-xs text-muted hover:text-[#111111] transition-colors"
              >
                {showTemplates ? 'Hide' : 'Show templates'}
              </button>
            </div>
            {showTemplates && (
              <div className="rounded-lg border border-[#E5E5E5] divide-y divide-[#E5E5E5]">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => {
                      setSubject(t.subject)
                      setBody(t.body)
                      setShowTemplates(false)
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-[#fafafa] transition-colors"
                  >
                    <p className="text-sm font-medium text-[#111111]">{t.label}</p>
                    <p className="mt-0.5 text-xs text-muted truncate">{t.subject}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

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
            <div className="mb-4 flex gap-2 flex-wrap">
              {([
                { key: 'filters', label: 'By filters' },
                { key: 'pick',    label: 'Pick individually' },
                { key: 'emails',  label: 'By email list' },
              ] as { key: UIMode; label: string }[]).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setUiMode(m.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    uiMode === m.key
                      ? 'border-[#111111] bg-[#111111] text-white'
                      : 'border-[#E5E5E5] text-muted hover:border-[#999] hover:text-[#111111]'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {/* Filters panel */}
            {uiMode === 'filters' && (
              <div className="rounded-lg border border-[#E5E5E5] bg-[#fafafa] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Event</Label>
                    <FSel value={filters.eventId} onValueChange={(v) => setFilter('eventId', v)}>
                      <SelectItem value="all">All events</SelectItem>
                      {events.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                      ))}
                    </FSel>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Payment Status</Label>
                    <FSel value={filters.status} onValueChange={(v) => setFilter('status', v as BlastFilters['status'])}>
                      <SelectItem value="all">All statuses</SelectItem>
                      <SelectItem value="verified">Verified</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                    </FSel>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Package</Label>
                    <FSel value={filters.packageId} onValueChange={(v) => setFilter('packageId', v)}>
                      <SelectItem value="all">All packages</SelectItem>
                      {visiblePackages.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </FSel>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Church</Label>
                    <Combobox
                      options={['All churches', ...churches]}
                      value={filters.church === 'all' ? 'All churches' : filters.church}
                      onChange={(v) => setFilter('church', v === 'All churches' ? 'all' : v)}
                      placeholder="All churches"
                      searchPlaceholder="Search churches..."
                      className="h-9 w-full rounded-btn border border-[#E5E5E5] bg-white text-sm text-[#111111] justify-between"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Pick individually panel */}
            {uiMode === 'pick' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    placeholder="Search name, email or church…"
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="flex-1 h-8 rounded-btn border border-[#E5E5E5] bg-white px-3 text-xs text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => setPickedEmails((prev) => {
                      const next = new Set(prev)
                      filteredContacts.forEach((c) => next.add(c.email))
                      return next
                    })}
                    className="shrink-0 rounded border border-[#E5E5E5] px-2 py-1 text-xs text-muted hover:border-[#999] hover:text-[#111111] transition-colors"
                  >
                    Select all
                  </button>
                  {pickedEmails.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setPickedEmails(new Set())}
                      className="shrink-0 rounded border border-[#E5E5E5] px-2 py-1 text-xs text-error hover:border-error/40 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="rounded-lg border border-[#E5E5E5] overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-[#E5E5E5]">
                    {filteredContacts.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-muted">No matches</p>
                    ) : filteredContacts.map((c, idx) => {
                      const checked = pickedEmails.has(c.email)
                      const isQueued = idx >= 300
                      const showDivider = idx === 300
                      return (
                        <div key={c.email}>
                          {showDivider && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-y border-amber-200">
                              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Daily limit — selections below queue for tomorrow</span>
                            </div>
                          )}
                          <label
                            className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                              isQueued && checked
                                ? 'bg-amber-50'
                                : checked
                                  ? 'bg-[#fafafa]'
                                  : isQueued
                                    ? 'hover:bg-amber-50/50'
                                    : 'hover:bg-[#fafafa]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setPickedEmails((prev) => {
                                  const next = new Set(prev)
                                  checked ? next.delete(c.email) : next.add(c.email)
                                  return next
                                })
                              }}
                              className="size-4 shrink-0 rounded border-[#E5E5E5] accent-[#111111]"
                            />
                            <span className={`mt-0.5 size-1.5 shrink-0 rounded-full ${STATUS_DOT[c.payment_status] ?? 'bg-[#ccc]'}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-xs font-medium truncate ${isQueued ? 'text-amber-700' : 'text-[#111111]'}`}>{c.full_name}</p>
                              <p className={`text-[11px] truncate ${isQueued ? 'text-amber-500' : 'text-muted'}`}>{c.email} · {c.gms_church}</p>
                            </div>
                            {isQueued && <span className="shrink-0 text-[9px] font-semibold uppercase text-amber-500 tracking-wide">Tomorrow</span>}
                          </label>
                        </div>
                      )
                    })}
                  </div>
                  <div className="border-t border-[#E5E5E5] bg-[#fafafa] px-3 py-2 flex items-center justify-between">
                    {pickedEmails.size === 0 ? (
                      <p className="text-xs text-muted">None selected</p>
                    ) : pickedEmails.size <= 300 ? (
                      <p className="text-xs font-medium text-[#111111]">{pickedEmails.size} selected &mdash; all send today</p>
                    ) : (
                      <p className="text-xs font-medium text-[#111111]">
                        300 send today &middot; <span className="text-amber-600">{pickedEmails.size - 300} queued for tomorrow</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Email list panel */}
            {uiMode === 'emails' && (
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

          {/* Keywords */}
          <div className="rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-4 py-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted">Available keywords</p>
            <div className="space-y-2">
              {([
                { tag: '{{NAME}}',     desc: "Recipient's full name" },
                { tag: '{{CHURCH}}',   desc: "Recipient's church" },
                { tag: '{{EVENT}}',    desc: 'Event name' },
                { tag: '{{DATE}}',     desc: 'Event date range' },
                { tag: '{{LOCATION}}', desc: 'Event venue / location' },
                { tag: '{{PACKAGE}}',  desc: 'Package name and price' },
                { tag: '{{TOOLKIT}}',  desc: 'Toolkit items list' },
                { tag: '{{QR}}',       desc: 'Embeds the unique QR code image. Recipients without a verified registration receive the email without it.' },
              ] as { tag: string; desc: string }[]).map(({ tag, desc }) => (
                <div key={tag} className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setBody((prev) => {
                      const appended = prev.replace('</p>', ` ${tag}</p>`)
                      return appended !== prev ? appended : `${prev}<p>${tag}</p>`
                    })}
                    className="shrink-0 rounded border border-[#E5E5E5] bg-white px-2 py-0.5 font-mono text-[11px] text-[#111111] hover:border-[#999] transition-colors"
                    title="Click to insert"
                  >
                    {tag}
                  </button>
                  <p className="text-xs text-muted leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
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
            ) : uiMode === 'pick' && pickedEmails.size > 300
              ? `Send 300 now · queue ${pickedEmails.size - 300} for tomorrow`
              : recipientCount !== null && recipientCount > 0
                ? `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`
                : 'Send'}
          </button>
        </div>
      )}

      {/* "" History "" */}
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
                  <p className="text-xs text-muted">This removes them from history only &mdash; emails already sent are not recalled.</p>
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
                          {blast.recipient_count} sent
                          {blast.status === 'partial' && blast.queued_emails && (
                            <span className="text-amber-600"> · {blast.queued_emails.length} queued</span>
                          )}
                          {' · '}{formatDateTime(blast.sent_at)}
                        </p>
                        {blast.status === 'partial' && blast.queued_emails && (
                          <div className="mt-2 space-y-1">
                            {continueError[blast.id] && (
                              <p className="text-xs text-error">{continueError[blast.id]}</p>
                            )}
                            {continueResult[blast.id] && (
                              <p className="text-xs text-success font-medium">
                                Sent {continueResult[blast.id].sent} more.
                                {continueResult[blast.id].queued > 0 && ` ${continueResult[blast.id].queued} still queued — continue tomorrow.`}
                              </p>
                            )}
                            {!continueResult[blast.id] && (
                              <button
                                type="button"
                                disabled={continuing === blast.id}
                                onClick={async () => {
                                  setContinuing(blast.id)
                                  setContinueError((prev) => ({ ...prev, [blast.id]: '' }))
                                  const res = await continueEmailBlast(blast.id)
                                  setContinuing(null)
                                  if (res.error) {
                                    setContinueError((prev) => ({ ...prev, [blast.id]: res.error! }))
                                    return
                                  }
                                  setContinueResult((prev) => ({ ...prev, [blast.id]: { sent: res.sent, queued: res.queued } }))
                                  const { getEmailBlasts } = await import('@/app/dashboard/blast/actions')
                                  setBlasts(await getEmailBlasts())
                                }}
                                className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 transition-colors"
                              >
                                {continuing === blast.id ? 'Sending…' : `Continue sending (${blast.queued_emails.length} remaining)`}
                              </button>
                            )}
                          </div>
                        )}
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


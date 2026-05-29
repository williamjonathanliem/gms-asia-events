'use client'

import { useState, useEffect, useTransition } from 'react'
import dynamic from 'next/dynamic'
import { sendEmailBlast, previewBlastRecipients, type BlastFilters, type EmailBlast } from '@/app/dashboard/blast/actions'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatDateTime } from '@/lib/utils'

// Load editor client-side only (SSR incompatible)
const RichEditor = dynamic(() => import('./RichEditor'), { ssr: false, loading: () => (
  <div className="h-[316px] animate-pulse rounded-btn border border-[#E5E5E5] bg-[#fafafa]" />
)})

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

export default function BlastClient({ events, packages, churches, initialBlasts }: Props) {
  const [tab, setTab] = useState<'compose' | 'history'>('compose')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [filters, setFilters] = useState<BlastFilters>(DEFAULT_FILTERS)
  const [recipientCount, setRecipientCount] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState<{ count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [blasts, setBlasts] = useState<EmailBlast[]>(initialBlasts)
  const [previewing, startPreview] = useTransition()

  // Filter packages by selected event
  const visiblePackages = filters.eventId === 'all'
    ? packages
    : packages.filter((p) => p.event_id === filters.eventId)

  // Re-preview whenever filters change
  useEffect(() => {
    startPreview(async () => {
      const res = await previewBlastRecipients(filters)
      setRecipientCount(res.count)
    })
  }, [filters])

  function setFilter<K extends keyof BlastFilters>(key: K, val: BlastFilters[K]) {
    setFilters((prev) => {
      const next = { ...prev, [key]: val }
      // Reset package if event changes
      if (key === 'eventId') next.packageId = 'all'
      return next
    })
  }

  async function handleSend() {
    setError(null)
    setSent(null)
    setSending(true)
    const res = await sendEmailBlast(subject, body, filters)
    setSending(false)
    if (res.error) { setError(res.error); return }
    setSent({ count: res.sent })
    setSubject('')
    setBody('')
    setFilters(DEFAULT_FILTERS)
    // Refresh history
    const { getEmailBlasts } = await import('@/app/dashboard/blast/actions')
    setBlasts(await getEmailBlasts())
  }

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

      {/* ── Compose tab ── */}
      {tab === 'compose' && (
        <div className="space-y-6 pt-6">
          {error && (
            <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">{error}</p>
          )}
          {sent && (
            <p className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-xs text-success">
              ✓ Sent to {sent.count} recipient{sent.count !== 1 ? 's' : ''} successfully.
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

          {/* Filters */}
          <div className="space-y-4 rounded-lg border border-[#E5E5E5] bg-[#fafafa] p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted">Recipients</p>
              <span className="text-xs text-muted">
                {previewing ? 'Counting…' : recipientCount !== null ? (
                  <span className={recipientCount === 0 ? 'text-error' : 'text-[#111111] font-medium'}>
                    {recipientCount} recipient{recipientCount !== 1 ? 's' : ''}
                  </span>
                ) : null}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
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

          {/* Body */}
          <div>
            <Label required>Message</Label>
            <RichEditor value={body} onChange={setBody} />
          </div>

          {/* Send */}
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !subject.trim() || !body.trim() || body === '<p></p>' || recipientCount === 0}
            className="w-full rounded-btn bg-[#111111] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {sending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                Sending…
              </span>
            ) : recipientCount !== null
              ? `Send to ${recipientCount} recipient${recipientCount !== 1 ? 's' : ''}`
              : 'Send'}
          </button>
        </div>
      )}

      {/* ── History tab ── */}
      {tab === 'history' && (
        <div className="pt-6">
          {blasts.length === 0 ? (
            <div className="rounded-lg border border-[#E5E5E5] py-16 text-center">
              <p className="text-sm text-muted">No blasts sent yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5]">
              {blasts.map((blast) => {
                const f = blast.filters
                const tags = [
                  f.eventId !== 'all' ? (events.find(e => e.id === f.eventId)?.name ?? 'Event') : 'All events',
                  f.status !== 'all' ? f.status : 'All statuses',
                  f.church !== 'all' ? f.church : null,
                  f.packageId !== 'all' ? 'Filtered package' : null,
                ].filter(Boolean) as string[]

                return (
                  <div key={blast.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#111111] truncate">{blast.subject}</p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {tags.map((tag) => (
                            <span key={tag} className="rounded border border-[#E5E5E5] bg-[#fafafa] px-1.5 py-0.5 text-xs text-muted">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-medium text-[#111111]">
                          {blast.recipient_count} recipient{blast.recipient_count !== 1 ? 's' : ''}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">{formatDateTime(blast.sent_at)}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

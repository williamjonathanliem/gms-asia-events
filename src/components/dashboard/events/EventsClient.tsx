'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'
import type { EventWithPackages } from '@/lib/types/database'
import EventDrawer from './EventDrawer'

interface Props {
  initialEvents: EventWithPackages[]
  globalChurches: string[]
}

function CopySlugButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(`${window.location.origin}/register/${slug}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Copy registration link"
      className="rounded p-1 text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
    >
      {copied ? (
        <svg className="size-3.5 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
        </svg>
      )}
    </button>
  )
}

export default function EventsClient({ initialEvents, globalChurches }: Props) {
  const router = useRouter()
  const [events, setEvents] = useState<EventWithPackages[]>(initialEvents)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  // Sync when server re-renders (after router.refresh())
  useEffect(() => { setEvents(initialEvents) }, [initialEvents])

  const selectedEvent = events.find((e) => e.id === selectedId) ?? null

  function handleEventSaved(saved: EventWithPackages) {
    setEvents((prev) => {
      const idx = prev.findIndex((e) => e.id === saved.id)
      if (idx === -1) return [saved, ...prev]
      const next = [...prev]
      next[idx] = saved
      return next
    })
    router.refresh()
  }

  function handleEventDeleted(id: string) {
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setSelectedId(null)
    router.refresh()
  }

  const drawerOpen = showNew || selectedId !== null

  return (
    <>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted">{events.length} event{events.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setSelectedId(null); setShowNew(true) }}
          className="flex items-center gap-2 rounded-btn bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          New Event
        </button>
      </div>

      {/* Events table */}
      {events.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] py-16 text-center">
          <p className="text-sm text-muted">No events yet. Create your first event.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5]">
          {events.map((event) => (
            <div
              key={event.id}
              onClick={() => { setShowNew(false); setSelectedId(event.id) }}
              className="flex w-full cursor-pointer items-center gap-4 px-5 py-4 text-left transition-colors hover:bg-[#fafafa]"
            >
              {/* Active dot */}
              <span
                className={`size-2 shrink-0 rounded-full ${
                  event.is_active ? 'bg-success' : 'bg-[#D1D1D1]'
                }`}
              />

              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#111111] truncate">{event.name}</p>
                <p className="mt-0.5 text-xs text-muted truncate">
                  {formatDate(event.date)}&ensp;·&ensp;{event.location}
                </p>
              </div>

              {/* Badges + copy */}
              <div className="flex shrink-0 items-center gap-2">
                {event.is_active && (
                  <span className="rounded-md border border-success px-2 py-0.5 text-xs font-medium text-success">
                    Active
                  </span>
                )}
                {!event.registration_open && (
                  <span className="rounded-md border border-warning px-2 py-0.5 text-xs font-medium text-warning">
                    Closed
                  </span>
                )}
                <span className="rounded-md border border-[#E5E5E5] px-2 py-0.5 text-xs font-medium text-muted">
                  {event.currency ?? 'IDR'}
                </span>
                <span className="text-xs text-muted">
                  {event.packages.length} pkg{event.packages.length !== 1 ? 's' : ''}
                </span>
                <CopySlugButton slug={event.slug} />
                <svg className="size-4 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <EventDrawer
          event={showNew ? null : selectedEvent}
          onClose={() => { setShowNew(false); setSelectedId(null) }}
          onEventSaved={handleEventSaved}
          onEventDeleted={handleEventDeleted}
          globalChurches={globalChurches}
        />
      )}
    </>
  )
}

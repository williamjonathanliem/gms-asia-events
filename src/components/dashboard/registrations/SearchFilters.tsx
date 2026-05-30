'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export interface SearchFiltersProps {
  /** Staff with event_scope cannot change event context */
  eventFilterLocked?: boolean
  eventsForPicker?: { id: string; name: string; date: string }[]
  /** Default / "current active" event when `event` query param is absent */
  activeEventId?: string | null
}

export default function SearchFilters({
  eventFilterLocked = false,
  eventsForPicker = [],
  activeEventId = null,
}: SearchFiltersProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const push = useCallback(
    (params: URLSearchParams) => {
      startTransition(() => router.push(`${pathname}?${params.toString()}`))
    },
    [router, pathname]
  )

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) params.set(key, value)
      else params.delete(key)
      params.delete('page')
      push(params)
    },
    [searchParams, push]
  )

  const updateEventFilter = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('page')
      if (value === 'all') {
        params.set('event', 'all')
      } else if (activeEventId && value === activeEventId) {
        params.delete('event')
      } else {
        params.set('event', value)
      }
      push(params)
    },
    [searchParams, push, activeEventId]
  )

  const eventSelectValue = (() => {
    const raw = searchParams.get('event')
    if (raw === 'all') return 'all'
    if (raw && UUID_RE.test(raw)) return raw
    return activeEventId ?? 'all'
  })()

  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParam('search', value), 350)
  }

  return (
    <div className={`grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:gap-3 transition-opacity ${isPending ? 'opacity-60' : ''}`}>
      {!eventFilterLocked && eventsForPicker.length > 0 && (
        <Select
          value={eventSelectValue}
          onChange={(e) => updateEventFilter(e.target.value)}
          className="w-full sm:min-w-[200px] sm:max-w-[280px]"
        >
          <option value="all">All events</option>
          {activeEventId && (
            <option value={activeEventId}>
              Active event ·{' '}
              {eventsForPicker.find((e) => e.id === activeEventId)?.name ?? '—'}
            </option>
          )}
          {eventsForPicker
            .filter((ev) => ev.id !== activeEventId)
            .map((ev) => (
              <option key={ev.id} value={ev.id}>
                {ev.name} · {formatDate(ev.date)}
              </option>
            ))}
        </Select>
      )}

      <Input
        placeholder="Search name, email, NIJ, church…"
        defaultValue={searchParams.get('search') ?? ''}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full sm:w-64"
      />

      <Select
        value={searchParams.get('status') ?? ''}
        onChange={(e) => updateParam('status', e.target.value)}
        className="w-full sm:w-40"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
      </Select>

      <Select
        value={searchParams.get('package') ?? ''}
        onChange={(e) => updateParam('package', e.target.value)}
        className="w-full sm:w-36"
      >
        <option value="">All packages</option>
        <option value="A">Package A</option>
        <option value="B">Package B</option>
        <option value="C">Package C</option>
      </Select>

      <Select
        value={searchParams.get('church') ?? ''}
        onChange={(e) => updateParam('church', e.target.value)}
        className="w-full sm:w-52"
      >
        <option value="">All churches</option>
        {GMS_CHURCHES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
    </div>
  )
}

'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useTransition, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Combobox } from '@/components/ui/combobox'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

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
  const router     = useRouter()
  const pathname   = usePathname()
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
      if (value === 'all' || value === '') {
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

  const handleSearch = (value: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => updateParam('search', value), 350)
  }

  // Build event options for the combobox
  // Value = event id (or 'all')
  // Label = event name (shown in the list)
  const eventOptions: { id: string; label: string }[] = [
    { id: 'all', label: 'All events' },
    ...eventsForPicker.map((ev) => ({
      id:    ev.id,
      label: ev.id === activeEventId
        ? `${ev.name} (active)`
        : `${ev.name} · ${formatDate(ev.date)}`,
    })),
  ]

  const currentEventId = (() => {
    const raw = searchParams.get('event')
    if (raw === 'all') return 'all'
    if (raw && UUID_RE.test(raw)) return raw
    return activeEventId ?? 'all'
  })()

  const currentEventLabel =
    eventOptions.find((o) => o.id === currentEventId)?.label ?? 'All events'

  // Combobox operates on labels (string[]) so we translate back via the options map
  const handleEventComboChange = (label: string) => {
    const opt = eventOptions.find((o) => o.label === label)
    if (opt) updateEventFilter(opt.id)
  }

  const inputCls =
    'h-9 rounded-btn border border-[#E5E5E5] bg-white px-3 text-sm text-[#111111] focus:border-[#111111] focus:outline-none transition-colors'

  return (
    <div className={cn(
      'grid grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center sm:gap-2 transition-opacity',
      isPending && 'opacity-60'
    )}>
      {/* Event picker — Combobox so long names don't truncate */}
      {!eventFilterLocked && eventsForPicker.length > 0 && (
        <div className="w-full sm:w-auto sm:min-w-[200px] sm:max-w-[260px]">
          <Combobox
            options={eventOptions.map((o) => o.label)}
            value={currentEventLabel}
            onChange={handleEventComboChange}
            placeholder="All events"
            searchPlaceholder="Search events..."
            className={cn(inputCls, 'w-full justify-between')}
          />
        </div>
      )}

      {/* Search */}
      <Input
        placeholder="Search name, email, NIJ, church..."
        defaultValue={searchParams.get('search') ?? ''}
        onChange={(e) => handleSearch(e.target.value)}
        className="w-full sm:w-56"
      />

      {/* Status */}
      <Select
        value={searchParams.get('status') ?? ''}
        onChange={(e) => updateParam('status', e.target.value)}
        className="w-full sm:w-36"
      >
        <option value="">All statuses</option>
        <option value="pending">Pending</option>
        <option value="verified">Verified</option>
        <option value="rejected">Rejected</option>
      </Select>

      {/* Package */}
      <Select
        value={searchParams.get('package') ?? ''}
        onChange={(e) => updateParam('package', e.target.value)}
        className="w-full sm:w-32"
      >
        <option value="">All packages</option>
        <option value="A">Package A</option>
        <option value="B">Package B</option>
        <option value="C">Package C</option>
      </Select>

      {/* Church */}
      <Select
        value={searchParams.get('church') ?? ''}
        onChange={(e) => updateParam('church', e.target.value)}
        className="w-full sm:w-48"
      >
        <option value="">All churches</option>
        {GMS_CHURCHES.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </Select>
    </div>
  )
}

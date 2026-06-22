'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback, useRef, useTransition, useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { GMS_CHURCHES } from '@/lib/constants'
import { formatDateRange } from '@/lib/utils'
import { cn } from '@/lib/utils'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const JAPAN_CHURCHES = ['GMS Tokyo', 'GMS Osaka', 'GMS Osaka Satellite']

// Radix Select doesn't support value="". Use 'all' as sentinel internally.
function FSel({
  value, onValueChange, className, children,
}: {
  value: string
  onValueChange: (v: string) => void
  className?: string
  children: React.ReactNode
}) {
  return (
    <Select
      value={value || 'all'}
      onValueChange={(v) => onValueChange(v === 'all' ? '' : v)}
    >
      <SelectTrigger className={cn('h-9 rounded-btn border-[#E5E5E5] text-sm text-[#111111]', className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {children}
      </SelectContent>
    </Select>
  )
}

const CHURCH_OPTIONS = ['All churches', ...GMS_CHURCHES] as string[]

export interface SearchFiltersProps {
  eventFilterLocked?: boolean
  eventsForPicker?: { id: string; name: string; date: string; end_date?: string | null }[]
  activeEventId?: string | null
  packages?: { id: string; name: string }[]
  allergiesFieldId?: string | null
  allergiesLabel?: string
}

export default function SearchFilters({
  eventFilterLocked = false,
  eventsForPicker = [],
  activeEventId = null,
  packages = [],
  allergiesFieldId = null,
  allergiesLabel = 'Dietary / Allergies',
}: SearchFiltersProps) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const secondaryCount =
    (searchParams.get('payment')   ? 1 : 0) +
    (searchParams.get('location')  ? 1 : 0) +
    (searchParams.get('package')   ? 1 : 0) +
    (searchParams.get('church')    ? 1 : 0) +
    (searchParams.get('allergies') ? 1 : 0)

  const hasSecondary = secondaryCount > 0
  const [showMore, setShowMore] = useState(hasSecondary)
  useEffect(() => { if (hasSecondary) setShowMore(true) }, [hasSecondary])

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

  const eventOptions: { id: string; label: string }[] = [
    { id: 'all', label: 'All events' },
    ...eventsForPicker.map((ev) => ({
      id:    ev.id,
      label: ev.id === activeEventId
        ? `${ev.name} (active)`
        : `${ev.name} · ${formatDateRange(ev.date, ev.end_date)}`,
    })),
  ]
  const currentEventId = (() => {
    const raw = searchParams.get('event')
    if (raw === 'all') return 'all'
    if (raw && UUID_RE.test(raw)) return raw
    return activeEventId ?? 'all'
  })()
  const currentEventLabel = eventOptions.find((o) => o.id === currentEventId)?.label ?? 'All events'
  const handleEventChange = (label: string) => {
    const opt = eventOptions.find((o) => o.label === label)
    if (opt) updateEventFilter(opt.id)
  }

  const currentChurch = searchParams.get('church') || 'All churches'
  const handleChurchChange = (v: string) => updateParam('church', v === 'All churches' ? '' : v)

  const comboboxCls = 'h-9 rounded-btn border border-[#E5E5E5] bg-white text-sm text-[#111111]'

  const clearSecondary = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('payment')
    params.delete('location')
    params.delete('package')
    params.delete('church')
    params.delete('allergies')
    params.delete('page')
    push(params)
  }

  return (
    <div className={cn('space-y-2 transition-opacity', isPending && 'opacity-60')}>

      {/* ── Primary row ── */}
      <div className="flex flex-wrap items-center gap-2">

        {!eventFilterLocked && eventsForPicker.length > 0 && (
          <div className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-[240px]">
            <Combobox
              options={eventOptions.map((o) => o.label)}
              value={currentEventLabel}
              onChange={handleEventChange}
              placeholder="All events"
              searchPlaceholder="Search events..."
              className={cn(comboboxCls, 'w-full')}
            />
          </div>
        )}

        <Input
          placeholder="Name, email, NIJ..."
          defaultValue={searchParams.get('search') ?? ''}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full sm:w-48"
        />

        <FSel
          value={searchParams.get('status') ?? ''}
          onValueChange={(v) => updateParam('status', v)}
          className="w-full sm:w-32"
        >
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="verified">Verified</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </FSel>

        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className={cn(
            'flex items-center gap-1.5 rounded-btn border px-3 h-9 text-sm transition-colors whitespace-nowrap',
            showMore || secondaryCount > 0
              ? 'border-[#111111] bg-[#111111] text-white'
              : 'border-[#E5E5E5] bg-white text-muted hover:border-[#999] hover:text-[#111111]'
          )}
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h14.25M3 9h9.75M3 13.5h5.25" />
          </svg>
          {secondaryCount > 0 ? `Filters (${secondaryCount})` : 'Filters'}
        </button>
      </div>

      {/* ── Secondary row ── */}
      {showMore && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-3 py-2.5">

          {/* Payment method */}
          <FSel
            value={searchParams.get('payment') ?? ''}
            onValueChange={(v) => updateParam('payment', v)}
            className="w-full sm:w-auto"
          >
            <SelectItem value="all">All payments</SelectItem>
            <SelectItem value="manual">Bank Transfer</SelectItem>
            <SelectItem value="stripe">Card (Stripe)</SelectItem>
          </FSel>

          {/* Japan / International */}
          <FSel
            value={searchParams.get('location') ?? ''}
            onValueChange={(v) => updateParam('location', v)}
            className="w-full sm:w-auto"
          >
            <SelectItem value="all">All regions</SelectItem>
            <SelectItem value="japan">Japan</SelectItem>
            <SelectItem value="international">International</SelectItem>
          </FSel>

          {/* Package */}
          {packages.length > 0 && (
            <FSel
              value={searchParams.get('package') ?? ''}
              onValueChange={(v) => updateParam('package', v)}
              className="w-full sm:w-auto"
            >
              <SelectItem value="all">All packages</SelectItem>
              {packages.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </FSel>
          )}

          {/* Church */}
          <Combobox
            options={CHURCH_OPTIONS}
            value={currentChurch}
            onChange={handleChurchChange}
            placeholder="All churches"
            searchPlaceholder="Search churches..."
            className={cn(comboboxCls, 'w-full sm:w-56')}
          />

          {/* Allergens */}
          {allergiesFieldId && (
            <FSel
              value={searchParams.get('allergies') ?? ''}
              onValueChange={(v) => updateParam('allergies', v)}
              className="w-full sm:w-auto"
            >
              <SelectItem value="all">Allergens — All</SelectItem>
              <SelectItem value="yes">Has allergens</SelectItem>
              <SelectItem value="no">None</SelectItem>
            </FSel>
          )}

          {secondaryCount > 0 && (
            <button
              type="button"
              onClick={clearSecondary}
              className="text-xs text-muted hover:text-error transition-colors ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      )}
    </div>
  )
}

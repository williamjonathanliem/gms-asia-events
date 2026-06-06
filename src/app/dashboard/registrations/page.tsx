import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import StatCards from '@/components/dashboard/StatCards'
import SearchFilters from '@/components/dashboard/registrations/SearchFilters'
import RegistrationsClient from '@/components/dashboard/registrations/RegistrationsClient'
import ExportButton from '@/components/dashboard/registrations/ExportButton'
import WalkinDrawerWrapper from '@/components/dashboard/registrations/WalkinDrawerWrapper'
import RefreshButton from '@/components/dashboard/registrations/RefreshButton'
import RegistrationsSkeleton from '@/components/dashboard/registrations/RegistrationsSkeleton'
import { formatDateRange } from '@/lib/utils'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import type { PaymentStatus, Package } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Registrations' }

const PAGE_SIZE = 25

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SearchParams {
  search?: string
  status?: string
  package?: string   // package id (UUID)
  church?: string
  payment?: string   // 'manual' | 'stripe'
  page?: string
  /** `all` or a specific event id; omitted = active event (unscoped staff only) */
  event?: string
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const staff = await getCurrentStaffUser()
  const scopedEventId = staff?.event_scope ?? null

  // ── Events list (event picker for staff without event_scope) ──
  let eventsForPicker: { id: string; name: string; date: string; end_date: string | null }[] = []
  if (!scopedEventId) {
    const { data: evs } = await supabase
      .from('events')
      .select('id, name, date, end_date')
      .order('date', { ascending: false })
    eventsForPicker = (evs ?? []) as { id: string; name: string; date: string; end_date: string | null }[]
  }

  // ── Resolve active event (default filter for unscoped staff) ──
  let activeEventId: string | null = null
  let activeEventName = ''
  let activeEventDate = ''
  let activeEventEndDate: string | null = null

  if (scopedEventId) {
    const { data } = await supabase
      .from('events')
      .select('id, name, date, end_date')
      .eq('id', scopedEventId)
      .single()
    activeEventId = data?.id ?? null
    activeEventName = data?.name ?? ''
    activeEventDate = data?.date ?? ''
    activeEventEndDate = data?.end_date ?? null
  } else {
    const { data: activeEvents } = await supabase
      .from('events')
      .select('id, name, date, end_date')
      .eq('is_active', true)
      .order('date', { ascending: false })
      .limit(1)
    const activeEvent = activeEvents?.[0] ?? null
    activeEventId = activeEvent?.id ?? null
    activeEventName = activeEvent?.name ?? ''
    activeEventDate = activeEvent?.date ?? ''
    activeEventEndDate = activeEvent?.end_date ?? null
  }

  // ── Which event(s) registrations query uses ───────────────────
  let queryAllEvents = false
  let filterEventId: string | null = null
  let headerTitle = ''
  let headerDate = ''
  let headerEndDate: string | null = null

  if (scopedEventId) {
    filterEventId = scopedEventId
    headerTitle = activeEventName
    headerDate = activeEventDate
    headerEndDate = activeEventEndDate
  } else {
    const urlEvent = searchParams.event
    if (urlEvent === 'all') {
      queryAllEvents = true
      headerTitle = 'All events'
    } else if (urlEvent && UUID_RE.test(urlEvent)) {
      filterEventId = urlEvent
      const ev = eventsForPicker.find((e) => e.id === urlEvent)
      headerTitle = ev?.name ?? 'Event'
      headerDate = ev?.date ?? ''
      headerEndDate = ev?.end_date ?? null
    } else {
      filterEventId = activeEventId
      if (filterEventId) {
        headerTitle = activeEventName
        headerDate = activeEventDate
        headerEndDate = activeEventEndDate
      } else {
        queryAllEvents = true
        headerTitle = 'All events'
      }
    }
  }

  const showEventColumn = !scopedEventId && queryAllEvents

  // ── Build query ───────────────────────────────────────────────
  const page = Math.max(1, Number(searchParams.page ?? 1))
  const offset = (page - 1) * PAGE_SIZE

  // Packages for walk-in drawer + package filter options
  const { data: packagesData } = filterEventId
    ? await supabase.from('packages').select('*').eq('event_id', filterEventId).order('price', { ascending: false })
    : { data: [] }
  const packages = (packagesData ?? []) as Package[]

  let eventPricing: {
    currency: string
    early_bird_enabled: boolean
    early_bird_auto_change: boolean
    early_bird_end_date: string | null
  } | null = null
  if (filterEventId) {
    const { data: evPricing } = await supabase
      .from('events')
      .select('currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date')
      .eq('id', filterEventId)
      .single()
    eventPricing = evPricing
  }

  let query = supabase
    .from('registrations')
    .select(
      `id, full_name, email, phone, gms_church, nij,
       payment_method, payment_status, payment_notes, payment_screenshot_url, qr_token,
       amount_paid, is_early_bird, created_at, package_id, custom_answers,
       events(name, date, currency, custom_fields),
       packages(name, price, toolkit_items),
       attendance_logs(scan_type, scanned_at)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (!queryAllEvents && filterEventId) {
    query = query.eq('event_id', filterEventId)
  }

  if (searchParams.search) {
    const q = searchParams.search
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,nij.ilike.%${q}%,gms_church.ilike.%${q}%`
    )
  }

  if (searchParams.status) {
    query = query.eq('payment_status', searchParams.status as PaymentStatus)
  }

  if (searchParams.church) {
    query = query.eq('gms_church', searchParams.church)
  }

  if (searchParams.payment) {
    query = query.eq('payment_method', searchParams.payment)
  }

  if (searchParams.package) {
    query = query.eq('package_id', searchParams.package)
  }

  const { data: rawData, count } = await query
  const registrations = (rawData ?? []) as any[]

  return (
    <div className="min-h-screen">
      {/* Header — sticky so event name is always visible while scrolling */}
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              {headerTitle}
              {headerDate ? ` · ${formatDateRange(headerDate, headerEndDate)}` : ''}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[#111111]">Registrations</h1>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <RefreshButton />
            <Suspense>
              <ExportButton eventId={filterEventId} />
            </Suspense>
            {filterEventId && ['super_admin', 'admin'].includes(staff?.role ?? '') && (
              <WalkinDrawerWrapper
                eventId={filterEventId}
                packages={packages}
                eventPricing={eventPricing}
              />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-5 space-y-6 sm:px-8 sm:py-6">
        {/* Stat cards */}
        {queryAllEvents ? (
          <p className="text-sm text-muted">
            Summary stats are per event. Choose one event in the filters to see totals, or stay on{' '}
            <span className="font-medium text-[#111111]">All events</span> to search across every registration.
          </p>
        ) : filterEventId ? (
          <StatCards eventId={filterEventId} />
        ) : (
          <p className="text-sm text-muted">No active event found.</p>
        )}

        {/* Search + filters */}
        <Suspense>
          <SearchFilters
            eventFilterLocked={!!scopedEventId}
            eventsForPicker={eventsForPicker}
            activeEventId={scopedEventId ? null : activeEventId}
            packages={packages.map((p) => ({ id: p.id, name: p.name }))}
          />
        </Suspense>

        {/* Total count */}
        <p className="text-xs text-muted">
          {count ?? 0} registration{count !== 1 ? 's' : ''}
          {searchParams.search ||
          searchParams.status ||
          searchParams.package ||
          searchParams.church ||
          searchParams.event
            ? ' matching filters'
            : ''}
        </p>

        {/* Table */}
        <Suspense fallback={<RegistrationsSkeleton />}>
          <RegistrationsClient
            registrations={registrations}
            total={count ?? 0}
            page={page}
            pageSize={PAGE_SIZE}
            staffRole={staff?.role ?? 'scanner'}
            showEventColumn={showEventColumn}
          />
        </Suspense>
      </div>
    </div>
  )
}

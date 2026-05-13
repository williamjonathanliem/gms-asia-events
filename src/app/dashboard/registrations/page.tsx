import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import StatCards from '@/components/dashboard/StatCards'
import SearchFilters from '@/components/dashboard/registrations/SearchFilters'
import RegistrationsClient from '@/components/dashboard/registrations/RegistrationsClient'
import ExportButton from '@/components/dashboard/registrations/ExportButton'
import WalkinDrawerWrapper from '@/components/dashboard/registrations/WalkinDrawerWrapper'
import RegistrationsSkeleton from '@/components/dashboard/registrations/RegistrationsSkeleton'
import { formatDate } from '@/lib/utils'
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
  package?: string
  church?: string
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
  let eventsForPicker: { id: string; name: string; date: string }[] = []
  if (!scopedEventId) {
    const { data: evs } = await supabase
      .from('events')
      .select('id, name, date')
      .order('date', { ascending: false })
    eventsForPicker = (evs ?? []) as { id: string; name: string; date: string }[]
  }

  // ── Resolve active event (default filter for unscoped staff) ──
  let activeEventId: string | null = null
  let activeEventName = ''
  let activeEventDate = ''

  if (scopedEventId) {
    const { data } = await supabase
      .from('events')
      .select('id, name, date')
      .eq('id', scopedEventId)
      .single()
    activeEventId = data?.id ?? null
    activeEventName = data?.name ?? ''
    activeEventDate = data?.date ?? ''
  } else {
    const { data } = await supabase
      .from('events')
      .select('id, name, date')
      .eq('is_active', true)
      .maybeSingle()
    activeEventId = data?.id ?? null
    activeEventName = data?.name ?? ''
    activeEventDate = data?.date ?? ''
  }

  // ── Which event(s) registrations query uses ───────────────────
  let queryAllEvents = false
  let filterEventId: string | null = null
  let headerTitle = ''
  let headerDate = ''

  if (scopedEventId) {
    filterEventId = scopedEventId
    headerTitle = activeEventName
    headerDate = activeEventDate
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
    } else {
      filterEventId = activeEventId
      if (filterEventId) {
        headerTitle = activeEventName
        headerDate = activeEventDate
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

  let query = supabase
    .from('registrations')
    .select(
      `id, full_name, email, phone, gms_church, nij,
       payment_status, payment_notes, payment_screenshot_url, qr_token, created_at, package_id,
       events(name, date),
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

  // Package filter: match by package name (A/B/C) via nested filter
  // We filter after fetch since Supabase can't filter on a joined column directly
  // Packages for walk-in drawer
  const { data: packagesData } = filterEventId
    ? await supabase.from('packages').select('*').eq('event_id', filterEventId).order('price', { ascending: false })
    : { data: [] }
  const packages = (packagesData ?? []) as Package[]

  const { data: rawData, count } = await query

  let registrations = (rawData ?? []) as any[]

  if (searchParams.package) {
    registrations = registrations.filter(
      (r) => r.packages?.name === searchParams.package
    )
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-[#E5E5E5] px-4 py-5 sm:px-8 sm:py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted">
              {headerTitle}
              {headerDate ? ` · ${formatDate(headerDate)}` : ''}
            </p>
            <h1 className="mt-1 text-xl font-semibold text-[#111111]">Registrations</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <Suspense>
              <ExportButton eventId={filterEventId} />
            </Suspense>
            {filterEventId && ['super_admin', 'admin'].includes(staff?.role ?? '') && (
              <WalkinDrawerWrapper eventId={filterEventId} packages={packages} />
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
            staffRole={staff?.role ?? 'viewer'}
            showEventColumn={showEventColumn}
          />
        </Suspense>
      </div>
    </div>
  )
}

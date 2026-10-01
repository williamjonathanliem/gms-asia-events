import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { getGlobalChurches } from '@/app/dashboard/settings/actions'
import StatCards from '@/components/dashboard/StatCards'
import SearchFilters from '@/components/dashboard/registrations/SearchFilters'
import RegistrationsClient from '@/components/dashboard/registrations/RegistrationsClient'
import ExportButton from '@/components/dashboard/registrations/ExportButton'
import WalkinDrawerWrapper from '@/components/dashboard/registrations/WalkinDrawerWrapper'
import RefreshButton from '@/components/dashboard/registrations/RefreshButton'
import RegistrationsSkeleton from '@/components/dashboard/registrations/RegistrationsSkeleton'
import AllergensClient from '@/components/dashboard/allergens/AllergensClient'
import { formatDateRange } from '@/lib/utils'
import { Suspense } from 'react'
import type { Metadata } from 'next'
import type { PaymentStatus, Package, CustomField } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Registrations' }

const PAGE_SIZE = 25

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

interface SearchParams {
  search?: string
  status?: string
  package?: string     // package id (UUID)
  church?: string
  payment?: string     // 'manual' | 'stripe'
  location?: string    // 'japan' | 'international'
  allergies?: string   // 'yes' | 'no'
  page?: string
  /** `all` or a specific event id; omitted = active event (unscoped staff only) */
  event?: string
  tab?: string         // 'allergens'
}

export default async function RegistrationsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = createClient()
  const staff = await getCurrentStaffUser()
  const scopedEventId = staff?.event_scope ?? null

  // ── Events — one query covers both the picker and the active-event lookup ──
  let eventsForPicker: { id: string; name: string; date: string; end_date: string | null; is_active: boolean }[] = []
  let activeEventId: string | null = null
  let activeEventName = ''
  let activeEventDate = ''
  let activeEventEndDate: string | null = null

  if (scopedEventId) {
    const { data } = await supabase
      .from('events')
      .select('id, name, date, end_date, is_active')
      .eq('id', scopedEventId)
      .single()
    activeEventId = data?.id ?? null
    activeEventName = data?.name ?? ''
    activeEventDate = data?.date ?? ''
    activeEventEndDate = data?.end_date ?? null
  } else {
    const { data: evs } = await supabase
      .from('events')
      .select('id, name, date, end_date, is_active')
      .order('date', { ascending: false })
    eventsForPicker = (evs ?? []) as typeof eventsForPicker
    const activeEvent = eventsForPicker.find((e) => e.is_active) ?? null
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

  // Packages, churches, and event pricing all run in parallel
  const [{ data: packagesData }, dynamicChurches, { data: evPricingData }] = await Promise.all([
    filterEventId
      ? supabase.from('packages').select('*').eq('event_id', filterEventId).order('price', { ascending: false })
      : Promise.resolve({ data: [] as Package[] }),
    getGlobalChurches(),
    filterEventId
      ? supabase.from('events').select('currency, early_bird_enabled, early_bird_auto_change, early_bird_end_date, custom_fields').eq('id', filterEventId).single()
      : Promise.resolve({ data: null }),
  ])
  const packages = (packagesData ?? []) as Package[]

  let eventPricing: {
    currency: string
    early_bird_enabled: boolean
    early_bird_auto_change: boolean
    early_bird_end_date: string | null
  } | null = evPricingData as any ?? null

  let allergiesFieldId: string | null = null
  let allergiesLabel = 'Dietary / Allergies'
  if (evPricingData) {
    const evCustomFields = (((evPricingData as any)?.custom_fields) ?? []) as CustomField[]
    const allergiesField = evCustomFields.find((f) => /allerg|dietary|food/i.test(f.label))
    if (allergiesField) {
      allergiesFieldId = allergiesField.id
      allergiesLabel = allergiesField.label
    }
  }

  // ── Allergens tab data ───────────────────────────────────────
  const activeTab = searchParams.tab ?? 'registrations'
  let allergenRows: { full_name: string; email: string; gms_church: string; package_name: string; answer: string }[] = []

  if (activeTab === 'allergens' && filterEventId && allergiesFieldId) {
    const { data: aRegs } = await supabase
      .from('registrations')
      .select('full_name, email, gms_church, custom_answers, packages(name)')
      .eq('event_id', filterEventId)
      .eq('payment_status', 'verified')
      .not(`custom_answers->>${allergiesFieldId}`, 'is', null)
      .neq(`custom_answers->>${allergiesFieldId}`, '')
      .order('full_name')

    allergenRows = (aRegs ?? [])
      .map((r: any) => ({
        full_name:    r.full_name,
        email:        r.email,
        gms_church:   r.gms_church ?? '',
        package_name: r.packages?.name ?? '',
        answer:       (r.custom_answers?.[allergiesFieldId!] ?? '') as string,
      }))
      .filter((r) => r.answer.trim() !== '')
  }

  // Only join events when showing cross-event list — skipping it saves significant query time
  const registrationsSelect = queryAllEvents
    ? `id, full_name, email, phone, gms_church, nij,
       payment_method, payment_status, payment_notes, payment_screenshot_url, qr_token,
       amount_paid, is_early_bird, created_at, package_id, custom_answers,
       events(name, date, currency, custom_fields),
       packages(name, price, toolkit_items),
       attendance_logs(scan_type, scanned_at)`
    : `id, full_name, email, phone, gms_church, nij,
       payment_method, payment_status, payment_notes, payment_screenshot_url, qr_token,
       amount_paid, is_early_bird, created_at, package_id, custom_answers,
       packages(name, price, toolkit_items),
       attendance_logs(scan_type, scanned_at)`

  let query = supabase
    .from('registrations')
    .select(registrationsSelect, { count: 'exact' })
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

  if (searchParams.location === 'japan') {
    query = query.or('gms_church.ilike.%tokyo%,gms_church.ilike.%osaka%')
  } else if (searchParams.location === 'international') {
    query = query.not('gms_church', 'ilike', '%tokyo%').not('gms_church', 'ilike', '%osaka%')
  }

  if (searchParams.package) {
    query = query.eq('package_id', searchParams.package)
  }

  if (searchParams.allergies && allergiesFieldId) {
    if (searchParams.allergies === 'yes') {
      // custom_answers has the field and it is non-empty
      query = query
        .not(`custom_answers->>${allergiesFieldId}`, 'is', null)
        .neq(`custom_answers->>${allergiesFieldId}`, '')
    } else if (searchParams.allergies === 'no') {
      // custom_answers field is missing or empty
      query = query.or(
        `custom_answers->>${allergiesFieldId}.is.null,custom_answers->>${allergiesFieldId}.eq.`
      )
    }
  }

  const { data: rawData, count } = await query
  const registrations = (rawData ?? []) as any[]

  return (
    <div className="min-h-screen">
      {/* Header — sticky so event name is always visible while scrolling */}
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-3 sm:px-8 sm:py-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="hidden sm:block text-xs font-medium uppercase tracking-widest text-muted">
              {headerTitle}
              {headerDate ? ` · ${formatDateRange(headerDate, headerEndDate)}` : ''}
            </p>
            <h1 className="text-lg font-semibold text-[#111111] sm:mt-1 sm:text-xl">
              {activeTab === 'allergens' ? 'Allergens' : 'Registrations'}
            </h1>
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
                churches={dynamicChurches}
              />
            )}
          </div>
        </div>
      </div>

      {/* Tab bar — only when a single event is selected and it has a dietary field */}
      {allergiesFieldId && filterEventId && (
        <div className="border-b border-[#E5E5E5] px-4 sm:px-8">
          <div className="flex gap-0">
            {[
              { key: 'registrations', label: 'Registrations' },
              { key: 'allergens',     label: 'Allergens'      },
            ].map(({ key, label }) => (
              <a
                key={key}
                href={`?${new URLSearchParams({ ...(searchParams.event ? { event: searchParams.event } : {}), tab: key === 'registrations' ? '' : key }).toString().replace(/tab=$/, '').replace(/&tab=$/, '')}`}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === key
                    ? 'border-[#111111] text-[#111111]'
                    : 'border-transparent text-muted hover:text-[#111111]'
                }`}
              >
                {label}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-5 space-y-6 sm:px-8 sm:py-6">
        {activeTab === 'allergens' ? (
          <AllergensClient
            allergenLabel={allergiesLabel}
            rows={allergenRows}
          />
        ) : (
          <>
            {/* Stat cards */}
            {queryAllEvents ? (
              <p className="text-sm text-muted">
                Summary stats are per event. Choose one event in the filters to see totals, or stay on{' '}
                <span className="font-medium text-[#111111]">All events</span> to search across every registration.
              </p>
            ) : filterEventId ? (
              <Suspense fallback={
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="rounded-lg border border-[#E5E5E5] px-5 py-4 animate-pulse">
                      <div className="h-3 w-20 rounded bg-[#E5E5E5]" />
                      <div className="mt-2 h-8 w-16 rounded bg-[#E5E5E5]" />
                    </div>
                  ))}
                </div>
              }>
                <StatCards eventId={filterEventId} />
              </Suspense>
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
                allergiesFieldId={allergiesFieldId}
                allergiesLabel={allergiesLabel}
                churches={dynamicChurches}
              />
            </Suspense>

            {/* Total count */}
            <p className="text-xs text-muted">
              {count ?? 0} registration{count !== 1 ? 's' : ''}
              {searchParams.search ||
              searchParams.status ||
              searchParams.package ||
              searchParams.church ||
              searchParams.event ||
              searchParams.payment ||
              searchParams.location ||
              searchParams.allergies
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
                churches={dynamicChurches}
              />
            </Suspense>
          </>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useId } from 'react'
import { slugify } from '@/lib/utils'
import {
  createEvent,
  updateEvent,
  deleteEvent,
} from '@/app/dashboard/events/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { EVENT_CURRENCIES, DEFAULT_EVENT_CURRENCY } from '@/lib/currencies'
import { cn } from '@/lib/utils'
import PackageEditor from './PackageEditor'
import CustomFieldsBuilder from './CustomFieldsBuilder'
import CoreFieldsEditor from './CoreFieldsEditor'
import type { EventWithPackages, CustomField, CoreField, Package } from '@/lib/types/database'

type Tab = 'details' | 'packages' | 'fields'

interface Props {
  event: EventWithPackages | null // null = new event
  onClose: () => void
  onEventSaved: (event: EventWithPackages) => void
  onEventDeleted: (id: string) => void
}

// ── Copy link button ──────────────────────────────────────────
function CopyLinkButton({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    const url = `${window.location.origin}/register/${slug}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!slug) return null

  const url = `${typeof window !== 'undefined' ? window.location.origin : ''}/register/${slug}`

  return (
    <div className="flex items-center gap-2 rounded-lg border border-[#E5E5E5] bg-[#fafafa] px-3 py-2">
      <span className="flex-1 truncate font-mono text-xs text-muted">
        /register/{slug}
      </span>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors hover:bg-white border border-[#E5E5E5] text-[#111111]"
      >
        {copied ? 'Copied ✓' : 'Copy Link'}
      </button>
    </div>
  )
}

// ── Toggle switch ─────────────────────────────────────────────
function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm font-medium text-[#111111]">{label}</p>
        {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-[#111111] focus:ring-offset-2',
          checked ? 'bg-[#111111]' : 'bg-[#D1D1D1]'
        )}
      >
        <span
          className={cn(
            'pointer-events-none inline-block size-4 rounded-full bg-white shadow transition-transform',
            checked ? 'translate-x-4' : 'translate-x-0'
          )}
        />
      </button>
    </div>
  )
}

// ── Main drawer ───────────────────────────────────────────────
export default function EventDrawer({ event, onClose, onEventSaved, onEventDeleted }: Props) {
  const isNew = event === null
  const [tab, setTab] = useState<Tab>('details')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Local state for detail fields
  const [name, setName] = useState(event?.name ?? '')
  const [slug, setSlug] = useState(event?.slug ?? '')
  const [slugTouched, setSlugTouched] = useState(false)
  const [date, setDate] = useState(event?.date ?? '')
  const [location, setLocation] = useState(event?.location ?? '')
  const [formTitle, setFormTitle] = useState(event?.form_title ?? '')
  const [formSubtitle, setFormSubtitle] = useState(event?.form_subtitle ?? '')
  const [isActive, setIsActive] = useState(event?.is_active ?? false)
  const [regOpen, setRegOpen] = useState(event?.registration_open ?? true)
  const [earlyBirdEnabled, setEarlyBirdEnabled] = useState(event?.early_bird_enabled ?? false)
  const [earlyBirdAutoChange, setEarlyBirdAutoChange] = useState(event?.early_bird_auto_change ?? true)
  const [earlyBirdEndDate, setEarlyBirdEndDate] = useState(event?.early_bird_end_date ?? '')
  const [currency, setCurrency] = useState(
    event?.currency ?? DEFAULT_EVENT_CURRENCY
  )

  // Local packages + fields for sub-editors
  const [localPackages, setLocalPackages] = useState<Package[]>(event?.packages ?? [])
  const [localFields, setLocalFields] = useState<CustomField[]>(event?.custom_fields ?? [])
  const [localCoreFields, setLocalCoreFields] = useState<CoreField[] | null>(event?.core_fields ?? null)

  // Auto-derive slug from name if user hasn't manually edited it
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(name))
  }, [name, slugTouched])

  async function handleSaveDetails() {
    setError(null)
    if (!name.trim() || !date || !location.trim() || !slug.trim()) {
      setError('Name, slug, date, and location are required.')
      return
    }
    if (earlyBirdEnabled && earlyBirdAutoChange && !earlyBirdEndDate) {
      setError('Early bird end date is required when Auto change is enabled.')
      return
    }

    setSaving(true)
    if (isNew) {
      const res = await createEvent({
        name,
        slug,
        date,
        location,
        form_title: formTitle || undefined,
        form_subtitle: formSubtitle || undefined,
        currency,
      })
      setSaving(false)
      if (res.error) { setError(res.error); return }
      onEventSaved(res.event!)
      onClose()
    } else {
      const res = await updateEvent(event.id, {
        name,
        slug,
        date,
        location,
        form_title: formTitle || null,
        form_subtitle: formSubtitle || null,
        is_active: isActive,
        registration_open: regOpen,
        early_bird_enabled: earlyBirdEnabled,
        early_bird_auto_change: earlyBirdAutoChange,
        early_bird_end_date: earlyBirdEnabled && earlyBirdEndDate ? earlyBirdEndDate : null,
        currency,
      })
      setSaving(false)
      if (res.error) { setError(res.error); return }
      onEventSaved({
        ...event,
        name,
        slug,
        date,
        location,
        form_title: formTitle || null,
        form_subtitle: formSubtitle || null,
        is_active: isActive,
        registration_open: regOpen,
        early_bird_enabled: earlyBirdEnabled,
        early_bird_auto_change: earlyBirdAutoChange,
        early_bird_end_date: earlyBirdEnabled && earlyBirdEndDate ? earlyBirdEndDate : null,
        currency,
        packages: localPackages,
        custom_fields: localFields,
      })
    }
  }

  async function handleDelete() {
    if (!event) return
    setDeleting(true)
    const res = await deleteEvent(event.id)
    setDeleting(false)
    if (res.error) { setError(res.error); return }
    onEventDeleted(event.id)
    onClose()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Details' },
    { key: 'packages', label: `Packages (${localPackages.length})` },
    { key: 'fields', label: 'Form Fields' },
  ]

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5E5] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#111111]">
            {isNew ? 'New Event' : event.name}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs (only for existing events) */}
        {!isNew && (
          <div className="flex shrink-0 border-b border-[#E5E5E5] px-6">
            {tabs.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={cn(
                  'border-b-2 px-1 pb-3 pt-3 text-xs font-medium transition-colors mr-5',
                  tab === key
                    ? 'border-[#111111] text-[#111111]'
                    : 'border-transparent text-muted hover:text-[#111111]'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Details tab ── */}
          {(isNew || tab === 'details') && (
            <div className="space-y-5 px-6 py-6">
              {error && (
                <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
                  {error}
                </p>
              )}

              <div>
                <Label htmlFor="ev-name" required>Event Name</Label>
                <Input
                  id="ev-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="GMS Asia Conference 2026"
                />
              </div>

              <div>
                <Label htmlFor="ev-slug" required>
                  URL Slug&ensp;
                  <span className="font-normal text-muted">
                    (used in /register/
                    <strong className="text-[#111111]">{slug || '…'}</strong>
                    )
                  </span>
                </Label>
                <Input
                  id="ev-slug"
                  value={slug}
                  onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')) }}
                  placeholder="gms-asia-2026"
                />
                {!isNew && slug && <CopyLinkButton slug={slug} />}
                {!isNew && (
                  <p className="mt-1 text-xs text-warning">
                    Changing the slug breaks existing registration links.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ev-date" required>Date</Label>
                  <Input
                    id="ev-date"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="ev-location" required>Location</Label>
                  <Input
                    id="ev-location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Convention Centre"
                  />
                </div>
              </div>

              <div className="border-t border-[#E5E5E5] pt-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                  Registration Form
                </p>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="ev-ftitle">
                      Form Heading&ensp;
                      <span className="font-normal text-muted">(defaults to event name)</span>
                    </Label>
                    <Input
                      id="ev-ftitle"
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder={name || 'Event Registration'}
                    />
                  </div>
                  <div>
                    <Label htmlFor="ev-currency" required>Registration currency</Label>
                    <Select
                      id="ev-currency"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                    >
                      {EVENT_CURRENCIES.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.label}
                        </option>
                      ))}
                    </Select>
                    <p className="mt-1 text-xs text-muted">
                      Package prices and payment amounts for this event are set in this currency.
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="ev-fsub">Form Description</Label>
                    <textarea
                      id="ev-fsub"
                      value={formSubtitle}
                      onChange={(e) => setFormSubtitle(e.target.value)}
                      rows={2}
                      placeholder="Brief description shown below the heading…"
                      className="w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent resize-none"
                    />
                  </div>
                </div>
              </div>

              {/* Toggles (edit only) */}
              {!isNew && (
                <div className="space-y-4 border-t border-[#E5E5E5] pt-5">
                  <Toggle
                    checked={isActive}
                    onChange={setIsActive}
                    label="Active Event"
                    description="Marks this as the current event for scanner and dashboards. Only one event can be active."
                  />
                  <Toggle
                    checked={regOpen}
                    onChange={setRegOpen}
                    label="Registration Open"
                    description="When off, the public registration form shows a 'closed' message."
                  />
                </div>
              )}

              {/* Early bird (edit only) */}
              {!isNew && (
                <div className="space-y-4 border-t border-[#E5E5E5] pt-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted">
                    Early Bird Pricing
                  </p>
                  <Toggle
                    checked={earlyBirdEnabled}
                    onChange={(v) => {
                      setEarlyBirdEnabled(v)
                      if (!v) setEarlyBirdEndDate('')
                    }}
                    label="Early Bird"
                    description="Offer discounted package prices before the regular rate applies."
                  />
                  {earlyBirdEnabled && (
                    <div className="space-y-4 rounded-lg border border-[#E5E5E5] bg-[#fafafa] p-4">
                      <Toggle
                        checked={earlyBirdAutoChange}
                        onChange={setEarlyBirdAutoChange}
                        label="Auto change"
                        description="Automatically switch to regular pricing after the end date. When off, pricing stays early bird until you disable it above."
                      />
                      <div>
                        <Label htmlFor="ev-eb-end" required={earlyBirdAutoChange}>
                          Early bird end date
                        </Label>
                        <Input
                          id="ev-eb-end"
                          type="date"
                          value={earlyBirdEndDate}
                          onChange={(e) => setEarlyBirdEndDate(e.target.value)}
                        />
                        <p className="mt-1 text-xs text-muted">
                          {earlyBirdAutoChange
                            ? 'Last day early bird pricing applies (inclusive).'
                            : 'Shown in emails as the promotional end date; pricing follows the Early Bird toggle until you turn it off.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Save button */}
              <button
                type="button"
                onClick={handleSaveDetails}
                disabled={saving}
                className="w-full rounded-btn bg-[#111111] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
              >
                {saving ? 'Saving…' : isNew ? 'Create Event' : 'Save Details'}
              </button>

              {/* Delete */}
              {!isNew && (
                <div className="border-t border-[#E5E5E5] pt-4">
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="w-full rounded-btn border border-error/40 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5"
                    >
                      Delete Event
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-muted text-center">
                        This will permanently delete the event and all its data. Are you sure?
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          className="flex-1 rounded-btn border border-[#E5E5E5] py-2 text-sm text-muted hover:bg-[#fafafa]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="flex-1 rounded-btn bg-error py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
                        >
                          {deleting ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Packages tab ── */}
          {!isNew && tab === 'packages' && (
            <PackageEditor
              eventId={event.id}
              packages={localPackages}
              currency={currency}
              earlyBirdEnabled={earlyBirdEnabled}
              onChange={setLocalPackages}
            />
          )}

          {/* ── Form Fields tab ── */}
          {!isNew && tab === 'fields' && (
            <div className="space-y-0">
              {/* Core fields section */}
              <div className="px-6 py-5 border-b border-[#E5E5E5]">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                  Core Fields
                </p>
                <CoreFieldsEditor
                  eventId={event.id}
                  fields={localCoreFields}
                  onChange={setLocalCoreFields}
                />
              </div>

              {/* Custom fields section */}
              <div className="px-6 py-5">
                <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted">
                  Additional Fields
                </p>
                <CustomFieldsBuilder
                  eventId={event.id}
                  fields={localFields}
                  onChange={setLocalFields}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

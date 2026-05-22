'use client'

import { useState } from 'react'
import { createPackage, updatePackage, deletePackage } from '@/app/dashboard/events/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatCurrency } from '@/lib/utils'
import type { Package } from '@/lib/types/database'

interface Props {
  eventId: string
  packages: Package[]
  currency: string
  earlyBirdEnabled: boolean
  onChange: (packages: Package[]) => void
}

// ── Toolkit items inline editor ───────────────────────────────
function ToolkitItemsEditor({
  items,
  onChange,
}: {
  items: string[]
  onChange: (items: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (trimmed && !items.includes(trimmed)) {
      onChange([...items, trimmed])
      setDraft('')
    }
  }

  return (
    <div className="space-y-2">
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <span className="size-1.5 shrink-0 rounded-full bg-[#111111]" />
            <span className="flex-1 text-[#111111]">{item}</span>
            <button
              type="button"
              onClick={() => onChange(items.filter((_, j) => j !== i))}
              className="shrink-0 text-muted hover:text-error transition-colors"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </li>
        ))}
        {items.length === 0 && (
          <li className="text-xs text-muted italic">No items yet</li>
        )}
      </ul>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add toolkit item…"
          className="text-xs"
        />
        <button
          type="button"
          onClick={add}
          disabled={!draft.trim()}
          className="shrink-0 rounded-btn bg-[#111111] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Single package card ───────────────────────────────────────
function PackageCard({
  pkg,
  currency,
  earlyBirdEnabled,
  onSaved,
  onDeleted,
}: {
  pkg: Package
  currency: string
  earlyBirdEnabled: boolean
  onSaved: (updated: Package) => void
  onDeleted: (id: string) => void
}) {
  const [name, setName] = useState(pkg.name)
  const [price, setPrice] = useState(String(pkg.price))
  const [earlyBirdPrice, setEarlyBirdPrice] = useState(
    pkg.early_bird_price != null ? String(pkg.early_bird_price) : ''
  )
  const [items, setItems] = useState<string[]>(pkg.toolkit_items)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const ebNum = earlyBirdPrice === '' ? null : Number(earlyBirdPrice)
  const dirty =
    name !== pkg.name ||
    Number(price) !== pkg.price ||
    ebNum !== pkg.early_bird_price ||
    JSON.stringify(items) !== JSON.stringify(pkg.toolkit_items)

  async function handleSave() {
    if (!name.trim()) { setError('Name is required'); return }
    const priceNum = Number(price)
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid regular price'); return }
    let earlyBirdPriceVal: number | null = null
    if (earlyBirdEnabled) {
      if (earlyBirdPrice === '') {
        setError('Early bird price is required while early bird is enabled')
        return
      }
      earlyBirdPriceVal = Number(earlyBirdPrice)
      if (isNaN(earlyBirdPriceVal) || earlyBirdPriceVal < 0) {
        setError('Enter a valid early bird price')
        return
      }
      if (earlyBirdPriceVal >= priceNum) {
        setError('Early bird price must be lower than regular price')
        return
      }
    }
    setError(null)
    setSaving(true)
    const res = await updatePackage(pkg.id, {
      name: name.trim(),
      price: priceNum,
      early_bird_price: earlyBirdEnabled ? earlyBirdPriceVal : null,
      toolkit_items: items,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSaved({
      ...pkg,
      name: name.trim(),
      price: priceNum,
      early_bird_price: earlyBirdEnabled ? earlyBirdPriceVal : null,
      toolkit_items: items,
    })
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await deletePackage(pkg.id)
    setDeleting(false)
    if (res.error) { setError(res.error); return }
    onDeleted(pkg.id)
  }

  return (
    <div className="space-y-4 rounded-lg border border-[#E5E5E5] p-4">
      {error && <p className="text-xs text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`pkg-name-${pkg.id}`} required>Package Name</Label>
          <Input
            id={`pkg-name-${pkg.id}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Package A"
          />
        </div>
        <div>
          <Label htmlFor={`pkg-price-${pkg.id}`} required>Regular Price ({currency})</Label>
          <Input
            id={`pkg-price-${pkg.id}`}
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="500000"
          />
        </div>
        {earlyBirdEnabled && (
          <div className="col-span-2">
            <Label htmlFor={`pkg-eb-${pkg.id}`} required>Early Bird Price ({currency})</Label>
            <Input
              id={`pkg-eb-${pkg.id}`}
              type="number"
              min="0"
              value={earlyBirdPrice}
              onChange={(e) => setEarlyBirdPrice(e.target.value)}
              placeholder="400000"
            />
          </div>
        )}
      </div>

      <div>
        <Label>Toolkit Items</Label>
        <ToolkitItemsEditor items={items} onChange={setItems} />
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        {/* Delete */}
        {!confirmDelete ? (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-muted hover:text-error transition-colors"
          >
            Delete
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Sure?</span>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-muted hover:text-[#111111]"
            >
              No
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs font-medium text-error hover:opacity-70 disabled:opacity-40"
            >
              {deleting ? 'Deleting…' : 'Yes, Delete'}
            </button>
          </div>
        )}

        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-btn bg-[#111111] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40 transition-opacity hover:opacity-80"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Package'}
        </button>
      </div>
    </div>
  )
}

// ── New package form ──────────────────────────────────────────
function NewPackageForm({
  eventId,
  currency,
  earlyBirdEnabled,
  onCreated,
  onCancel,
}: {
  eventId: string
  currency: string
  earlyBirdEnabled: boolean
  onCreated: (pkg: Package) => void
  onCancel: () => void
}) {
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [earlyBirdPrice, setEarlyBirdPrice] = useState('')
  const [items, setItems] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate() {
    if (!name.trim()) { setError('Name is required'); return }
    const priceNum = Number(price)
    if (isNaN(priceNum) || priceNum < 0) { setError('Enter a valid regular price'); return }
    let earlyBirdPriceVal: number | null = null
    if (earlyBirdEnabled) {
      if (!earlyBirdPrice) { setError('Early bird price is required'); return }
      earlyBirdPriceVal = Number(earlyBirdPrice)
      if (isNaN(earlyBirdPriceVal) || earlyBirdPriceVal >= priceNum) {
        setError('Early bird price must be lower than regular price')
        return
      }
    }
    setError(null)
    setSaving(true)
    const res = await createPackage({
      event_id: eventId,
      name: name.trim(),
      price: priceNum,
      early_bird_price: earlyBirdEnabled ? earlyBirdPriceVal : null,
      toolkit_items: items,
    })
    setSaving(false)
    if (res.error) { setError(res.error); return }
    onCreated(res.pkg!)
  }

  return (
    <div className="space-y-4 rounded-lg border-2 border-dashed border-[#E5E5E5] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">New Package</p>

      {error && <p className="text-xs text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="new-pkg-name" required>Package Name</Label>
          <Input
            id="new-pkg-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Package A"
          />
        </div>
        <div>
          <Label htmlFor="new-pkg-price" required>Regular Price ({currency})</Label>
          <Input
            id="new-pkg-price"
            type="number"
            min="0"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="500000"
          />
        </div>
        {earlyBirdEnabled && (
          <div className="col-span-2">
            <Label htmlFor="new-pkg-eb" required>Early Bird Price ({currency})</Label>
            <Input
              id="new-pkg-eb"
              type="number"
              min="0"
              value={earlyBirdPrice}
              onChange={(e) => setEarlyBirdPrice(e.target.value)}
              placeholder="400000"
            />
          </div>
        )}
      </div>

      <div>
        <Label>Toolkit Items</Label>
        <ToolkitItemsEditor items={items} onChange={setItems} />
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-btn border border-[#E5E5E5] py-2 text-sm text-muted hover:bg-[#fafafa]"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleCreate}
          disabled={saving}
          className="flex-1 rounded-btn bg-[#111111] py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
        >
          {saving ? 'Creating…' : 'Create Package'}
        </button>
      </div>
    </div>
  )
}

// ── Package editor root ───────────────────────────────────────
export default function PackageEditor({ eventId, packages, currency, earlyBirdEnabled, onChange }: Props) {
  const [showNew, setShowNew] = useState(false)

  function handleSaved(updated: Package) {
    onChange(packages.map((p) => (p.id === updated.id ? updated : p)))
  }

  function handleDeleted(id: string) {
    onChange(packages.filter((p) => p.id !== id))
  }

  function handleCreated(pkg: Package) {
    onChange([...packages, pkg])
    setShowNew(false)
  }

  return (
    <div className="space-y-4 px-6 py-6">
      {packages.length === 0 && !showNew && (
        <p className="text-center text-sm text-muted py-4">No packages yet.</p>
      )}

      {earlyBirdEnabled && (
        <p className="text-xs text-muted px-1">
          Set both regular and early bird prices per package. Save each package after editing.
        </p>
      )}

      {packages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          currency={currency}
          earlyBirdEnabled={earlyBirdEnabled}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ))}

      {showNew ? (
        <NewPackageForm
          eventId={eventId}
          currency={currency}
          earlyBirdEnabled={earlyBirdEnabled}
          onCreated={handleCreated}
          onCancel={() => setShowNew(false)}
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNew(true)}
          className="flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-[#E5E5E5] py-3 text-sm text-muted transition-colors hover:border-[#999999] hover:text-[#111111]"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Add Package
        </button>
      )}
    </div>
  )
}

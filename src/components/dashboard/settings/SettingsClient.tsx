'use client'

import { useState } from 'react'
import { updateGlobalChurches } from '@/app/dashboard/settings/actions'
import { Input } from '@/components/ui/input'

interface Props {
  initialChurches: string[]
}

export default function SettingsClient({ initialChurches }: Props) {
  const [churches, setChurches] = useState<string[]>(initialChurches)
  const [draft,    setDraft]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  function addChurch() {
    const t = draft.trim()
    if (!t || churches.includes(t)) return
    setChurches([...churches, t])
    setDraft('')
  }

  function removeChurch(i: number) {
    setChurches(churches.filter((_, j) => j !== i))
  }

  function move(from: number, to: number) {
    const next = [...churches]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setChurches(next)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await updateGlobalChurches(churches)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#111111]">GMS Church Branches</p>
          <p className="mt-0.5 text-xs text-muted">
            Default dropdown options for the Church Branch field on registration forms.
            Changes apply to all events that haven&apos;t overridden their own options.
          </p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-btn bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40"
        >
          {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      {error && (
        <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
          {error}
        </p>
      )}

      <div className="divide-y divide-[#E5E5E5] rounded-lg border border-[#E5E5E5]">
        {churches.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No branches yet. Add one below.
          </p>
        )}
        {churches.map((church, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="flex flex-col gap-0.5">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => move(i, i - 1)}
                className="rounded p-0.5 text-muted hover:text-[#111111] disabled:opacity-20"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                type="button"
                disabled={i === churches.length - 1}
                onClick={() => move(i, i + 1)}
                className="rounded p-0.5 text-muted hover:text-[#111111] disabled:opacity-20"
              >
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>

            <span className="flex-1 text-sm text-[#111111]">{church}</span>

            <button
              type="button"
              onClick={() => removeChurch(i)}
              className="rounded p-1.5 text-muted hover:bg-error/5 hover:text-error transition-colors"
            >
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
              </svg>
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addChurch() } }}
          placeholder="e.g. GMS Singapore"
        />
        <button
          type="button"
          onClick={addChurch}
          disabled={!draft.trim()}
          className="shrink-0 rounded-btn bg-[#111111] px-4 py-2 text-sm font-medium text-white disabled:opacity-40 hover:opacity-80"
        >
          Add
        </button>
      </div>

      <p className="text-xs text-muted">
        {churches.length} branch{churches.length !== 1 ? 'es' : ''} · Reorder with the arrows, remove with the trash icon.
      </p>
    </section>
  )
}

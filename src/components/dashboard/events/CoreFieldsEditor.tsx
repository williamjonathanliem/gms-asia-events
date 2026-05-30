'use client'

import { useState } from 'react'
import { updateCoreFields } from '@/app/dashboard/events/actions'
import { Input } from '@/components/ui/input'
import { resolveCoreFields } from '@/lib/types/database'
import type { CoreField, CoreFieldInputType } from '@/lib/types/database'

const INPUT_TYPE_LABELS: Record<CoreFieldInputType, string> = {
  text:     'Short Text',
  email:    'Email',
  tel:      'Phone',
  textarea: 'Long Text',
  select:   'Dropdown',
}

// No fields are permanently locked — all can be hidden or made optional
const LOCKED_ENABLED:  CoreField['key'][] = []
const LOCKED_REQUIRED: CoreField['key'][] = []
// Email input type is locked so format validation still works if shown
const LOCKED_TYPE: CoreField['key'][] = ['email']

interface Props {
  eventId: string
  fields: CoreField[] | null
  onChange: (fields: CoreField[]) => void
  globalChurches: string[]
}

// ── Options editor for select-type core fields ────────────────
function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (opts: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const t = draft.trim()
    if (t && !options.includes(t)) { onChange([...options, t]); setDraft('') }
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-[#E5E5E5] bg-[#fafafa] p-3">
      <p className="text-xs font-medium text-muted">Dropdown options</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <span key={i} className="flex items-center gap-1 rounded border border-[#E5E5E5] bg-white px-2 py-0.5 text-xs text-[#111111]">
            {opt}
            <button type="button" onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-muted hover:text-error">
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {options.length === 0 && <span className="text-xs italic text-muted">No options yet</span>}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add option…"
          className="text-xs h-8"
        />
        <button type="button" onClick={add} disabled={!draft.trim()}
          className="shrink-0 rounded-btn bg-[#111111] px-3 py-1 text-xs font-medium text-white disabled:opacity-40">
          Add
        </button>
      </div>
    </div>
  )
}

export default function CoreFieldsEditor({ eventId, fields, onChange, globalChurches }: Props) {
  const [local, setLocal] = useState<CoreField[]>(resolveCoreFields(fields))
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<CoreField['key'] | null>(null)
  const [draftLabel, setDraftLabel] = useState('')

  function update(key: CoreField['key'], patch: Partial<CoreField>) {
    const next = local.map((f) => f.key === key ? { ...f, ...patch } : f)
    setLocal(next)
    onChange(next)
  }

  function startEdit(field: CoreField) {
    setEditingKey(field.key)
    setDraftLabel(field.label)
  }

  function commitEdit(key: CoreField['key']) {
    const trimmed = draftLabel.trim()
    if (trimmed) update(key, { label: trimmed })
    setEditingKey(null)
  }

  function handleTypeChange(key: CoreField['key'], inputType: CoreFieldInputType) {
    const field = local.find((f) => f.key === key)!
    // When switching to select, seed with GMS_CHURCHES for gms_church, else empty
    const options =
      inputType === 'select'
        ? (field.options?.length ? field.options : key === 'gms_church' ? [...globalChurches] : [])
        : undefined
    update(key, { inputType, options })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    const res = await updateCoreFields(eventId, local)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">{error}</p>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between rounded-lg bg-[#fafafa] px-4 py-3">
        <p className="text-xs text-muted">Edit label, input type, visibility, and required status.</p>
        <button type="button" onClick={handleSave} disabled={saving}
          className="shrink-0 rounded-btn bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40">
          {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save Core Fields'}
        </button>
      </div>

      {local.map((field) => {
        const lockedEnabled  = LOCKED_ENABLED.includes(field.key)
        const lockedRequired = LOCKED_REQUIRED.includes(field.key)
        const lockedType     = LOCKED_TYPE.includes(field.key)
        const isEditing      = editingKey === field.key

        return (
          <div key={field.key}
            className={`rounded-lg border border-[#E5E5E5] p-3 transition-opacity ${!field.enabled ? 'opacity-50' : ''}`}>

            {/* Row 1 — label + required + visibility */}
            <div className="flex items-center gap-3">
              {/* Label */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <Input autoFocus value={draftLabel}
                    onChange={(e) => setDraftLabel(e.target.value)}
                    onBlur={() => commitEdit(field.key)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitEdit(field.key)
                      if (e.key === 'Escape') setEditingKey(null)
                    }}
                    className="text-sm h-7 py-0"
                  />
                ) : (
                  <button type="button" onClick={() => startEdit(field)}
                    className="group flex items-center gap-1.5 text-left" title="Click to rename">
                    <span className="text-sm font-medium text-[#111111]">{field.label}</span>
                    <svg className="size-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </button>
                )}
                <p className="mt-0.5 text-xs font-mono text-muted">{field.key}</p>
              </div>

              {/* Required badge */}
              <button type="button"
                onClick={() => !lockedRequired && field.enabled && update(field.key, { required: !field.required })}
                disabled={lockedRequired || !field.enabled}
                className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                  field.required
                    ? 'border-[#111111] bg-[#111111] text-white'
                    : 'border-[#E5E5E5] text-muted'
                } disabled:cursor-not-allowed`}>
                Required
              </button>

              {/* Visibility toggle */}
              <button type="button"
                onClick={() => !lockedEnabled && update(field.key, {
                  enabled: !field.enabled,
                  required: field.enabled ? false : field.required,
                })}
                disabled={lockedEnabled}
                title={lockedEnabled ? 'Cannot be hidden' : field.enabled ? 'Hide field' : 'Show field'}
                className={`flex size-8 shrink-0 items-center justify-center rounded-btn border border-[#E5E5E5] transition-colors hover:bg-[#f5f5f5] disabled:cursor-not-allowed disabled:opacity-40`}>
                {field.enabled ? (
                  <svg className="size-3.5 text-[#111111]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ) : (
                  <svg className="size-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                )}
              </button>
            </div>

            {/* Row 2 — input type selector */}
            {field.enabled && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(INPUT_TYPE_LABELS) as CoreFieldInputType[]).map((t) => (
                    <button key={t} type="button"
                      disabled={lockedType}
                      onClick={() => handleTypeChange(field.key, t)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                        field.inputType === t
                          ? 'border-[#111111] bg-[#111111] text-white'
                          : 'border-[#E5E5E5] text-muted hover:border-[#999] hover:text-[#111111]'
                      } disabled:cursor-not-allowed disabled:opacity-40`}>
                      {INPUT_TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>

                {/* Options editor for select type */}
                {field.inputType === 'select' && (
                  <OptionsEditor
                    options={field.options ?? []}
                    onChange={(opts) => update(field.key, { options: opts })}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      <p className="px-1 text-xs text-muted">
        Hiding or making <strong className="text-[#111111]">Email</strong> optional will disable QR code delivery and confirmation emails for that event.
      </p>
    </div>
  )
}

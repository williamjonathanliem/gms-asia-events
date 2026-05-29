'use client'

import { useState } from 'react'
import { updateCoreFields } from '@/app/dashboard/events/actions'
import { Input } from '@/components/ui/input'
import { resolveCoreFields } from '@/lib/types/database'
import type { CoreField } from '@/lib/types/database'

// Keys that must always stay enabled + required
const LOCKED_ENABLED: CoreField['key'][] = ['full_name', 'email']
const LOCKED_REQUIRED: CoreField['key'][] = ['full_name', 'email']

interface Props {
  eventId: string
  fields: CoreField[] | null
  onChange: (fields: CoreField[]) => void
}

export default function CoreFieldsEditor({ eventId, fields, onChange }: Props) {
  const [local, setLocal] = useState<CoreField[]>(resolveCoreFields(fields))
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<CoreField['key'] | null>(null)
  const [draftLabel, setDraftLabel] = useState('')

  function startEdit(field: CoreField) {
    setEditingKey(field.key)
    setDraftLabel(field.label)
  }

  function commitEdit(key: CoreField['key']) {
    const trimmed = draftLabel.trim()
    if (!trimmed) { setEditingKey(null); return }
    const next = local.map((f) => f.key === key ? { ...f, label: trimmed } : f)
    setLocal(next)
    onChange(next)
    setEditingKey(null)
  }

  function toggleEnabled(key: CoreField['key']) {
    if (LOCKED_ENABLED.includes(key)) return
    const next = local.map((f) =>
      f.key === key ? { ...f, enabled: !f.enabled, required: f.enabled ? false : f.required } : f
    )
    setLocal(next)
    onChange(next)
  }

  function toggleRequired(key: CoreField['key']) {
    if (LOCKED_REQUIRED.includes(key)) return
    const field = local.find((f) => f.key === key)
    if (!field?.enabled) return
    const next = local.map((f) => f.key === key ? { ...f, required: !f.required } : f)
    setLocal(next)
    onChange(next)
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
        <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
          {error}
        </p>
      )}

      {/* Save bar */}
      <div className="flex items-center justify-between rounded-lg bg-[#fafafa] px-4 py-3">
        <p className="text-xs text-muted">
          Click a field label to rename it. Toggle visibility and required status.
        </p>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="shrink-0 rounded-btn bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40"
        >
          {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save Core Fields'}
        </button>
      </div>

      {local.map((field) => {
        const lockedEnabled = LOCKED_ENABLED.includes(field.key)
        const lockedRequired = LOCKED_REQUIRED.includes(field.key)
        const isEditing = editingKey === field.key

        return (
          <div
            key={field.key}
            className={`flex items-center gap-3 rounded-lg border px-4 py-3 transition-colors ${
              field.enabled ? 'border-[#E5E5E5]' : 'border-[#E5E5E5] opacity-50'
            }`}
          >
            {/* Label / edit inline */}
            <div className="flex-1 min-w-0">
              {isEditing ? (
                <Input
                  autoFocus
                  value={draftLabel}
                  onChange={(e) => setDraftLabel(e.target.value)}
                  onBlur={() => commitEdit(field.key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(field.key)
                    if (e.key === 'Escape') setEditingKey(null)
                  }}
                  className="text-sm h-7 py-0"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => startEdit(field)}
                  className="group flex items-center gap-1.5 text-left"
                  title="Click to rename"
                >
                  <span className="text-sm font-medium text-[#111111]">{field.label}</span>
                  <svg
                    className="size-3 text-muted opacity-0 group-hover:opacity-100 transition-opacity"
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                </button>
              )}
              <p className="mt-0.5 text-xs text-muted font-mono">{field.key}</p>
            </div>

            {/* Required badge toggle */}
            <button
              type="button"
              onClick={() => toggleRequired(field.key)}
              disabled={lockedRequired || !field.enabled}
              title={lockedRequired ? 'Always required' : 'Toggle required'}
              className={`rounded border px-2 py-0.5 text-xs font-medium transition-colors ${
                field.required
                  ? 'border-[#111111] bg-[#111111] text-white'
                  : 'border-[#E5E5E5] text-muted'
              } disabled:cursor-not-allowed`}
            >
              Required
            </button>

            {/* Show / hide toggle */}
            <button
              type="button"
              onClick={() => toggleEnabled(field.key)}
              disabled={lockedEnabled}
              title={lockedEnabled ? 'Cannot be hidden' : field.enabled ? 'Hide field' : 'Show field'}
              className={`flex size-8 shrink-0 items-center justify-center rounded-btn border transition-colors ${
                field.enabled
                  ? 'border-[#E5E5E5] text-[#111111] hover:bg-[#f5f5f5]'
                  : 'border-[#E5E5E5] text-muted hover:bg-[#f5f5f5]'
              } disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {field.enabled ? (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              ) : (
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              )}
            </button>
          </div>
        )
      })}

      <p className="text-xs text-muted px-1">
        <strong className="text-[#111111]">Full Name</strong> and <strong className="text-[#111111]">Email</strong> are always shown and required — they are needed for QR codes and confirmation emails.
      </p>
    </div>
  )
}

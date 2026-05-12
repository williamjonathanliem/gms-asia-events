'use client'

import { useState } from 'react'
import { updateCustomFields } from '@/app/dashboard/events/actions'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import type { CustomField, CustomFieldType } from '@/lib/types/database'

interface Props {
  eventId: string
  fields: CustomField[]
  onChange: (fields: CustomField[]) => void
}

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Short Text',
  textarea: 'Long Text',
  select: 'Dropdown',
  checkbox: 'Checkbox',
}

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

// ── Options editor (for select type) ─────────────────────────
function OptionsEditor({
  options,
  onChange,
}: {
  options: string[]
  onChange: (opts: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  function add() {
    const trimmed = draft.trim()
    if (trimmed && !options.includes(trimmed)) {
      onChange([...options, trimmed])
      setDraft('')
    }
  }

  return (
    <div className="space-y-2">
      <Label>Options</Label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt, i) => (
          <span
            key={i}
            className="flex items-center gap-1 rounded-md border border-[#E5E5E5] bg-[#fafafa] px-2 py-1 text-xs text-[#111111]"
          >
            {opt}
            <button
              type="button"
              onClick={() => onChange(options.filter((_, j) => j !== i))}
              className="text-muted hover:text-error"
            >
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        {options.length === 0 && (
          <span className="text-xs italic text-muted">No options yet</span>
        )}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="Add option…"
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

// ── Single field row ──────────────────────────────────────────
function FieldRow({
  field,
  index,
  total,
  onMove,
  onEdit,
  onDelete,
}: {
  field: CustomField
  index: number
  total: number
  onMove: (from: number, to: number) => void
  onEdit: (field: CustomField) => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-[#E5E5E5] p-3">
      {/* Reorder arrows */}
      <div className="flex flex-col gap-0.5 pt-0.5">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
          className="rounded p-0.5 text-muted hover:text-[#111111] disabled:opacity-20"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, index + 1)}
          className="rounded p-0.5 text-muted hover:text-[#111111] disabled:opacity-20"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </div>

      {/* Field info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#111111] truncate">{field.label}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          <span className="rounded border border-[#E5E5E5] px-1.5 py-0.5 text-xs text-muted">
            {TYPE_LABELS[field.type]}
          </span>
          {field.required && (
            <span className="rounded border border-[#111111] px-1.5 py-0.5 text-xs font-medium text-[#111111]">
              Required
            </span>
          )}
          {field.type === 'select' && field.options && (
            <span className="text-xs text-muted">
              {field.options.length} option{field.options.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => onEdit(field)}
          className="rounded p-1.5 text-muted hover:bg-[#f5f5f5] hover:text-[#111111] transition-colors"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => onDelete(field.id)}
          className="rounded p-1.5 text-muted hover:bg-error/5 hover:text-error transition-colors"
        >
          <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Add / edit field form ─────────────────────────────────────
function FieldForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: CustomField
  onSave: (field: CustomField) => void
  onCancel: () => void
}) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [type, setType] = useState<CustomFieldType>(initial?.type ?? 'text')
  const [required, setRequired] = useState(initial?.required ?? false)
  const [placeholder, setPlaceholder] = useState(initial?.placeholder ?? '')
  const [options, setOptions] = useState<string[]>(initial?.options ?? [])
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (!label.trim()) { setError('Label is required'); return }
    if (type === 'select' && options.length === 0) { setError('Add at least one option'); return }
    onSave({
      id: initial?.id ?? generateId(),
      label: label.trim(),
      type,
      required,
      placeholder: placeholder.trim() || undefined,
      options: type === 'select' ? options : undefined,
    })
  }

  return (
    <div className="space-y-4 rounded-lg border-2 border-[#111111] p-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-[#111111]">
        {initial ? 'Edit Field' : 'New Field'}
      </p>

      {error && <p className="text-xs text-error">{error}</p>}

      <div>
        <Label htmlFor="field-label" required>Label</Label>
        <Input
          id="field-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. T-Shirt Size"
        />
      </div>

      <div>
        <Label htmlFor="field-type">Field Type</Label>
        <select
          id="field-type"
          value={type}
          onChange={(e) => setType(e.target.value as CustomFieldType)}
          className="w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent"
        >
          {(Object.keys(TYPE_LABELS) as CustomFieldType[]).map((t) => (
            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>

      {(type === 'text' || type === 'textarea') && (
        <div>
          <Label htmlFor="field-placeholder">Placeholder</Label>
          <Input
            id="field-placeholder"
            value={placeholder}
            onChange={(e) => setPlaceholder(e.target.value)}
            placeholder="Hint text shown in the input…"
          />
        </div>
      )}

      {type === 'select' && (
        <OptionsEditor options={options} onChange={setOptions} />
      )}

      {/* Required toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="size-4 rounded border-[#E5E5E5] accent-[#111111]"
        />
        <span className="text-sm text-[#111111]">Required field</span>
      </label>

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
          onClick={handleSave}
          className="flex-1 rounded-btn bg-[#111111] py-2 text-sm font-medium text-white hover:opacity-80"
        >
          {initial ? 'Update Field' : 'Add Field'}
        </button>
      </div>
    </div>
  )
}

// ── Custom fields builder root ────────────────────────────────
export default function CustomFieldsBuilder({ eventId, fields, onChange }: Props) {
  const [editingField, setEditingField] = useState<CustomField | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function move(from: number, to: number) {
    const next = [...fields]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  function handleDelete(id: string) {
    onChange(fields.filter((f) => f.id !== id))
  }

  function handleAdd(field: CustomField) {
    onChange([...fields, field])
    setShowAdd(false)
  }

  function handleUpdate(updated: CustomField) {
    onChange(fields.map((f) => (f.id === updated.id ? updated : f)))
    setEditingField(null)
  }

  async function handleSaveAll() {
    setSaving(true)
    setError(null)
    const res = await updateCustomFields(eventId, fields)
    setSaving(false)
    if (res.error) { setError(res.error); return }
    setSavedMsg(true)
    setTimeout(() => setSavedMsg(false), 2000)
  }

  return (
    <div className="space-y-4 px-6 py-6">
      {error && (
        <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
          {error}
        </p>
      )}

      {/* Save bar */}
      {fields.length > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-[#fafafa] px-4 py-3">
          <p className="text-xs text-muted">
            {fields.length} custom field{fields.length !== 1 ? 's' : ''}
            &ensp;·&ensp;Changes are applied after saving.
          </p>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            className="rounded-btn bg-[#111111] px-4 py-1.5 text-xs font-medium text-white hover:opacity-80 disabled:opacity-40"
          >
            {saving ? 'Saving…' : savedMsg ? 'Saved ✓' : 'Save Order & Fields'}
          </button>
        </div>
      )}

      {/* Field list */}
      {fields.map((field, i) =>
        editingField?.id === field.id ? (
          <FieldForm
            key={field.id}
            initial={editingField}
            onSave={handleUpdate}
            onCancel={() => setEditingField(null)}
          />
        ) : (
          <FieldRow
            key={field.id}
            field={field}
            index={i}
            total={fields.length}
            onMove={move}
            onEdit={setEditingField}
            onDelete={handleDelete}
          />
        )
      )}

      {fields.length === 0 && !showAdd && (
        <p className="py-4 text-center text-sm text-muted">
          No custom fields. Add one to extend the registration form.
        </p>
      )}

      {/* Add field */}
      {showAdd ? (
        <FieldForm onSave={handleAdd} onCancel={() => setShowAdd(false)} />
      ) : (
        !editingField && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="flex w-full items-center justify-center gap-2 rounded-btn border border-dashed border-[#E5E5E5] py-3 text-sm text-muted transition-colors hover:border-[#999999] hover:text-[#111111]"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Add Custom Field
          </button>
        )
      )}

      {/* Save fields after adding/editing */}
      {fields.length > 0 && (showAdd || editingField) && (
        <p className="text-xs text-center text-muted">
          Click "Save Order &amp; Fields" after finishing all edits.
        </p>
      )}
    </div>
  )
}

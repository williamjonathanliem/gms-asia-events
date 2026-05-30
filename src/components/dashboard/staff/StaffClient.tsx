'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { inviteStaff, updateStaffMember, removeStaff } from '@/app/dashboard/staff/actions'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { StaffUser, StaffRole, Event } from '@/lib/types/database'

const ROLES: { value: StaffRole; label: string; description: string }[] = [
  { value: 'super_admin', label: 'Super Admin', description: 'Full access — events, staff, all registrations' },
  { value: 'admin',       label: 'Admin',       description: 'Manage registrations, verify payments, scan QR' },
  { value: 'viewer',      label: 'Viewer',      description: 'Read-only access to registrations' },
  { value: 'scanner',     label: 'Scanner',     description: 'QR scanner only — no dashboard access' },
]

const ROLE_COLORS: Record<StaffRole, string> = {
  super_admin: 'border-[#111111] text-[#111111]',
  admin:       'border-success text-success',
  viewer:      'border-muted text-muted',
  scanner:     'border-warning text-warning',
}

function RoleBadge({ role }: { role: StaffRole }) {
  return (
    <span className={cn('inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium', ROLE_COLORS[role])}>
      {ROLES.find((r) => r.value === role)?.label ?? role}
    </span>
  )
}

// ── Scope selector ────────────────────────────────────────────
function ScopeSelect({
  value,
  onChange,
  events,
}: {
  value: string
  onChange: (v: string) => void
  events: Pick<Event, 'id' | 'name' | 'date'>[]
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm text-[#111111] focus:outline-none focus:ring-2 focus:ring-[#111111] focus:border-transparent"
    >
      <option value="">All Events</option>
      {events.map((ev) => (
        <option key={ev.id} value={ev.id}>
          {ev.name} — {formatDate(ev.date)}
        </option>
      ))}
    </select>
  )
}

// ── Drawer ────────────────────────────────────────────────────
function StaffDrawer({
  member,
  events,
  onClose,
  onSaved,
  onRemoved,
}: {
  member: StaffUser | null // null = invite new
  events: Pick<Event, 'id' | 'name' | 'date'>[]
  onClose: () => void
  onSaved: (member: StaffUser) => void
  onRemoved: (id: string) => void
}) {
  const isNew = member === null
  const [email, setEmail]       = useState('')
  const [role, setRole]         = useState<StaffRole>(member?.role ?? 'viewer')
  const [scope, setScope]       = useState(member?.event_scope ?? '')
  const [saving, setSaving]     = useState(false)
  const [removing, setRemoving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function handleSave() {
    setError(null)
    if (isNew && !email.trim()) { setError('Email is required'); return }
    if (isNew && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address'); return
    }
    setSaving(true)
    if (isNew) {
      const res = await inviteStaff({ email, role, event_scope: scope || null })
      setSaving(false)
      if (res.error) { setError(res.error); return }
      // Optimistically add — server will have the real ID after refresh
      onSaved({ id: '', email: email.trim().toLowerCase(), role, event_scope: scope || null, created_at: new Date().toISOString() })
      onClose()
    } else {
      const res = await updateStaffMember(member.id, { role, event_scope: scope || null })
      setSaving(false)
      if (res.error) { setError(res.error); return }
      onSaved({ ...member, role, event_scope: scope || null })
      onClose()
    }
  }

  async function handleRemove() {
    if (!member) return
    setRemoving(true)
    const res = await removeStaff(member.id)
    setRemoving(false)
    if (res.error) { setError(res.error); return }
    onRemoved(member.id)
    onClose()
  }

  const selectedRoleInfo = ROLES.find((r) => r.value === role)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex w-full sm:max-w-md flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#E5E5E5] px-6 py-4">
          <h2 className="text-sm font-semibold text-[#111111]">
            {isNew ? 'Invite Staff Member' : member.email}
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

        {/* Content */}
        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          {error && (
            <p className="rounded-lg border border-error/30 bg-error/5 px-4 py-3 text-xs text-error">
              {error}
            </p>
          )}

          {/* Email (invite only) */}
          {isNew && (
            <div>
              <Label htmlFor="staff-email" required>Email Address</Label>
              <Input
                id="staff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="staff@gms.church"
              />
              <p className="mt-1.5 text-xs text-muted">
                An invite link will be sent to this address.
              </p>
            </div>
          )}

          {/* Role */}
          <div>
            <Label>Role</Label>
            <div className="mt-2 space-y-2">
              {ROLES.map((r) => (
                <label
                  key={r.value}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors',
                    role === r.value
                      ? 'border-[#111111] bg-[#fafafa]'
                      : 'border-[#E5E5E5] hover:border-[#999999]'
                  )}
                >
                  <input
                    type="radio"
                    name="staff-role"
                    value={r.value}
                    checked={role === r.value}
                    onChange={() => setRole(r.value)}
                    className="sr-only"
                  />
                  <div
                    className={cn(
                      'mt-0.5 size-3.5 shrink-0 rounded-full border-2 flex items-center justify-center',
                      role === r.value ? 'border-[#111111]' : 'border-[#D1D1D1]'
                    )}
                  >
                    {role === r.value && <div className="size-1.5 rounded-full bg-[#111111]" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[#111111]">{r.label}</p>
                    <p className="text-xs text-muted">{r.description}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Event Scope */}
          <div>
            <Label htmlFor="staff-scope">
              Event Scope&ensp;
              <span className="font-normal text-muted">(optional)</span>
            </Label>
            <ScopeSelect value={scope} onChange={setScope} events={events} />
            <p className="mt-1.5 text-xs text-muted">
              {`Limit this member to one event's data. Leave as "All Events" for unrestricted access.`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 space-y-3 border-t border-[#E5E5E5] px-6 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full rounded-btn bg-[#111111] py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {saving
              ? isNew ? 'Sending Invite…' : 'Saving…'
              : isNew ? 'Send Invite' : 'Save Changes'}
          </button>

          {!isNew && (
            !confirmRemove ? (
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                className="w-full rounded-btn border border-error/40 py-2.5 text-sm font-medium text-error transition-colors hover:bg-error/5"
              >
                Remove Staff Member
              </button>
            ) : (
              <div className="space-y-2">
                <p className="text-center text-xs text-muted">
                  This will revoke their access and delete their account. Sure?
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(false)}
                    className="flex-1 rounded-btn border border-[#E5E5E5] py-2 text-sm text-muted hover:bg-[#fafafa]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleRemove}
                    disabled={removing}
                    className="flex-1 rounded-btn bg-error py-2 text-sm font-medium text-white hover:opacity-80 disabled:opacity-40"
                  >
                    {removing ? 'Removing…' : 'Yes, Remove'}
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      </div>
    </>
  )
}

// ── Main client ───────────────────────────────────────────────
interface Props {
  initialStaff: StaffUser[]
  events: Pick<Event, 'id' | 'name' | 'date'>[]
  currentUserId: string
}

export default function StaffClient({ initialStaff, events, currentUserId }: Props) {
  const router = useRouter()
  const [staff, setStaff] = useState<StaffUser[]>(initialStaff)
  const [selected, setSelected] = useState<StaffUser | null | undefined>(undefined) // undefined = closed
  const [showInvite, setShowInvite] = useState(false)

  useEffect(() => { setStaff(initialStaff) }, [initialStaff])

  const drawerOpen = showInvite || selected !== undefined

  function handleSaved(member: StaffUser) {
    setStaff((prev) => {
      const idx = prev.findIndex((s) => s.id === member.id)
      if (idx === -1) return [...prev, member]
      const next = [...prev]
      next[idx] = member
      return next
    })
    router.refresh()
  }

  function handleRemoved(id: string) {
    setStaff((prev) => prev.filter((s) => s.id !== id))
    router.refresh()
  }

  function closeDrawer() {
    setShowInvite(false)
    setSelected(undefined)
  }

  const eventMap = Object.fromEntries(events.map((e) => [e.id, e.name]))

  return (
    <>
      {/* Header row */}
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-muted">{staff.length} member{staff.length !== 1 ? 's' : ''}</p>
        <button
          onClick={() => { setSelected(undefined); setShowInvite(true) }}
          className="flex items-center gap-2 rounded-btn bg-[#111111] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          Invite Staff
        </button>
      </div>

      {/* Staff table */}
      {staff.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] py-16 text-center">
          <p className="text-sm text-muted">No staff members yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E5E5E5]">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#fafafa]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted">Email</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted">Role</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted hidden sm:table-cell">Event Scope</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted hidden md:table-cell">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-[#fafafa] transition-colors">
                  <td className="px-4 py-3 max-w-[200px] truncate">
                    <span className="font-medium text-[#111111]">{member.email}</span>
                    {member.id === currentUserId && (
                      <span className="ml-2 text-xs text-muted">(you)</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RoleBadge role={member.role} />
                  </td>
                  <td className="px-4 py-3 text-muted hidden sm:table-cell">
                    {member.event_scope ? (eventMap[member.event_scope] ?? 'Unknown event') : (
                      <span className="text-muted/60 italic">All Events</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted hidden md:table-cell whitespace-nowrap">
                    {formatDate(member.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setShowInvite(false); setSelected(member) }}
                      className="rounded-md px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-[#f5f5f5] hover:text-[#111111]"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <StaffDrawer
          member={showInvite ? null : (selected ?? null)}
          events={events}
          onClose={closeDrawer}
          onSaved={handleSaved}
          onRemoved={handleRemoved}
        />
      )}
    </>
  )
}

'use client'

import { useState, useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { StatusBadge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import RegistrantDrawer, { type DrawerRegistration } from './RegistrantDrawer'
import type { StaffRole } from '@/lib/types/database'

interface Props {
  registrations: DrawerRegistration[]
  total: number
  page: number
  pageSize: number
  staffRole: StaffRole
  /** When true, show which event each row belongs to (cross-event list) */
  showEventColumn?: boolean
}

function CheckIcon({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="text-xs font-medium text-success">✓</span>
  ) : (
    <span className="text-xs text-muted">—</span>
  )
}

export default function RegistrationsClient({
  registrations: initial,
  total,
  page,
  pageSize,
  staffRole,
  showEventColumn = false,
}: Props) {
  const [rows, setRows] = useState<DrawerRegistration[]>(initial)
  const [selected, setSelected] = useState<DrawerRegistration | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const totalPages = Math.ceil(total / pageSize)

  // Keep rows in sync when server re-renders with new props
  // (runs whenever parent re-renders with new data)
  if (initial !== rows && !selected) {
    setRows(initial)
  }

  const handleUpdate = useCallback(
    (id: string, updates: Partial<DrawerRegistration>) => {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
      )
      setSelected((prev) => (prev?.id === id ? { ...prev, ...updates } : prev))
    },
    []
  )

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', String(p))
    router.push(`${pathname}?${params.toString()}`)
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-[#E5E5E5] px-6 py-16 text-center">
        <svg className="mx-auto size-8 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
        </svg>
        <p className="mt-3 text-sm font-medium text-[#111111]">No registrations found</p>
        <p className="mt-1 text-xs text-muted">Try adjusting your filters or add a walk-in registrant.</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-[#E5E5E5]">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[#E5E5E5] bg-[#fafafa]">
              {[
                'Name',
                'Email',
                'Church',
                ...(showEventColumn ? ['Event'] : []),
                'Package',
                'Status',
                'Toolkit',
                'Attended',
                'Registered',
              ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest text-muted"
                  >
                    {h}
                  </th>
                ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((reg) => {
              const toolkitDone = reg.attendance_logs.some((l) => l.scan_type === 'toolkit')
              const eventDone = reg.attendance_logs.some((l) => l.scan_type === 'event')
              const isSelected = selected?.id === reg.id

              return (
                <tr
                  key={reg.id}
                  onClick={() => setSelected(reg)}
                  className={`border-b border-[#E5E5E5] last:border-0 cursor-pointer transition-colors ${
                    isSelected ? 'bg-[#f5f5f5]' : 'hover:bg-[#fafafa]'
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-[#111111] max-w-[160px] truncate">
                    {reg.full_name}
                  </td>
                  <td className="px-4 py-3 text-muted max-w-[180px] truncate">{reg.email}</td>
                  <td className="px-4 py-3 text-muted max-w-[140px] truncate">{reg.gms_church}</td>
                  {showEventColumn && (
                    <td className="px-4 py-3 text-muted max-w-[140px] truncate" title={reg.events?.date}>
                      {reg.events?.name ?? '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-muted">{reg.packages?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={reg.payment_status} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckIcon checked={toolkitDone} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckIcon checked={eventDone} />
                  </td>
                  <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                    {formatDateTime(reg.created_at)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-btn border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-muted hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted">{page} / {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-btn border border-[#E5E5E5] px-3 py-1.5 text-xs font-medium text-muted hover:bg-[#f5f5f5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <RegistrantDrawer
        registration={selected}
        onClose={() => setSelected(null)}
        onUpdate={handleUpdate}
        staffRole={staffRole}
      />
    </>
  )
}

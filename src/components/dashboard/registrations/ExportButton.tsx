'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { exportRegistrations } from '@/app/dashboard/registrations/actions'

interface Props {
  eventId?: string | null
}

export default function ExportButton({ eventId }: Props) {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  async function handleExport() {
    setLoading(true)
    const res = await exportRegistrations({
      eventId,
      search:  searchParams.get('search') ?? undefined,
      status:  searchParams.get('status') ?? undefined,
      church:  searchParams.get('church') ?? undefined,
      package: searchParams.get('package') ?? undefined,
    })
    setLoading(false)

    if (res.error || !res.csv) {
      alert(res.error ?? 'Export failed')
      return
    }

    const blob = new Blob([res.csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#fafafa] disabled:opacity-40"
    >
      {loading ? (
        <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
        </svg>
      ) : (
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
        </svg>
      )}
      {loading ? 'Exporting…' : 'Export CSV'}
    </button>
  )
}

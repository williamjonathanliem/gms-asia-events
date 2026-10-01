'use client'

import { useState, useMemo } from 'react'

interface Row {
  full_name: string
  email: string
  gms_church: string
  package_name: string
  answer: string
}

interface Props {
  allergenLabel: string
  rows: Row[]
}

export default function AllergensClient({ allergenLabel, rows }: Props) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(
      (r) =>
        r.full_name.toLowerCase().includes(q) ||
        r.gms_church.toLowerCase().includes(q) ||
        r.answer.toLowerCase().includes(q)
    )
  }, [rows, search])

  function exportCSV() {
    const escape = (v: string) =>
      v.includes(',') || v.includes('"') || v.includes('\n')
        ? `"${v.replace(/"/g, '""')}"`
        : v

    const headers = ['Full Name', 'Email', 'Church', 'Package', allergenLabel]
    const csvRows = filtered.map((r) =>
      [r.full_name, r.email, r.gms_church, r.package_name, r.answer].map(escape).join(',')
    )
    const csv = [headers.join(','), ...csvRows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `allergens-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, church, or dietary note…"
          className="h-9 w-72 rounded-btn border border-[#E5E5E5] px-3 text-sm text-[#111111] placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[#111111]/10"
        />
        <div className="ml-auto flex items-center gap-3">
          <p className="text-sm text-muted">
            {filtered.length} registrant{filtered.length !== 1 ? 's' : ''}
          </p>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-2 rounded-btn border border-[#E5E5E5] bg-white px-3 py-2 text-sm font-medium text-[#111111] transition-colors hover:bg-[#fafafa] disabled:opacity-40"
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-[#E5E5E5] px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#111111]">
            {search ? 'No matches' : 'No dietary restrictions reported'}
          </p>
          <p className="mt-1 text-xs text-muted">
            {search
              ? 'Try a different search term.'
              : 'Verified registrants who left this field blank are not shown.'}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[#E5E5E5]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E5E5E5] bg-[#fafafa]">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">Name</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted sm:table-cell">Church</th>
                <th className="hidden px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted lg:table-cell">Package</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted">{allergenLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E5E5]">
              {filtered.map((r, i) => (
                <tr key={i} className="hover:bg-[#fafafa]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-[#111111]">{r.full_name}</p>
                    <p className="text-xs text-muted">{r.email}</p>
                  </td>
                  <td className="hidden px-4 py-3 text-[#555] sm:table-cell">{r.gms_church}</td>
                  <td className="hidden px-4 py-3 text-[#555] lg:table-cell">{r.package_name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-block rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-amber-200">
                      {r.answer}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

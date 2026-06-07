'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface Props {
  sidebar: React.ReactNode
  children: React.ReactNode
  activeEvents: { id: string; name: string; date: string }[]
}

export default function DashboardShell({ sidebar, children, activeEvents }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-white">
      {/* Mobile backdrop */}
      <div
        className={cn(
          'fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setOpen(false)}
      />

      {/* Sidebar */}
      <div
        className={cn(
          'fixed inset-y-0 left-0 z-30 w-64 transition-transform duration-200',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Mobile close button — rendered on top of the sidebar */}
        <button
          onClick={() => setOpen(false)}
          className={cn(
            'absolute -right-10 top-3 z-40 flex size-8 items-center justify-center rounded-full bg-white shadow-md text-muted transition-opacity duration-200 lg:hidden',
            open ? 'opacity-100' : 'opacity-0 pointer-events-none'
          )}
          aria-label="Close sidebar"
        >
          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        {sidebar}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        {/* Mobile top bar */}
        <div className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b border-[#E5E5E5] bg-white px-4 lg:hidden">
          <button
            onClick={() => setOpen(true)}
            className="rounded-lg p-2 text-muted hover:bg-[#f5f5f5] hover:text-[#111111] transition-colors"
            aria-label="Open sidebar"
          >
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="h-5 w-px bg-[#E5E5E5]" />
          <Image src="/gmschurch_logo.jpg" alt="GMS" width={26} height={26} className="shrink-0 rounded-sm" />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <span className="text-sm font-semibold text-[#111111] leading-none">GMS Events</span>
            {activeEvents.length > 0 && (
              <span className="mt-0.5 truncate text-[11px] text-muted leading-none">
                {activeEvents[0].name}
              </span>
            )}
          </div>
        </div>

        {/* Page content */}
        <div className="min-w-0 flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

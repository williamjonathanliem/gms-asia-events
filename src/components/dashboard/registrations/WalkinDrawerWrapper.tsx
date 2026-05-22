'use client'

import { useState } from 'react'
import WalkinDrawer from './WalkinDrawer'
import type { Event, Package } from '@/lib/types/database'

type EventPricing = Pick<
  Event,
  'currency' | 'early_bird_enabled' | 'early_bird_auto_change' | 'early_bird_end_date'
>

interface Props {
  eventId: string
  packages: Package[]
  eventPricing: EventPricing | null
}

export default function WalkinDrawerWrapper({ eventId, packages, eventPricing }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-btn bg-[#111111] px-3 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
        </svg>
        <span className="hidden sm:inline">Walk-in</span>
      </button>

      {open && (
        <WalkinDrawer
          eventId={eventId}
          packages={packages}
          eventPricing={eventPricing}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

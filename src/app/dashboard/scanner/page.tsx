import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'Scanner' }

export default async function ScannerHomePage() {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin', 'scanner'].includes(staff.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">GMS Events</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#111111]">QR Scanner</h1>
        <p className="mt-1 text-sm text-muted">
          Tap the button below to open the camera and start scanning.
        </p>
      </div>

      <Link
        href="/scan"
        className="flex items-center gap-2.5 rounded bg-[#111111] px-8 py-3 text-sm font-semibold text-white hover:bg-[#2a2a2a] transition-colors"
      >
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zm0 9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zm9.75-9.75c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        </svg>
        Launch Scanner
      </Link>
    </div>
  )
}

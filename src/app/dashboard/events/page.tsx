import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import EventsClient from '@/components/dashboard/events/EventsClient'
import { getGlobalChurches } from '@/app/dashboard/settings/actions'
import type { Metadata } from 'next'
import type { EventWithPackages } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Events' }

export default async function EventsPage() {
  const staff = await getCurrentStaffUser()
  if (!staff || !['super_admin', 'admin'].includes(staff.role)) redirect('/dashboard')

  const supabase = createClient()
  const [{ data }, globalChurches] = await Promise.all([
    supabase.from('events').select('*, packages(*)').order('date', { ascending: false }),
    getGlobalChurches(),
  ])

  const events = (data ?? []) as unknown as EventWithPackages[]

  return (
    <div className="min-h-screen">
      <div className="sticky top-14 lg:top-0 z-10 bg-white border-b border-[#E5E5E5] px-4 py-4 sm:px-8 sm:py-5">
        <h1 className="text-xl font-semibold text-[#111111]">Events</h1>
        <p className="mt-1 text-sm text-muted">
          Manage events, packages, and registration form fields
        </p>
      </div>
      <div className="px-4 py-5 sm:px-8 sm:py-6">
        <EventsClient initialEvents={events} globalChurches={globalChurches} staffRole={staff.role} />
      </div>
    </div>
  )
}

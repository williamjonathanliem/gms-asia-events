import { createClient } from '@/lib/supabase/server'
import { getCurrentStaffUser } from '@/lib/supabase/auth'
import { redirect } from 'next/navigation'
import EventsClient from '@/components/dashboard/events/EventsClient'
import type { Metadata } from 'next'
import type { EventWithPackages } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Events' }

export default async function EventsPage() {
  const staff = await getCurrentStaffUser()
  if (staff?.role !== 'super_admin') redirect('/dashboard')

  const supabase = createClient()
  const { data } = await supabase
    .from('events')
    .select('*, packages(*)')
    .order('date', { ascending: false })

  const events = (data ?? []) as unknown as EventWithPackages[]

  return (
    <div className="min-h-screen">
      <div className="border-b border-[#E5E5E5] px-8 py-6">
        <h1 className="text-xl font-semibold text-[#111111]">Events</h1>
        <p className="mt-1 text-sm text-muted">
          Manage events, packages, and registration form fields
        </p>
      </div>
      <div className="px-8 py-6">
        <EventsClient initialEvents={events} />
      </div>
    </div>
  )
}
